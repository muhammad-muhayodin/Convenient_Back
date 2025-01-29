const mysql = require('mysql2/promise');  // Ensure proper import
const winston = require('winston');
const argon = require('argon2');
const validations = require("./validations")
const { Date_Time } = require("./helper.js")
class Users{
    constructor(pool, logger) {
        this.pool = pool;

        this.logger = logger

        this.checkConnection();
    }

    async checkConnection() {
        try {
            const [rows] = await this.pool.execute('SELECT 1');
            console.log('Connection is successful:', rows);
        } catch (err) {
            console.error('Error connecting to the database:', err);
            this.logger.error('SQL connection failed');
        }
    }

    /**
     * Function to insert User to the database
     * @param {string} username Simple Unique Username
     * @param {string} firstname First Name Of The User
     * @param {string} lastname Last Name Of The User
     * @param {string} usertype UserType From 'STUDENT', 'TEACHER', 'PARENT', 'MANAGER', 'ADMIN'
     * @param {string} password Password That Must Meet Certain Requirements
     * @param {string} country Two Character Symbol For Every Country
     * @returns Message Object
     * 
     * @example 
     * insertUser("someusername", "userfirstname", "userlastname", "STUDENT", "SecurePasswordWithNumbers123", "SA")
     * 
     */
    async #insertUser(username, firstname, lastname, usertype, password, country) {
        console.log("PAsswords", password)
        const query = 'INSERT INTO convenientedu.users (username, first_name, last_name, usertype, password_hash, country) VALUES (?, ?, ?, ?, ?, ?)';
        const allowedUserType = ['STUDENT', 'TEACHER', 'PARENT', 'MANAGER', 'ADMIN'];
        username = String(username).toLowerCase()
        usertype = String(usertype).toUpperCase()
        await this.checkUsername(username)
        // Complete Check
        if (!allowedUserType.includes(usertype)) {
            return { message: 'Usertype Invalid', detail: 'The usertype is invalid', code: 422 };
        }

        if (!username || !firstname || !lastname || !password || !country) {
            return { message: 'Invalid Input', detail: 'All fields are required', code: 422 };
        }

        const valid = new validations();
        const validation = valid.validatePassword(password);
        if (validation !== true) {
            return {"message":validation, detail:"", code:422}
        }

        try {
            const hash = await argon.hash(password);
            const parameters = [username, firstname, lastname, usertype, hash, country];
            const [rows] = await this.pool.execute(query, parameters);

            if (rows.affectedRows > 0) {
                const insertID = rows.insertId
                return { message: 'User Added Successfully', detail: `User Added With ID: ${insertID}`, code: 200, insertID: insertID};
            } else {
                this.logger.warn("While there was no error, user still wasn't added! Check validation factors")
                return { message: 'No User Was Added', detail: 'We were unable to add the user', code: 304 };
            }
        } catch (error) {
            this.logger.error(`Error inserting user: ${error.message}`);
            if (String(error.message).split(" ").find("Duplicate")) {
                return { message: 'Username Already Found', detail: "Please Use Another Username", code: 500 };
            }
            return { message: 'Error Adding User', detail: "There was an error adding new user", code: 500 };
        }
    }

    /**
     * Function to add a new classroom
     * @param {string} classroomName Classroom Name
     * @param {number} maxStudents Number Of Students Allowed In The Classroom
     * @param {number} managerID User Identification Number For Manager
     * @param {string} classtype Type Of Classroom
     * @param {number} parentID User Identification Number For Parents
     * @returns Returns a message, detail and a code
     */
    async insertClassroom(classroomName, maxStudents, managerID, classtype, parentID = 0){
        if (parentID === 0) {
            parentID = null;
        }
        classtype = String(classtype).toUpperCase();
        if (classtype === "SUPPORT" && parentID === null) {
            return {"message": "Parent Is A Requirement", detail: "Parent Must Be Provided For Support Classrooms", code: 422}
        }

        if (classtype === "SUPPORT" && maxStudents !== 1) {
            return {"message": "Invalid Number Of Student", detail: "Max Students For Support Classes Is One", code: 422}
        }
        const query = "INSERT INTO convenientedu.classrooms (classroomName, classType, max_students, managerID, parentID) VALUES ( ?,?,?,?,? )";
        const parameters = [classroomName, classtype, maxStudents, managerID, parentID]
        for (const element in parameters) {
            if (element === null || element === 0 || isNaN(element) || element === "" || element === undefined) {
                this.logger.error("There Was An Error Adding Value");
                return {
                    "message": "Invalid Inputs Were Provided While Creating A Classroom",
                    "detail": "Please check inputs or contact admin",
                    code: 422
                }
            }
        }
        try {
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows === 0) {
                this.logger.warn("Correct Info Was Provided But No Change Was Made While Inserting Classroom");
                return {"message": "No Classrooms Were Added", detail: "Unable to add new classroom", code: 304}
            }else{
                console.log(rows.insertId);
                const insertID = rows.insertId
                return {"message": "New Classroom Was Added", detail: "We Were Able To Add New Classroom", code: 200, insertID: insertID}
            }
        } catch (error) {
            this.logger.error(error.message);
            return { message: 'Error Adding Classroom', detail: "There was an error adding new classroom", code: 500 };
        }
    }

    /**
     * Function To Add Classroom Relationship For Students
     * @param {number} classroomID Classroom Identification Number
     * @param {number} studentID Student Identification Number
     * @returns Object With A "message", "detail" and "code"
     */
    async #insertClassroomRelation(classroomID, studentID){
        const query = "INSERT INTO convenientedu.classroom_relation (classroomID, userID) VALUES (?, ?)";
        const parameters = [classroomID, studentID];
        try {
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows === 0) {
                this.logger.warn("Correct Info Was Provided But No Change Was Made While Inserting Classroom Relation");
                return {"message": "No Classroom Relation Were Added", detail: "Unable to add new classroom relation", code: 304}
            }else{
                return {"message": "New Classroom Relation Was Added", detail: "We Were Able To Add New Classroom Relation", code: 200, insertID: rows.insertID}
            }
        } catch (error) {
            console.error(error)
            this.logger.error(`${error.message}\n\n\nParameters: ${parameters}`);
            return { message: 'Error Adding Classroom relation', detail: "There was an error adding new classroom relation", code: 500 };
        }
    }

    /**
     * Function To Add Teacher Relation
     * @param {number} teacherID Teacher Identification Number
     * @param {string} subject Subject For The Teacher
     * @returns Object With A "message", "detail" and "code"
     */
    async #insertTeacherRelation(teacherID, subject, manager){
        console.log("TeacherID: ", teacherID);
        console.log("Subject: ", subject)
        this.logger.verbose(`
            Following Values Were Sent For Adding Into Teacher's Relationship
            Teacher ID: ${teacherID}
            Subject: ${subject}
            Manager: ${manager}
            `)
        const query = "INSERT INTO convenientedu.teacherRelation (uid, subject, manager) VALUES (?, ?, ?)";
        const parameters = [teacherID, subject, manager];
        try {
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows === 0) {
                this.logger.warn("Correct Info Was Provided But No Change Was Made While Inserting Teacher Relation");
                return {"message": "No Teacher Relation Were Added", detail: "Unable to add new Teacher relation", code: 304, insertID: -1}
            }else{
                return {"message": "New Teacher Relation Was Added", detail: "We Were Able To Add New Teacher Relation", code: 200, insertID: rows.insertID}
            }
        } catch (error) {
            this.logger.error(error);
            return { message: 'Error Adding Teacher relation', detail: "There was an error adding new Teacher relation", code: 500, insertID: -1};
        }

    }

    /**
     * Function To Add Parent Relation
     * @param {number} parentID Parent Identification Number
     * @param {number} studentID Student Identification Number
     * @returns Object with "message", "detail", "code" and "insertID"
     */
    async #insertParentRelation(parentID, studentID){
        const query = "INSERT INTO convenientedu.parentRelation (Parent_id, Student_id) VALUES (?, ?)";
        const parameters = [parentID, studentID];
        try {
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows === 0) {
                this.logger.warn("Correct Info Was Provided But No Change Was Made While Inserting Parent Relation");
                return {"message": "No Parent Relation Were Added", detail: "Unable to add new Parent relation", code: 304, insertID: -1}
            }else{
                return {"message": "New Parent Relation Was Added", detail: "We Were Able To Add New Parent Relation", code: 200, insertID: rows.insertID}
            }
        } catch (error) {
            this.logger.error(error);
            return { message: 'Error Adding Parent relation', detail: "There was an error adding new Parent relation", code: 500, insertID: -1};
        }

    }

    /**
     * 
     * @param {number} teacherID Teacher Identity Number
     * @param {number} day Day you want to add time in
     * @param {string} time Time you want to add in the day
     * @returns Object with message, detail, code and error
     */
    async #insertWorkingHour(teacherID, day, time){
        this.logger.verbose("Trying to add working hour")
        const validation = new validations()
        let validTime = validation.validateTime(time)
        
        const query = `INSERT INTO convenientedu.teacherWorkingTime (uid, day, time) VALUES (?,?,?);`;
        const parameters = [teacherID, day, time];
        try {
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows === 0) {
                this.logger.warn("Correct Info Was Provided But No Change Was Made While Inserting Parent Relation");
                throw new Error("No Change Was Made Without Error");
            }else{
                console.log("Working Hour Added")
                return {"message": "New Parent Relation Was Added", detail: "We Were Able To Add New Parent Relation", code: 200, insertID: rows.insertID}
            }
        } catch (error) {
            this.logger.error(error);
            throw error
        }
    }

    /**
     * Function to add working times for each days
     * @param {number} teacherID Teacher Identity Number
     * @param {Array} monday Times Allowed For Monday
     * @param {Array} tuesday Times Allowed For Tuesday
     * @param {Array} wednesday Times Allowed For Wednesday
     * @param {Array} thursday Times Allowed For Thursday
     * @param {Array} friday Times Allowed For Friday
     * @param {Array} saturday Times Allowed For Saturday
     * @param {Array} sunday Times Allowed For Sunday
     * @returns Response For message, detail and code
     */
    async #insertWorkingHours(teacherID, monday = [], tuesday = [], wednesday = [], thursday = [], friday = [], saturday = [], sunday = []) {
        this.logger.verbose("Trying to initiate working hours");
        try {
            // Map days to their corresponding values
            const days = [
                { name: "Monday", value: 0, hours: monday },
                { name: "Tuesday", value: 1, hours: tuesday },
                { name: "Wednesday", value: 2, hours: wednesday },
                { name: "Thursday", value: 3, hours: thursday },
                { name: "Friday", value: 4, hours: friday },
                { name: "Saturday", value: 5, hours: saturday },
                { name: "Sunday", value: 6, hours: sunday }
            ];
    
            // Iterate over each day and insert working hours
            for (const day of days) {
                this.logger.verbose(`Starting To Add ${day.name}`);
                for (const hour of day.hours) {
                    const resp = await this.#insertWorkingHour(teacherID, day.value, hour);
                    if (resp.code !== 200) {
                        return resp; // Stop execution and return error response
                    }
                }
            }
    
            // Return success response after all days have been processed
            return {
                message: "Working Hours Added Successfully",
                detail: "We Were Able To Add Working Hours",
                code: 200,
                insertID: 0
            };
        } catch (error) {
            this.logger.error("Error Adding Working Hours", error);
            return {
                message: "Working Hours Were Not Added Successfully",
                detail: "We Were Unable To Add Working Hours",
                code: 304,
                insertID: 0
            };
        }
    }
    
    /**
     * Get list of managers and then select one from them
     * @returns ID object for the manager
     */
    async #getManager() {
        const query = `SELECT id FROM convenientedu.users WHERE usertype='MANAGER'`;
        try {
            const [rows] = await this.pool.execute(query);
    
            if (rows.length === 0) {
                return {message: "No managers found", detail: "No records match the criteria", code: 404};
            }
            console.log(rows)
            // Select a random item from rows
            const randomManager = rows[Math.floor(Math.random() * rows.length)];
            console.log("Random Manager")
            console.log(randomManager);
            const managersx = randomManager["id"]
            return {message: "Manager found", detail: "We Found The Manger", code: 200, managerID: managersx};
        } catch (error) {
            return {message: "Unable To Find Manager", detail: "There was an error getting manager", code: 400};
        }
    }
    
    async #addParentToSupportPaymentTable(parentID){
        try {
            const query = 'INSERT INTO convenientedu.number_of_payed_classes (parentID) VALUES (?)';
            const param = [parentID];
            const [rows] = await this.pool.query(query, param);
            return {
                message: "Parent Added",
                detail: "We were successfully able to add parent to payment table",
                code: 200
            }
        } catch (error) {
            this.logger.error(error.message);
            console.error(error);
            if (String(error.message).split(" ").indexOf("Duplicate") >= 0) {
                return {
                    message: "Parent Already Included",
                    detail: "No need to add parent to payment table again",
                    code: 200
                }
            }

            if (String(error.message).includes("User is not a parent")) {
                return {
                    message: "Parent NOT Added",
                    detail: "User is not a parent",
                    code: 500
                }
                
            }

            return {
                message: "Parent NOT Added",
                detail: "We were not able to add parent to support payment table",
                code: 500
            }
        }
    }

    /**
     * Function to create a new support student
     * @param {string} username Username of the new Support Student
     * @param {string} firstname Firstname of the new Student 
     * @param {string} lastname Lastname of the new support student
     * @param {string} usertype User Type of the new support student
     * @param {string} password Unhashed password for new student
     * @param {string} country Two letter code for the country
     * @param {number} parentID Parent Identity Number
     * @returns object with message, detail and code
     */
    async createNewStudentForSupport(
        username,
        firstname,
        lastname,
        password,
        country,
        parentID,
        classname = ""
    ) {
        try {
            await this.pool.execute("SET @TRIGGER_DISABLED = TRUE;")
            try {
                const response = await this.#addParentToSupportPaymentTable(parentID)
            } catch (error) {
                if (String(error.message).includes("Duplicate entry")) {
                    
                }else{
                    return {
                        message: "Unable to add parent to payment table",
                        detail: "We were unable to add parent to payment table",
                        code: 500
                    }
                }
            }

            // Check if username already exists
            const checkUsername = await this.checkUsername(username);
            if (checkUsername) {
                // Get a random manager
                let manager = await this.#getManager();
                console.log("ManagerL : ", manager)
                if (manager.code !== 200) {
                    return { 
                        message: "Unable to assign manager", 
                        detail: manager.detail, 
                        code: 500 
                    };
                }
                manager = manager.managerID

    
                console.log("Manager Acquired")

                // Step 1: Insert the user
                const response1 = await this.#insertUser(username, firstname, lastname, "STUDENT", password, country);
                if (response1.code !== 200) {
                    return response1; // Return immediately if this step fails
                }
                console.log("User Inserted")

                // Step 2: Insert parent-student relationship
                const response2 = await this.#insertParentRelation(parentID, response1.insertID);
                if (response2.code !== 200) {
                    return response2; // Return immediately if this step fails
                }
                console.log("Parent Relationship Inserted")

                // Step 3: Create a classroom
                let classroomName = (classname === "") ? `${username}_SupportClass` : classroomName
                if (String(classroomName).length > 25) {
                    const newFirstname =  firstname.length > 13 ? firstname.substring(0, 13) : firstname;
                    classroomName = `${newFirstname}_SupportClass`
                }
                const response3 = await this.insertClassroom(classroomName, 1, manager, "SUPPORT", parentID);
                if (response3.code !== 200) {
                    return response3; // Return immediately if this step fails
                }
                console.log("Classroom Added")
                console.log(response3)

                // Step 4: Add student to the classroom
                const response4 = await this.#insertClassroomRelation(response3.insertID, response1.insertID);
                if (response4.code !== 200) {
                    return response4; // Return immediately if this step fails
                }
                console.log("Classroom Relationship Made")

                // Log success and return
                this.logger.info("New Support Student Added");
                return {
                    message: "Support student created successfully",
                    detail: "All operations completed successfully",
                    code: 201,
                    insertID: response1.insertID,
                };
            } else {
                // Username already exists
                return {
                    message: "Username Already Found",
                    detail: "We were unable to create a new user because the username already exists",
                    code: 409,
                    insertID: -1,
                };
            }
        } catch (error) {
            
            console.error(error);
            this.logger.error(error);
            return {
                message: "We were unable to create support student",
                detail: "An unexpected error occurred while adding a new support student",
                code: 500,
            };
        } finally {
            await this.pool.execute("SET @TRIGGER_DISABLED = FALSE;")
        }
    }
    
    /**
     * 
     * @param {string} username Username of the new general student
     * @param {string} firstname Firstname of the new general student
     * @param {string} lastname Lastname of the new general student
     * @param {string} usertype Usertype of the new general student (OVERWRITTEN)
     * @param {string} password Unhashed Password For The New General Student
     * @param {string} country Country Code
     * @param {number} parentID Parent Identity Number
     * @param {number} classroomID Classroom Number
     * @returns 
     */
    async createNewStudentForGeneral(
        username,
        firstname,
        lastname,
        password,
        country,
        parentID,
        classroomID

    ){
        try {
            await this.pool.execute("SET @TRIGGER_DISABLED = TRUE;")
            // Check if username already exists
            const checkUsername = await this.checkUsername(username);
            if (checkUsername) {
                // Get a random manager
                let manager = await this.#getManager();
                if (manager.code !== 200) {
                    return { 
                        message: "Unable to assign manager", 
                        detail: manager.detail, 
                        code: 500 
                    };
                }
                manager = manager.managerID.id

    
                console.log("Manager Acquired")

                // Step 1: Insert the user
                const response1 = await this.#insertUser(username, firstname, lastname, "STUDENT", password, country);
                if (response1.code !== 200) {
                    return response1; // Return immediately if this step fails
                }
                console.log("User Inserted")

                // Step 2: Insert parent-student relationship
                const response2 = await this.#insertParentRelation(parentID, response1.insertID);
                if (response2.code !== 200) {
                    return response2; // Return immediately if this step fails
                }
                console.log("Parent Relationship Inserted")


                // Step 4: Add student to the classroom
                const response4 = await this.#insertClassroomRelation(classroomID, response1.insertID);
                if (response4.code !== 200) {
                    return response4; // Return immediately if this step fails
                }
                console.log("Classroom Relationship Made")

                // Log success and return
                this.logger.info("New Support Student Added");

                const paymentValueSetter = await this.#insertIntoPaymentForStudentGeneral(parentID, response1.insertID);
                if (paymentValueSetter) {
                    
                } else {
                    return {
                        message: "We were not able to add student for payment table",
                        detail: "We were not able to setup payments",
                        code: 400
                    }
                }

                return {
                    message: "Support student created successfully",
                    detail: "All operations completed successfully",
                    code: 201,
                    insertID: response1.insertID,
                };
            } else {
                // Username already exists
                return {
                    message: "Username Already Found",
                    detail: "We were unable to create a new user because the username already exists",
                    code: 409,
                    insertID: -1,
                };
            }
        } catch (error) {
            
            console.error(error);
            this.logger.error(error);
            return {
                message: "We were unable to create support student",
                detail: "An unexpected error occurred while adding a new support student",
                code: 500,
            };
        } finally {
            await this.pool.execute("SET @TRIGGER_DISABLED = FALSE;")
        }

    }

    /**
     * 
     * @param {string} username Username For The New Parent
     * @param {string} firstname Firstname For The New Parent
     * @param {string} lastname Lastname of the new Parent
     * @param {string} password Unhashed Password
     * @param {string} country Two Char Country Code
     * @returns 
     */
    async createNewParent(username, firstname, lastname, password, country){
        const checkUsername = await this.checkUsername(username);
        const usertype = "PARENT"
        if (checkUsername) {
            console.log("Inserting Parent")
            const response = await this.#insertUser(
                username,
                firstname,
                lastname, 
                usertype,
                password,
                country
            )
            return response;
        }else{
            return {"message": "Username Already Found", detail: "We Were Unable To New User Because There Is Already A User With Same Username", code: 304, insertID: -1}
        }
    }


    getSubjectList(){
        let sub = [
            "Mathematics",
            "English",
            "Biology",
            "Chemistry",
            "Physics",
            "History",
            "Geography",
            "Economics",
            "Computer Science",
            "Physical Education",
            "Literature",
            "Psychology",
            "Business Studies",
            "Environmental Science",
            "Health Education",
            "Philosophy"
        ]

        let output = [];
        sub.forEach(element => {
            element = String(element).toUpperCase();
            output.push(element)
        });
        return output
    }


    /**
     * Creates a new teacher and associates them with their subjects and working hours.
     * 
     * @param {string} username - The unique username for the new teacher.
     * @param {string} firstname - The first name of the teacher.
     * @param {string} lastname - The last name of the teacher.
     * @param {string} usertype - The type of user (e.g., 'teacher').
     * @param {string} password - The password for the teacher's account.
     * @param {string} country - The country of the teacher.
     * @param {Array<string>} subject - A list of subjects the teacher will teach (e.g., ['Math', 'Science']).
     * @param {Array<string>} monday - The teacher's working hours on Monday (e.g., ['9:00-12:00', '14:00-17:00']).
     * @param {Array<string>} tuesday - The teacher's working hours on Tuesday.
     * @param {Array<string>} wednesday - The teacher's working hours on Wednesday.
     * @param {Array<string>} thursday - The teacher's working hours on Thursday.
     * @param {Array<string>} friday - The teacher's working hours on Friday.
     * @param {Array<string>} saturday - The teacher's working hours on Saturday.
     * @param {Array<string>} sunday - The teacher's working hours on Sunday.
     * 
     * @returns {Promise<Object>} - Returns a response object with details about the teacher creation process.
     *   - If successful, includes a message and the teacher's insert ID.
     *   - If a username conflict occurs, includes a warning message and a code 304.
     *   - If an error occurs, returns an error message with a 500 status code.
     * 
     * @throws {Error} - Throws an error if unexpected issues occur during the teacher creation process.
     */
    async createNewTeacher(                
        username = "",
        firstname = "",
        lastname ="", 
        usertype = "",
        password = "",
        country = "",
        subject = [],
        monday = [],
        tuesday = [],
        wednesday = [],
        thursday = [],
        friday = [],
        saturday = [],
        sunday = []
    ){
        try {
            let Subject = [];
            subject.forEach(element => {
                const body = String(element).toUpperCase();
                Subject.push(body)
            });
            const checkUsername = await this.checkUsername(username)
            if (checkUsername) {
                const response1 = await this.#insertUser(
                    username,
                    firstname,
                    lastname, 
                    usertype,
                    password,
                    country
                )
                this.logger.info(response1)
                if (response1.code !== 200) {
                    return response1
                }
                console.log(response1)
                console.log("Added User As Teacher")
                const teacherID = response1.insertID;
                const manager = await this.#getManager();
                for (const element of Subject) {
                    const managerID = manager.managerID;
                    console.log(managerID)
                    this.logger.verbose((teacherID, element, managerID))
                    let response2 = await this.#insertTeacherRelation(teacherID, element, managerID);
                    if (response2.code !== 200) {
                        this.logger.error("There Was An Error Adding Teacher Relationship");
                        return response2; // Stops the function and returns the response
                    }
                }
                
                await this.#insertWorkingHours(teacherID, monday, tuesday, wednesday, thursday, friday, saturday, sunday);
                return {"message": "New User Created", detail: "We were able to create new teacher", code: 200, insertID: response1.insertID}
            }else{
                this.logger.warn("Duplicate Username Detected")
                return {"message": "Username Already Found", detail: "We Were Unable To New User Because There Is Already A User With Same Username", code: 304, insertID: -1}
            }    
        } catch (error) {
            console.error(error);
            this.logger.error(error.message);
            return {
                message: "We were unable to create new teacher",
                detail: "An unexpected error occurred while adding a new teacher",
                code: 500,
            };
        }
    }

    getCountryList() {
        return {
            "United States": "US",
            "India": "IN",
            "United Kingdom": "GB",
            "Canada": "CA",
            "Australia": "AU",
            "Ireland": "IE",
            "New Zealand": "NZ",
            "Pakistan": "PK",
            "Singapore": "SG",
            "Malaysia": "MY",
            "Barbados": "BB",
            "Saint Kitts and Nevis": "KN"
        }
    }

    async checkUsername(username){
        const query = 'SELECT count(*) FROM convenientedu.users WHERE username =? ';
        const parameters = [username];

        try {
            const [rows] = await this.pool.execute(query, parameters);
            const count = rows[0]["count(*)"];
            if (count > 1) {
                this.logger.warn(`Somehow There Are More Than One Users With Username: ${username}`)
            }
            if (count > 0) {
                return false
            }else {
                return true
            }
        } catch (error) {
            this.logger.error(`Error Checking Usernames: ${error.message}`)
        }
    }

    /**
     * Gets Permission Object For User Type
     * @param {string} usertype Type of user
     * @returns Permission Object
     */
    async #GeneralPermissionRecord(usertype){
        const defaultPermissions = {
            PARENT: {
                allowsUserInsertion: true,
                insertableUserType: ["STUDENT"],
                allowsClassInsertion: true,
                insertableClassType: ["SUPPORT"],
                insertableClassroomType: ["SUPPORT"],
                allowsCancellation: true,
                allowsJoining: true,
                allowsClassroomInsertion: true,
            },
            STUDENT: {
                allowsUserInsertion: false,
                insertableUserType: [],
                allowsClassInsertion: false,
                insertableClassType: [],
                insertableClassroomType: [],
                allowsCancellation: true,
                allowsJoining: true,
                allowsClassroomInsertion: false,
            },
            TEACHER: {
                allowsUserInsertion: false,
                insertableUserType: [],
                allowsClassInsertion: false,
                insertableClassType: [],
                insertableClassroomType: [],
                allowsCancellation: true,
                allowsJoining: true,
                allowsClassroomInsertion: false,
            },
            ADMIN: {
                allowsUserInsertion: true,
                insertableUserType: ["STUDENT", "MANAGER", "TEACHER", "ADMIN", "PARENT"],
                allowsClassInsertion: true,
                insertableClassType: ["SUPPORT", "GENERAL"],
                insertableClassroomType: ["SUPPORT", "GENERAL"],
                allowsCancellation: true,
                allowsJoining: true,
                allowsClassroomInsertion: true,
            },
            MANAGER: {
                allowsUserInsertion: false,
                insertableUserType: [],
                allowsClassInsertion: true,
                insertableClassType: ["SUPPORT", "GENERAL"],
                insertableClassroomType: [],
                allowsCancellation: true,
                allowsJoining: true,
                allowsClassroomInsertion: false,
            }
        };

        // Check if the usertype exists in defaultPermissions
        if (defaultPermissions[usertype]) {
            return defaultPermissions[usertype];
        }

        throw new Error("Invalid Usertype")
    }

    async #getCostOfGeneralClass(){
        return 120
    }

    async #insertIntoPaymentForStudentGeneral(parentID, studentID, paymentValue = 0) {
        try {
            if (paymentValue === 0) {
                paymentValue = await this.#getCostOfGeneralClass();
            }
            // SQL query to insert data
            const query = `
                INSERT INTO convenientedu.feePayedForGeneralClassesTill (parentID, studentID, payedTill, paymentValue)
                VALUES (?, ?, ?, ?)
            `;
    
            // Get the current date and add 2 days
            const currentDate = new Date();
            currentDate.setDate(currentDate.getDate() + 2);
    
            // Format as YYYY-MM-DD
            const formattedDate = currentDate.toISOString().split('T')[0];
    
            // Prepare the parameters for the query
            const params = [parentID, studentID, formattedDate, paymentValue];
    
            // Execute the query (await is necessary for async operations)
            const [rows] = await this.pool.execute(query, params);
    
            // Return true if rows were affected, else false
            return rows.affectedRows > 0;
        } catch (error) {
            // Log errors and return false
            this.logger.error("Error For #insertIntoPaymentForStudentGeneral");
            this.logger.error(error.message);
            console.error(error);
            return false;
        }
    }
    
    async createNewManager(
        username, firstname, lastname, password, country
    ){
        const checkUsername = await this.checkUsername(username);
        const usertype = "MANAGER"
        if (checkUsername) {
            const response = await this.#insertUser(
                username,
                firstname,
                lastname, 
                usertype,
                password,
                country
            )
            return response;
        }else{
            return {"message": "Username Already Found", detail: "We Were Unable To New User Because There Is Already A User With Same Username", code: 304, insertID: -1}
        }

    }

    async createNewAdmin(
        username, firstname, lastname, password, country
    ){
        const checkUsername = await this.checkUsername(username);
        const usertype = "ADMIN"
        if (checkUsername) {
            const response = await this.#insertUser(
                username,
                firstname,
                lastname, 
                usertype,
                password,
                country
            )
            return response;
        }else{
            return {"message": "Username Already Found", detail: "We Were Unable To New User Because There Is Already A User With Same Username", code: 304, insertID: -1}
        }

    }

}

module.exports = Users;
