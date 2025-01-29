const mysql = require('mysql2/promise');  // Ensure proper import
const winston = require('winston');
const argon = require('argon2');
const validation = require("./validations");
const jwt = require("jsonwebtoken");
const Users = require('./users');
const { Date_Time } = require("./helper.js")

class portal {
    constructor(pool, logger, uid = 0, userType = "") {
        this.pool = pool;
        this.logger = logger;
        this.checkConnection();
        this.subjectList = new Users(this.pool, this.logger).getSubjectList();
        this.dayMap = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
        this.uid = uid;
        this.lateTolerance = 10
        this.usertype = userType;
    }

    /**
     * Basic Function To Check Connection
     */
    async checkConnection() {
        try {
            const [rows] = await this.pool.execute('SELECT 1');
            this.logger.verbose("SQL connection established");
        } catch (err) {
            console.error('Error connecting to the database:', err);
            this.logger.error('SQL connection failed');
        }
    }

    /**
     * Function To Get Classroom IDS For a Student
     * @param {number} uid User Identity Number For Students
     * @param {string} username Username For Student
     * @returns {Array} List For Classrooms
     */
    async #getClassroomIdsForStudents(uid = 0, username = "") {
        try {
            const query = 'SELECT c.id from convenientedu.classrooms c INNER JOIN convenientedu.classroom_relation cr ON cr.classroomID = c.id INNER JOIN convenientedu.users u ON u.id = cr.userID WHERE u.id = ? OR u.username = ? '
            const param = [uid, username];
            const [rows] = await this.pool.execute(query, param);
            let classrooms = []
            rows.forEach(element => {
                classrooms.push(element.id)
            });
            return classrooms || null    
        } catch (error) {
            this.logger.error(error.message);
            return null
        }
    }

    /**
     * Function To Get All Classrooms Where User Identity Number (Type Must Be A Manager)
     * @param {number} uid User Identity Number For Manager
     * @returns {Array} Contains List Of Classrooms
     */
    async #getClassroomIdsForManager(uid = 0) {
        try {
            const usertype = await this.#getPersonType(uid);
            if (usertype !== "MANAGER") {
                throw new Error("Usertype Is Not A Manager");
            }
            const query = 'SELECT c.id from convenientedu.classrooms c WHERE c.managerID = ?'
            const param = [uid];
            const [rows] = await this.pool.execute(query, param);
            let classrooms = []
            rows.forEach(element => {
                classrooms.push(element.id)
            });
            return classrooms || null    
        } catch (error) {
            this.logger.error(error.message);
            return null

        }
    }

    /**
     * Function to get classroom ids for parent
     * @param {number} uid User Identity Number
     * @param {string} username Unique Username
     * @returns List Of Classrooms
     */
    async #getClassroomIdsForParent(uid = 0, username = "") {
        try {
            const query = `SELECT c.id FROM convenientedu.classrooms c 
                INNER JOIN convenientedu.classroom_relation cr ON cr.classroomID = c.id 
                INNER JOIN convenientedu.users u ON cr.userID = u.id
                INNER JOIN convenientedu.parentRelation pr ON pr.Student_id = u.id
                INNER JOIN convenientedu.users u2 ON pr.Parent_id = u2.id
                WHERE pr.Parent_id = ? or c.parentID  = ? OR u2.username = ?
                ;`
            const param = [uid, uid, username];
            const [rows] = await this.pool.execute(query, param);
            let classrooms = []
            rows.forEach(element => {
                classrooms.push(element.id)
            });
            return classrooms || null    

        } catch (error) {
            this.logger.error(error.message);
            return null

        }
        
    }

    /**
     * This function fetches name for the user id
     * @param {number} uid User Identity Number
     * @returns Person Name From UID
     */
    async #getPersonName(uid = 0){
        try {
            const query = "SELECT first_name, last_name FROM convenientedu.users WHERE id = ?";
            const params = [uid];
            const [rows] = await this.pool.execute(query, params);
            const firstname = rows[0].first_name;
            const lastname = rows[0].last_name;
            return `${firstname} ${lastname}`
    
        } catch (error) {
            console.log(error)
            this.logger.error("Error Getting Person Name");
            this.logger.error(error.message);
            return ""
        }
    }

    /**
     * Function to get the usertype of a person using uid
     * @param {number} uid User Identity Number
     * @returns user type
     */
    async #getPersonType(uid = 0){
        try {
            const query = "SELECT usertype FROM convenientedu.users WHERE id = ?";
            const params = [uid];
            const [rows] = await this.pool.execute(query, params);
            console.log("Rows When Getting Person Type: ");
            console.log(rows)
            const usertype = rows[0].usertype;
            return usertype
    
        } catch (error) {
            console.log(error)
            this.logger.error("Error Getting Person UserType");
            this.logger.error(error.message);
            return ""
        }
    }

    /**
     * Function to get the timetable for a student using the uid and checks if we want it for today or all time
     * @param {number} uid User Identity Number
     * @param {boolean} today Check if the timetable is for today
     * @returns timetable
     */
    async #getTimetableForStudent(uid = 0, today= false){
        const classroomID = await this.#getClassroomIdsForStudents(uid);

        // Create a string of question marks for each ID in the array
        const placeholders = classroomID.map(() => '?').join(', ');
        const todayDay = parseInt((new Date().getDay() + 6) % 7)
        const todayCode = today ? ` AND (t.date = CURDATE() OR t.day = ${todayDay})` : ""; // Only include condition if today is true
        const [rows] = await this.pool.execute(`
            SELECT c.classType AS "classtype", c.id AS "classroom", t.date, t.day, t.time, 
                   CONCAT(u.first_name, " ", u.last_name) AS teacher, t.className AS subject 
            FROM convenientportal.timetable t
            INNER JOIN convenientedu.users u ON u.id = t.teacherID 
            INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID 
            WHERE t.classroomID IN (${placeholders})${todayCode};
        `, classroomID);
        
        return [rows];
    
    }

    /**
     * Function to get the students for the parent
     * @returns {Array} List of students
     */
    async #GetStudentsForParent(){
        const query = `SELECT DISTINCT u.id, CONCAT(u.first_name, " ",  u.last_name) 
                    AS 'name' FROM convenientedu.users u INNER JOIN 
                    convenientedu.parentRelation pr ON pr.Student_id = u.id WHERE pr.Parent_id = ?;`
        const [rows] = await this.pool.execute(query, [this.uid]);
        return rows

    }   

    /**
     * Get Students For The Manager
     * @returns {Array} List of students
     */
    async #GetStudentsForManager(){
        const query = `
        SELECT DISTINCT u.id, CONCAT(u.first_name, " ",  u.last_name) AS 'name' 
        FROM convenientedu.users u 
        INNER JOIN convenientedu.classroom_relation cr 
        ON cr.userID = u.id 
        INNER JOIN convenientedu.classrooms c 
        ON c.id = cr.classroomID 
        WHERE c.managerID = ? ;
        `;
        const [rows] = await this.pool.execute(query, [this.uid]);
        return rows

    }

    /**
     * Function to get all the teachers that are related to the students of the parent
     * @returns {Array} List of students
     */
    async #GetTeacherForParent(){
        const query = `
            SELECT DISTINCT tr.subject, u.id, CONCAT(u.first_name, " ",  u.last_name) AS 'name' FROM convenientedu.parentRelation pr
            INNER JOIN convenientedu.classroom_relation cr ON cr.userID = pr.Student_id 
            RIGHT JOIN convenientportal.timetable t ON t.classroomID = cr.classroomID 
            INNER JOIN convenientedu.users u ON u.id = t.teacherID 
            INNER JOIN convenientedu.teacherRelation tr ON t.teacherID  = tr.uid 
            WHERE pr.Parent_id = ?
            ;
        `;
        const [rows] = await this.pool.execute(query, [this.uid]);
        return rows

    }

    /**
     * Get Teacher That Are Connect To The Manager In Any Way
     * @returns {Array} List of students
     */
    async #GetTeacherForManager(){
        const query = `
            SELECT DISTINCT CONCAT(u.first_name, " ",  u.last_name) AS 'name', u.id, tr.subject FROM convenientedu.parentRelation pr
            INNER JOIN convenientedu.classroom_relation cr ON cr.userID = pr.Student_id 
            INNER JOIN convenientedu.classrooms c ON cr.classroomID = c.id 
            RIGHT JOIN convenientportal.timetable t ON t.classroomID = cr.classroomID 
            INNER JOIN convenientedu.users u ON u.id = t.teacherID 
            INNER JOIN convenientedu.teacherRelation tr ON t.teacherID  = tr.uid 
            WHERE c.managerID = ? OR tr.manager = ?
            ;
        `
        const [rows] = await this.pool.execute(query, [this.uid, this.uid]);
        return rows

    }

    /**
     * Get Teacher For Admin
     * @returns {Array} List of students
     */
    async #GetTeacherForAdmin(){
        const query = `
            SELECT DISTINCT CONCAT(u.first_name, " ",  u.last_name) AS 'name', u.id, tr.subject FROM convenientedu.parentRelation pr
            INNER JOIN convenientedu.classroom_relation cr ON cr.userID = pr.Student_id 
            INNER JOIN convenientedu.classrooms c ON cr.classroomID = c.id 
            RIGHT JOIN convenientportal.timetable t ON t.classroomID = cr.classroomID 
            INNER JOIN convenientedu.users u ON u.id = t.teacherID 
            INNER JOIN convenientedu.teacherRelation tr ON t.teacherID  = tr.uid 
            ;
        `
        const [rows] = await this.pool.execute(query);
        return rows

    }

    /**
     * Get Students For Admin
     * @returns {Array} List of students
     */
    async #GetStudentsForAdmin(){
        const query = `
            SELECT DISTINCT u.id, CONCAT(u.first_name, " ",  u.last_name) AS 'name' 
            FROM convenientedu.users u 
            INNER JOIN convenientedu.classroom_relation cr 
            ON cr.userID = u.id 
            INNER JOIN convenientedu.classrooms c 
            ON c.id = cr.classroomID ;        `;
        const [rows] = await this.pool.execute(query);
        return rows
    }

    /**
     * This function will populate the children page in the front end of the portal. It 
     * will check the usertype of the current user and we will use the private function
     * to get the children for the user.
     * @returns {Array} List of students
     */
    async Children(){
        const usertype = this.usertype;
        let children = []
        let teachers = []
        switch (usertype) {
            case "ADMIN":
                children = await this.#GetStudentsForAdmin();
                teachers = await this.#GetTeacherForAdmin();
                return {
                    message: "Children Received",
                    detail: "We were able to query children successfully",
                    code: 200,
                    data: {
                        students: children,
                        teachers: teachers
                    }
                }
            
            case "MANAGER":
                children = await this.#GetStudentsForManager();
                teachers = await this.#GetTeacherForManager();
                return {
                    message: "Children Received",
                    detail: "We were able to query children successfully",
                    code: 200,
                    data: {
                        students: children,
                        teachers: teachers
                    }
                }

            case "PARENT":
                children = await this.#GetStudentsForParent();
                teachers = await this.#GetTeacherForParent();
                return {
                    message: "Children Received",
                    detail: "We were able to query children successfully",
                    code: 200,
                    data: {
                        students: children,
                        teachers: teachers
                    }
                }
                
            default:
                console.log("User Type: ", this.usertype);
                return {
                    message: "Children Query Failed",
                    detail: "We were not able to query children due to invalid inputs",
                    code: 400
                }
        }
    }

    /**
     * Get timetable for all the students that are managed by a certain manager
     * @param {number} uid User Identity Number
     * @param {boolean} today Checks if the request is for today
     * @returns {Array} Timetable Array
     */
    async #getTimetableForManager(uid = 0, today= false){
        const classroomID = await this.#getClassroomIdsForManager(uid);

        // Create a string of question marks for each ID in the array
        const placeholders = classroomID.map(() => '?').join(', ');
        const todayDay = parseInt((new Date().getDay() + 6) % 7)
        const todayCode = today ? ` AND (t.date = CURDATE() OR t.day = ${todayDay})` : ""; // Only include condition if today is true

        try {
            const [rows] = await this.pool.execute(`
                SELECT c.classType AS "classtype", c.id AS "classroom", t.date, t.day, t.time, 
                       CONCAT(u.first_name, " ", u.last_name) AS teacher, t.className AS subject 
                FROM convenientportal.timetable t
                INNER JOIN convenientedu.users u ON u.id = t.teacherID 
                INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID 
                WHERE t.classroomID IN (${placeholders})${todayCode}
    
            `, classroomID);
            return [rows];

    
        } catch (error) {
            this.logger.error("Error Getting Manager")
            this.logger.error(error.message)
            return []
        }
        
    
    
    }

    /**
     * We want to get the timetable for a teacher. We will use the teacher id to get the timetable
     * @param {number} uid User Identity Number
     * @param {boolean} today Check if we want the timetable for today
     * @returns {Array} Timetable Array
     */
    async #getTimetableForTeacher(uid = 0, today= false){
        const todayDay = parseInt((new Date().getDay() + 6) % 7)
        const todayCode = today ? ` AND (t.date = CURDATE() OR t.day = ${todayDay})` : ""; // Only include condition if today is true

        const [rows] = await this.pool.execute(`
            SELECT c.classType AS "classtype", c.id as "classroom", t.date, t.day, t.time, CONCAT(u.first_name, " ", u.last_name) AS teacher, t.className AS subject FROM convenientportal.timetable t
            INNER JOIN convenientedu.users u  ON u.id = t.teacherID 
            INNER JOIN convenientedu.classrooms c ON c.id  = t.classroomID 
            WHERE t.teacherID = ?${todayCode}

            ;

            `, [uid]);
        return [rows]    

    }

    /**
     * Function to get the timetable for a parent. We will use the parent id to get the timetable
     * @param {number} uid User Identity Number
     * @param {boolean} today Check if we want the timetable for today
     * @returns Timetable Array
     */
    async #getTimetableForParent(uid = 0, today= false){
        try {
            const classroomID = await this.#getClassroomIdsForParent(uid);
            const todayDay = parseInt((new Date().getDay() + 6) % 7)
            const todayCode = today ? ` AND (t.date = CURDATE() OR t.day = ${todayDay})` : ""; // Only include condition if today is true
    
            // Create a string of question marks for each ID in the array
            let placeholders = classroomID.map(() => '?').join(', ');
            placeholders = (placeholders.length === 0) ? "0" : placeholders
            const [rows] = await this.pool.execute(`
                SELECT c.classType AS "classtype", c.id AS "classroom", t.date, t.day, t.time, 
                       CONCAT(u.first_name, " ", u.last_name) AS teacher, t.className AS subject 
                FROM convenientportal.timetable t
                INNER JOIN convenientedu.users u ON u.id = t.teacherID 
                INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID 
                WHERE t.classroomID IN (${placeholders})
                ${todayCode}
                ;
            `, classroomID);
    
            
            return [rows];    
    
        } catch (error) {
            this.logger.error(error.message)
            return []
        }
    }

    /**
     * Function to get the timetable for an admin. It will give classes for any and every user
     * @param {boolean} today Check if we want to get the timetable for today
     * @returns Timetable Array
     */
    async #getTimetableForAdmin(today = false) {
        const todayDay = new Date().getDay(); // Get the current day of the week (0-6)
        const todayCode = today ? ` AND (t.date = CURDATE() OR t.day = ${todayDay})` : ""; // Only include condition if today is true
    
        const [rows] = await this.pool.execute(`
            SELECT 
                c.classType AS "classtype", 
                c.id AS "classroom", 
                t.date, 
                t.day, 
                t.time, 
                CONCAT(u.first_name, " ", u.last_name) AS teacher, 
                t.className AS subject 
            FROM convenientportal.timetable t
            INNER JOIN convenientedu.users u ON u.id = t.teacherID 
            INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID
            ${todayCode};
        `);
    
        return [rows];
    }
        

    /**
     * Timetable Page Query Function
     * @param {string} userType Type Of User
     * @param {number} uid User Identification Number
     * @returns object with message, detail, statusCode and data
     */
    async getTimetableAll(userType = "", uid = 0){
        this.logger.verbose("Trying To Get Timetable For A Person")
        userType = String(userType).toUpperCase();
        try {
            if (userType === "MANAGER") {
                const rows =  await this.#getTimetableForManager(uid);
                return {
                    message: "Timetable Received",
                    detail: "We were able to query timetable successfully",
                    code: 200,
                    data: rows
                }
            } else if (userType === "STUDENT") {
                const rows = await this.#getTimetableForStudent(uid);
                return {
                    message: "Timetable Received",
                    detail: "We were able to query timetable successfully",
                    code: 200,
                    data: rows
                }

            } else if ( userType === "TEACHER"){
                const rows = await this.#getTimetableForTeacher(uid);
                return {
                    message: "Timetable Received",
                    detail: "We were able to query timetable successfully",
                    code: 200,
                    data: rows
                }

            } else if (userType === "ADMIN") {
                const rows = await this.#getTimetableForAdmin();
                return {
                    message: "Timetable Received",
                    detail: "We were able to query timetable successfully",
                    code: 200,
                    data: rows
                }
            }else if (userType === "PARENT") {
                const rows = await this.#getTimetableForParent();
                return {
                    message: "Timetable Received",
                    detail: "We were able to query timetable successfully",
                    code: 200,
                    data: rows
                }
            }
            else{
                console.log("User Type: ", userType);
                console.log("User ID: ", uid)
                return {
                    message: "Timetable Query Failed",
                    detail: "We were unable to query timetable due to invalid inputs",
                    code: 404,
                }
            }
        } catch (error) {
            this.logger.error(error.message)
            this.logger.error("Error Getting Timetable")
            console.log(error)
            return {
                message: "Timetable Query Failed",
                detail: "We were not able to query timetable",
                code: 400,
                data: rows
            }
    }
    }

    async CancelClass(token){
        const {
            classroomID,
            historyID,
            timetableID,
            classDate,
            classTime,
            link,
            uid
        } = jwt.verify(token, process.env.OTHER_JWT_SECRET);
        const query = `
            INSERT INTO convenientportal.class_canceled 
            (history_id, uid, TimetableID, classDate, classTime, cancellation_time) 
            VALUES (?, ?, ?, ?, ?, CURTIME());
        `
        const params = [historyID, uid, timetableID, classDate, classTime];
        try {
            const rows = await this.pool.execute(query, params);
            return {
                message: "Class Cancelled",
                detail: "We were able to cancel the class",
                code: 200
            }
        } catch (error) {
            console.error(error);
            return {
                message: "Class Cancellation Failed",
                detail: "We were not able to cancel the class",
                code: 400,
            }
        }
    }

    /**
     * Function to refactor data to make it useable for front end home
     * @param {boolean} cancelled If Class Cancelled
     * @param {string} subject Subject
     * @param {string} classroomName Classroom Name
     * @param {string} link Classroom Link
     * @param {number} id Timetable ID
     * @param {number} year Class Year
     * @param {number} month Class Month
     * @param {number} day Class Day
     * @param {number} hour Class Hour
     * @param {number} min Class Min
     * @param {object} payload Create Object For Payload
     * @returns Refactored Object For Front End Home
     */
    #refactorUseable(cancelled, subject, classroomName, link, id, year, month, day, hour, min, payload){
        console.log(day, month, year, hour, min)
        let dateTime = new Date()
        dateTime.setUTCDate(day);
        dateTime.setUTCFullYear(year);
        dateTime.setUTCMonth(month);
        dateTime.setUTCHours(hour);
        dateTime.setUTCMinutes(min);
        console.log(dateTime);
        try {
            const token = jwt.sign(payload, process.env.OTHER_JWT_SECRET)
            console.log(token)
            return {
                cancelled: cancelled,
                subject: subject,
                dateTime: dateTime,
                classroomName: classroomName,
                link: link,
                id: id,
                token: token
            }    
        } catch (error) {
            this.logger.error(error.message);
            this.error.error("We were not able to refactor data")
            return {}
        }
    }

    /**
     * Function To Get Timetable For Today
     * @param {number} uid User Identity Number
     * @returns Timetable
     */
    async getTimetableForToday(uid = 0){
        try {
            const query = `
            SELECT DISTINCT link, classname AS subject, 
            CURDATE() AS 'classDate', 
            t.time AS 'classTime', 
            c.classroomName AS 'classroomName', 
            t.classID AS 'id', 
            cc.cancellation_time AS 'cancelled',
            ch.id AS 'historyID',
            t.classID as 'TimetableID',
            t.classroomID as 'classroomID'
            FROM convenientportal.timetable t 
            INNER JOIN convenientportal.class_history ch ON ch.timetableID = t.classID
            INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID
            LEFT JOIN convenientportal.class_canceled cc ON cc.history_id = ch.id
            WHERE 
            (t.day = ? OR t.date = CURDATE() )
            AND (
                c.managerID = ? -- Manager
                OR
                c.parentID = ? -- Parent
                OR
                (t.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation WHERE userID = ?)) -- Student
                OR 
                (t.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation cr INNER JOIN convenientedu.parentRelation pr ON cr.userID = pr.Student_id WHERE pr.Parent_id = ?)) -- Parent For General Classes
                OR 
                t.teacherID = ?
                OR 
                "ADMIN" IN (SELECT usertype FROM convenientedu.users u WHERE u.id = ?) -- ADMIN
            )
            ;         
               `
            const currentDay = (new Date().getDay() === 0) ? 6 : new Date().getDay() - 1;
            const [rows] = await this.pool.execute(query, [currentDay, uid, uid, uid, uid, uid, uid]);
            this.logger.verbose("Get Timetable For Today", ([uid, uid, uid, uid, uid, uid]))
            this.logger.verbose(rows);
            const UniqueTimetableIdSet = new Set()
            let output = []
            rows.forEach(element => {
                if (UniqueTimetableIdSet.has(element.TimetableID)) {
                    return
                }
                const cancelled = (element.cancelled === null) ? false : true
                const date = String(new Date(element.classDate).toISOString()).split("T")[0];
                this.logger.verbose("Date Object: ", date)
                const year = String(date).split("-")[0];
                const month = String(date).split("-")[1] - 1;
                const day = String(date).split("-")[2];
                const time = String(element.classTime);
                const hour = String(time).split(":")[0];
                const min = String(time).split(":")[1];
                const formattedClassdate = String(new Date(element.classDate).toISOString()).split("T")[0]
                this.logger.verbose("Formatted Class date: ", formattedClassdate)
                const tokenData = {
                    classroomID: element.classroomID,
                    historyID: element.historyID,
                    timetableID: element.TimetableID,
                    classDate: formattedClassdate,
                    classTime: element.classTime,
                    link: element.link,
                    uid: uid
                };
                this.logger.verbose("Token Data:")
                this.logger.verbose(tokenData)
                const data = this.#refactorUseable(cancelled, element.subject, element.classroomName, "", element.id,
                    year, month, day, hour, min, tokenData
                )
                output.push(data)
                UniqueTimetableIdSet.add(element.TimetableID)
            });
            this.logger.verbose("Output: ", output)
            return output
        } catch (error) {
            console.log(error);
            this.logger.error("Error While Getting Timetable For Today");
            this.logger.error(error.message);
            return []
        }
    }

    /**
     * Function to get working hours
     * @param {boolean} all Do we want to get all working hours, and ignore teacher array
     * @param {Array} teachers The list of teacher id for which we want to get the working hours.
     * @returns {Array} List of working hours
     */
    async #getAllWorkingHours(all = false, teachers = []){
        try {
            if (!all){
                const query = 'SELECT * FROM convenientedu.teacherWorkingTime ';
                const [rows] = await this.pool.execute(query);
                return rows    
            }else{
                const query = 'SELECT * FROM convenientedu.teacherWorkingTime ';
                let teacherSyntax = ''
                for (let index = 0; index < teachers.length; index++) {
                    const teacherID = teachers[index];
                    const nextIsLast = ((teachers.length - index) === 1) ? true : false;
                    teacherSyntax += String(teacherID)
                    if (!nextIsLast) {
                        teacherSyntax += ", "
                    }
                }
                console.log(teacherSyntax)
                const [rows] = await this.pool.execute(query);
                console.log(rows)
                return rows    
            }
    
        } catch (error) {
            console.error("Error Getting Working Hours");
            console.error(error)
            
        }
    }

    /**
     * Function to remove the already used classes from the working hours.
     * @param {Array} allWorkingTimes All Working Time
     * @returns {Array} Usable Working Hours
     */
    async #getUsableWorkingHours(allWorkingTimes = []) {
        try {
            const query = 'SELECT day, date, time, teacherID as uid FROM convenientportal.timetable t;';
            const [rows] = await this.pool.execute(query);
            console.log("Get Working Times: ");
            console.log(rows)
            let workingHoursMaxima = new Array()
            rows.forEach(row => {
                row.date = (row.date === null) ? null : new Date(new Date(row.date).setDate(new Date(row.date).getDate() + 1));
                const dayForDate = new Date(row.date).getUTCDay() === 0 ? 6 : new Date(row.date).getUTCDay() - 1;
                console.log("Date Day => ", row.date, dayForDate, row.day, new Date(row.date).getDay())
                const Maxima = `D${((Number.isInteger(row.day))? String(row.day) : false) || dayForDate}T${row.time}U${row.uid}`;
                console.log("Maxima: ", Maxima);
                workingHoursMaxima.push(Maxima);
            });
            console.log(workingHoursMaxima);
            const workingHoursRefined = new Array()
            allWorkingTimes.forEach((time) => {
                const maximux = `D${time.day}T${time.time}U${time.uid}`
                console.log("Full Tag For Times: ", maximux);
                if (workingHoursMaxima.includes(maximux)) {
                    console.log("Leaving Time", time);
                }else{
                    workingHoursRefined.push(time);
                }
            })
        
            return workingHoursRefined;    
        } catch (error) {
            console.error("error");
            console.log(error)
        }
    }
    
    
    async #getAllSubjectTeachers(){
        const query = 'SELECT * FROM convenientedu.teacherRelation tr INNER JOIN convenientedu.users u ON u.id = tr.uid ';
        const [rows] = await this.pool.execute(query);
        console.log(rows)
        return rows
    }

    async #getTeacherInfoForSubject(subject, teacherData, workingHours){
        subject = String(subject).toUpperCase()
        if (!this.subjectList.includes(subject)) {
            throw new Error("Invalid Subject");
        }
        let subjectObject = {
            name: String(subject).charAt(0).toUpperCase() + String(subject).slice(1).toLowerCase(),
            teachers: []
        }

        let teacherObject;

        teacherData.forEach(element => {
            if (element.subject === subject) {
                teacherObject = {}
                teacherObject = {
                    id: element.uid,
                    name: element.username,
                    workingHours: []
                }
                for (let index = 0; index < 6; index++) {
                    const day = this.dayMap[index];
                    let workingObject = {
                        day: day,
                        id: index,
                        time: []
                    }
                    workingHours.forEach(elementx => {
                        if(elementx.uid === element.uid && elementx.day === index){
                            workingObject.time.push(String(elementx.time))
                        }
                    }); 
                    if (workingObject.time.length > 0) {
                        teacherObject.workingHours.push(workingObject)       
                    }
                }
                subjectObject.teachers.push(teacherObject)
                    
            }

        });
        return subjectObject
    }


    async #getSubjectNameAndTeachers(){
        try {
            let subjectTeacherBody = []
            const teacherData = await this.#getAllSubjectTeachers()
            let workingHours = await this.#getAllWorkingHours()
            workingHours = await this.#getUsableWorkingHours(workingHours);
            console.log("Working Hours Look Like:", workingHours)
            const subjects = new Users(this.pool, this.logger).getSubjectList();
            for (let index = 0; index < subjects.length; index++) {
                const element = subjects[index];
                const subjectInfoBox = await this.#getTeacherInfoForSubject(element, teacherData, workingHours);
                if (subjectInfoBox.teachers.length > 0) {
                    subjectTeacherBody.push((subjectInfoBox))    
                }
            }    
            return subjectTeacherBody
        } catch (error) {
            console.log(error)
            return []
        }
    }

    async #getClassroomForClassInsertionPage(){
        const query = `
        SELECT c.id AS "id", c.classroomName AS "classroomName" FROM  convenientedu.classrooms c 
        INNER JOIN convenientedu.classroom_relation cr ON c.id  = cr.classroomID 
        INNER JOIN convenientedu.parentRelation pr ON pr.Student_id = cr.userID 
        WHERE cr.userID = ? -- Student
        OR 
        (pr.Parent_id = ? OR c.parentID = ?) -- Parent
        OR 
        c.managerID  = ? -- Manager
        OR 
        "ADMIN" IN (SELECT usertype FROM convenientedu.users u WHERE u.id = ?);
        `
        const params = [this.uid, this.uid, this.uid, this.uid, this.uid]
        const [rows] = await this.pool.execute(query, params);
        const mainData = []
        rows.forEach(row => {
            const dataRow = {classroomName: row.classroomName, classroomID: row.id}
            mainData.push(dataRow)
        });
        return mainData
    }

    async #getPayedForSupportClassesValue(){
        const payed = await this.getNumberOFfeePayedSupportClasses(this.uid)
        console.log("Payed: ", payed)
        return payed.data
    }

    async #GetDetailAboutUserFromReports(){
        console.log("Trying to get reports")
        const query = `
                        SELECT DISTINCT cj.joiningTime, cc.cancellation_time, ch.classTime, cc.uid 'cancellerID',
                        ch.id 'historyID', ch.teacherID , c.managerID, c.classType, t.className, cr.userID 'STUDENTID',
                        c.classroomName, teacherUser.username 'teacherName', ch.classDate,  tr.subject  , studentUser.username 'StudentName'
                        FROM convenientportal.class_history ch
                        LEFT JOIN convenientportal.class_canceled cc ON ch.id = cc.history_id 
                        LEFT JOIN convenientportal.class_joining cj ON cj.history_id = ch.id 
                        INNER JOIN convenientedu.classrooms c ON c.id = ch.classroomID 
                        LEFT JOIN convenientedu.classroom_relation cr ON cr.classroomID = c.id 
                        INNER JOIN convenientportal.timetable t ON ch.timetableID = t.classID 
                        INNER JOIN convenientedu.users teacherUser ON teacherUser.id = t.teacherID
                        INNER JOIN convenientedu.users studentUser ON studentUser.id = cr.userID 
                        INNER JOIN convenientedu.teacherRelation tr ON tr.id = teacherUser.id  
                        WHERE 
                        c.managerID = ? -- FOR MANAGERS
                        OR 
                        (ch.parentID = ?) -- FOR PARENTS
                        OR 
                        cr.userID = ? -- FOR STUDENTS
                        OR 
                        (ch.teacherID = ? OR t.teacherID = ?) -- FOR TEACHERS
                        OR
                        ('ADMIN' IN (SELECT usertype FROM convenientedu.users WHERE id = ?))
                        ;     
                                
        `;
        const params = [this.uid, this.uid, this.uid, this.uid, this.uid, this.uid];
        const [rows] = await this.pool.execute(query, params);
        console.log(rows)
        return rows;
    }

    async #CreateUseableReportsForFrontEnd(reports = []){
        const useableReports = []
        reports.forEach(report => {
            const cancelled = (report.cancellerID === null)? false : true;
            const joined = (report.joiningTime === null || cancelled)? false : true;
            let late = cancelled;
            if (joined) {
                const demoDate = "2005-09-11T"
                const timeObjectForClassTime = new Date((demoDate + report.classTime + ".010Z"));
                const timeObjectForJoiningTime = new Date((demoDate + report.joiningTime + ".010Z"));
                const differenceInMinutes = (timeObjectForJoiningTime.getTime() - timeObjectForClassTime.getTime()) / (1000 * 60);
                console.log(differenceInMinutes);
                late = (differenceInMinutes > this.lateTolerance) ? true : false
            }
            console.log(report)
            console.log(late, joined, cancelled)
            let status;
            if (cancelled) {
                status = "CANCELLED";
            }else if (late){
                status = "LATE"
            }else if (joined){
                status = "ON TIME"
            }else {
                status = "MISSED"
            }
            console.log(status)
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            const classDate = new Date(report.classDate);
            const formattedDate = `${String(classDate.getUTCDate()).padStart(2, '0')} ${monthNames[classDate.getUTCMonth()]} ${classDate.getUTCFullYear()}`;
            console.log(formattedDate)
            let className = report.className
            if (["ADMIN", "MANAGER"].includes(this.usertype)) {
                className = `${report.className}-${report.StudentName}`
            }
            const object = {
                status: status,
                className: className,
                date: formattedDate,
                time: report.classTime,
                teacher: report.teacherName,
                classroom: report.classroomName,
                historyID: report.historyID,
                subject: report.subject
            };
            useableReports.push(object)
        });
        return useableReports
    }
    
    async GetReports(){
        const reports = await this.#GetDetailAboutUserFromReports();
        return await this.#CreateUseableReportsForFrontEnd(reports);
    }

    async addClassPage(){
        try {
            const SubjectNameAndTeachers = await this.#getSubjectNameAndTeachers();
            const classrooms = await this.#getClassroomForClassInsertionPage();
            const paidValue = await this.#getPayedForSupportClassesValue();
            return {
                subjects: SubjectNameAndTeachers,
                classrooms: classrooms,
                payedForSupportClasses: paidValue
            }
        } catch (error) {
            console.log(error)
            
        }


    }

    /**
     * Function To Get Data For Home
     * @param {string} usertype User Type For Current User
     * @param {number} uid User Identity Number For Current User
     * @returns Send Back Formatted Data For Front End Usage
     */
    async home(usertype, uid){
        const timetable = await this.getTimetableForToday(uid);
        const stats = await this.getStats(uid, usertype)
        console.log("Stats");
        console.log(stats)
        return {
            message: "Home Received",
            detail: "We were able to query home successfully",
            code: 200,
            data: {           
                timetable: timetable,
                stats: stats.data
            }
        }
    }

    /**
     * 
     * @returns {Boolean} Returns true if the classes are subtracted
     */
    async #subtractOneFromSupportClasses(classroomID){
        const isSupport = await this.#checkIfSupportClassroom(classroomID);
        console.log("Is Support: ", isSupport)
        if ((isSupport.data)){
            const query1 = `SELECT nopc.classes AS "classes" FROM convenientedu.number_of_payed_classes nopc WHERE nopc.parentID = ?;`;
            const params1 = [this.uid];
            const [rows1] = await this.pool.execute(query1, params1);
            if (rows1["classes"] > 0) {
                const query = `
                    UPDATE convenientedu.number_of_payed_classes nopc
                    INNER JOIN convenientedu.parentRelation pr ON pr.Parent_id = nopc.parentID
                    SET nopc.classes = nopc.classes - 1
                    WHERE pr.Student_id = ? OR pr.Parent_id = ?;
                `
                const params = [this.uid, this.uid];
                const rows = await this.pool.execute(query, params);
                console.log("Main Subtraction Query", rows)
                if (rows.affectedRows > 0) {
                    console.log("Classes Subtracted")
                    return {
                        message: "Classes Subtracted",
                        detail: "We were able to subtract the classes",
                        code: 200
                    }
                }else{
                    console.log("Classes Not Subtracted")
                    return {
                        message: "Classes Not Subtracted",
                        detail: "We were not able to subtract the classes",
                        code: 400
                    }
                }
            }else{
                console.log("No Classes To Subtract");
                return {
                    message: "Please Pay For Classes",
                    detail: "There are no classes to schedule. Please pay for classes.",
                    code: 400
                }
            }
        }
    }

    /**
     * Inserts a class into the timetable.
     * Validates input data and ensures no conflicts between day and date.
     * 
     * @param {string} classname - The name of the class.
     * @param {string} time - The time in HH:MM or HH:MM:SS format.
     * @param {number} day - The day of the week (0 for Sunday, 6 for Saturday).
     * @param {number} teacher - The ID of the teacher.
     * @param {number} classroom - The ID of the classroom.
     * @param {string} date - The date in YYYY-MM-DD format.
     * @param {boolean} active - Indicates if the class is active.
     * @returns {Promise<Object>} - Result message with a status code.
     */
    async insertClassToTimetable(
        classname = "",
        time = "",
        day = -1,
        teacher = -1,
        classroom = -1,
        date = "",
        active = true
    ) {
        try {
            console.debug("Initial Input Data:", { classname, time, day, teacher, classroom, date, active });

            // Sanitize and normalize inputs
            classname = classname === "" ? null : classname;
            time = time === "" ? null : time;
            date = date === "" ? null : date;

            day = parseInt(day, 10);
            classroom = parseInt(classroom, 10);
            teacher = parseInt(teacher, 10);
            day = (isNaN(day))? null: day
            console.debug("Normalized Data:", { classname, time, day, teacher, classroom, date, active });

            // Validation
            const isDayValid = (Number.isInteger(day) && day >= 0 && day <= 6) || date !== null;
            const isTeacherValid = teacher > 0;
            const isClassroomValid = classroom > 0;
            const areRequiredFieldsPresent = classname && time && (date || day >= 0);

            if (!areRequiredFieldsPresent || !isDayValid || !isTeacherValid || !isClassroomValid) {
                let detailMessage = "All fields are required and must have valid values.";

                if (!classname) detailMessage = "Class name is missing.";
                else if (!time) detailMessage = "Time is missing.";
                else if (!isDayValid && !date) detailMessage = "Day must be between 0 (Sunday) and 6 (Saturday) or a valid date must be provided.";
                else if (!isTeacherValid) detailMessage = "Teacher must be greater than 0.";
                else if (!isClassroomValid) detailMessage = "Classroom must be greater than 0.";

                console.warn("Validation Failed:", { classname, time, day, teacher, classroom, date, active, detailMessage });

                return {
                    message: "Invalid Input",
                    detail: detailMessage,
                    code: 422,
                };
            }

            if (String(classname).length > 27) {
                console.warn("Class Name Too Long:", { classname });

                return {
                    message: "Classname Longer Than Allowed",
                    detail: "Please shorten the length of the class name.",
                    code: 422,
                };
            }

            // Validate time format (e.g., "HH:MM" or "HH:MM:SS")
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/; // Seconds are optional
            if (!timeRegex.test(time)) {
                console.warn("Invalid Time Format:", { time });

                return {
                    message: "Invalid Time Format",
                    detail: "Time must be in the format HH:MM or HH:MM:SS (24-hour format).",
                    code: 422,
                };
            }

            // Validate date format (if provided) (e.g., "YYYY-MM-DD")
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
            if (date && !dateRegex.test(date)) {
                console.warn("Invalid Date Format:", { date });

                return {
                    message: "Invalid Date Format",
                    detail: "Date must be in the format YYYY-MM-DD.",
                    code: 422,
                };
            }

            if (day !== null && date !== null) {
                console.warn("Both Day and Date Provided:", { day, date });

                return {
                    message: "Can't Add Both Date And Day",
                    detail: "Either choose a date or a day. Conflicting information provided.",
                    code: 422,
                };
            }

            // SQL Query Preparation
            const query = `
                INSERT INTO convenientportal.timetable 
                (className, day, date, time, classroomID, teacherID, active) 
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            const parameters = [classname, day, date, time, classroom, teacher, active];
            console.debug("SQL Query Prepared:", { query, parameters });

            // Execute the query
            const [rows] = await this.pool.execute(query, parameters);
            console.debug("SQL Execution Result:", { rows });

            if (rows.affectedRows > 0) {
                const data = await this.#subtractOneFromSupportClasses(classroom);
                if (data.code !== 200) {
                    return data
                    
                }
                console.info("Class Added Successfully:", { classname, day, date, time, classroom, teacher, active });

                return {
                    message: "Class Added",
                    detail: "The class was successfully added to the timetable.",
                    code: 200,
                };
            } else {
                console.warn("Class Not Added:", { classname, day, date, time, classroom, teacher, active });

                return {
                    message: "Class Not Added",
                    detail: "We were unable to add the class to the timetable.",
                    code: 304,
                };
            }
        } catch (error) {
            console.error("Error While Inserting Into Timetable:", { message: error.message, stack: error.stack });
            if (String(error.message).includes("for key 'timetable.classroomID'") && String(error.message).includes("Duplicate entry") ) {
                return {
                    message: "Conflict",
                    detail: "There is a class scheduled for this classroom at this particular time.",
                    code: 500,
                };    
            }
            return {
                message: "Error Adding Class",
                detail: "There was an error adding the class to the timetable.",
                code: 500,
            };
        }
    }

    async #checkIfSupportClassroom(classroomID){
        const query = `SELECT c.classType, c.parentID FROM convenientedu.classrooms c WHERE c.id = ?`;
        const params = [classroomID];
        const [rows] = await this.pool.execute(query, params);
        console.log(rows)
        if (rows[0].classType === "SUPPORT") {
            return {
                data: true,
                parentID: rows[0].parentID
            }
        }else{
            return {
                data: false,
                parentID: 0
            }
        }
    }

    /**
     * Function to add class to class history
     * @param {number} classID Class ID
     * @param {string} classDate YYYY-MM-DD Class Date In UTC
     * @param {string} classTime HH:MM:SS For Time
     * @returns object with message, detail and code
     */
    async insertClassHistory(classID, classDate, classTime){
        try {
            const query = `INSERT INTO convenientportal.class_history (classID, classDate, classTime) VALUES (?, ?, ?)`;
            const params = [classID, classDate, classTime];
            const Validation = new validation();
            Validation.validateTime(classTime);
            const [rows] = await this.pool.execute(query, params);
            if (rows.affectedRows > 0) {
                return {
                    message: "Class History Added",
                    detail: "We were able to add class history from timetable",
                    code: 200
                }
            }else{
                return {
                    message: "Class History Not Added",
                    detail: "We were not able to add class history from timetable",
                    code: 304
                }
            }
    
        } catch (error) {
            this.logger.error(error.message);
            this.logger.error("Error While Adding Into Class History")
            console.error(error);
            return {
                message: "Error Adding Class History",
                detail: "We were not able to add class history from timetable due to internal error",
                code: 304
            }

        }
    }

    async insertClassHistoryFromToday(){
        try {
            const query = 'INSERT INTO convenientportal.class_history (classroomID, timetableID, classDate, classTime, teacherID, parentID) SELECT classroomID, classID, CURDATE(), time, teacherID, c.parentID FROM convenientportal.timetable t INNER JOIN convenientedu.classrooms c ON c.id = t.classroomID WHERE t.`day` = ? OR t.`date` = CURDATE();';
            const day = ((new Date().getDay()) === 0)? 6: (new Date().getDay() - 1) 
            console.log(day)
            const row = await this.pool.execute(query, [day])
            console.log(row)
            return {
                message: "Class Inserted Successfully",
                detail: "We were able to add classes from timetable to class history",
                code: 200
            }    
        } catch (error) {
            if (String(error.message).split(" ").includes("Duplicate")) {
                return {
                    message: "Class Insert Unsuccessful",
                    detail: "We were not able to add classes from timetable to class history",
                    code: 400
                }        
            }else{
                this.logger.error("Error While Inserting Class History From Today Table")
                this.logger.error(error.message)
                return {
                    message: "Class Inserted Successfully",
                    detail: "We were able to add classes from timetable to class history",
                    code: 200
                }        
            }
        }
    }

    async getParent(uid) {
        if (typeof uid !== 'number') {
            throw new TypeError('Student_id must be a number');
        }
    
        const query = 'SELECT Parent_id FROM convenientedu.parentRelation WHERE Student_id = ?';
        const params = [uid];
    
        try {
            const [rows] = await this.pool.execute(query, params);
    
            // Return null if no parent is found
            return rows[0]?.Parent_id || null;
        } catch (error) {
            console.error(`Database error in getParent for Student_id: ${uid}`, error.message);
            throw error; // Propagate error to be handled by the caller
        }
    }


    /**
     * 
     * @param {*} history_id 
     * @param {*} joinerID 
     * @param {*} TimetableID 
     * @param {*} classDate 
     * @param {*} classTime 
     * @param {*} ClassroomID 
     * @param {*} joinerType 
     * @returns 
     */
    async #addToClassJoining(history_id, joinerID, TimetableID, classDate, classTime, ClassroomID, joinerType) {
        // SQL query
        const query = `
            INSERT INTO convenientportal.class_joining (
                history_id,
                uid,
                TimetableID,
                classDate,
                classTime,
                ClassroomID,
                joinerType,
                JoiningTime
            ) VALUES (?, ?, ?, ?, ?, ?, ?, CURTIME());
        `;
    
        // Parameter validation
        if (!Number.isInteger(history_id) || history_id <= 0) {
            throw new Error("Invalid 'history_id': Must be a positive integer.");
        }
    
        if (!Number.isInteger(joinerID) || joinerID <= 0) {
            throw new Error("Invalid 'joinerID': Must be a positive integer.");
        }
    
        if (!Number.isInteger(TimetableID) || TimetableID <= 0) {
            throw new Error("Invalid 'TimetableID': Must be a positive integer.");
        }
    
        if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
            throw new Error("Invalid 'classDate': Must be in 'YYYY-MM-DD' format.");
        }
    
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(classTime)) {
            throw new Error("Invalid 'classTime': Must be in 'HH:MM:SS' or 'HH:MM' format.");
        }
    
        if (!Number.isInteger(ClassroomID) || ClassroomID <= 0) {
            throw new Error("Invalid 'ClassroomID': Must be a positive integer.");
        }
    
        if (typeof joinerType !== "string" || !["STUDENT", "TEACHER", "MANAGER", "ADMIN", "PARENT"].includes(joinerType.toUpperCase())) {
            throw new Error("Invalid 'joinerType': Must be one of ['STUDENT', 'TEACHER', 'MANAGER', 'ADMIN', 'PARENT'].");
        }
    
        // Parameters for the query
        const params = [history_id, joinerID, TimetableID, classDate, classTime, ClassroomID, joinerType];
    
        try {
            // Execute query
            const [rows] = await this.pool.execute(query, params);
            if (rows.affectedRows > 0) {
                return {
                    message: "Joining Successful",
                    detail: "We were successfully able to add joining history to table",
                    code: 200
                }                
            }else {
                return {
                    message: "Joining Unsuccessful",
                    detail: "We were unable to add joining history to table or it was already added",
                    code: 400
                }                
            }
        } catch (error) {
            console.error("Error in #addtoClassJoining:", error.message);
            if (String(error.message).split(" ").includes("Duplicate")) {
                return {
                    message: "Class Joining Found",
                    detail: "Class Record Found",
                    code: 200
                }
            }else{
                return {
                    message: "Error Adding Data",
                    detail: error.message,
                    code: 400
                }
            }
        }
    }

    /**
     * Check if the proposed time is in the past tolerance range.
     * @param {number} timeHour Proposed Time Hour
     * @param {number} timeMin Proposed Time Min
     * @param {number} secondTimeHour Hour Of the second time by default the current hour UTC
     * @param {number} secondTimeMin Minute Of The second time by default the current minute UTC
     * @param {number} difference Difference of Min
     * @returns {boolean} Returns true if the time is in past tolerance
     */
    #timeInPast(timeHour, timeMin, difference, secondTimeHour = new Date().getUTCHours(), secondTimeMin =  new Date().getUTCMinutes()){
        timeHour = parseInt(timeHour);
        timeMin = parseInt(timeMin)
        let currentTimeHour = secondTimeHour
        let currentTimeMin = secondTimeMin
        console.log(currentTimeHour, currentTimeMin)
        let currentTime = (currentTimeHour * 60) + currentTimeMin;
        let minimumTime = currentTime - difference
        let checkingTime = (timeHour * 60) + timeMin
        console.log(minimumTime, checkingTime)
        return minimumTime > checkingTime
    }

    /**
     * Check if the proposed time is in the future tolerance range.
     * @param {number} timeHour Proposed Time Hour
     * @param {number} timeMin Proposed Time Min
     * @param {number} difference Difference of Min
     * @param {number} secondTimeHour Hour Of the second time by default the current hour UTC
     * @param {number} secondTimeMin Minute Of The second time by default the current minute UTC
     * @returns {boolean} Returns true if the time is in future tolerance
     */
    #timeInFuture(timeHour, timeMin, difference, secondTimeHour = new Date().getUTCHours(), secondTimeMin =  new Date().getUTCMinutes()){
        timeHour = parseInt(timeHour);
        timeMin = parseInt(timeMin)
        let currentTimeHour = secondTimeHour;
        let currentTimeMin = secondTimeMin;
        console.log(currentTimeHour, currentTimeMin)
        let currentTime = (currentTimeHour * 60) + currentTimeMin;
        let maximumTime = currentTime + difference
        let checkingTime = (timeHour * 60) + timeMin
        console.log(maximumTime, checkingTime)
        return maximumTime < checkingTime
    }

    /**
     * Function to check if the proposed class time is within the time frame
     * @param {number} classTime Propose Class Time
     * @param {number} pastToleranceInMin Past Tolerance In Min
     * @param {number} futureToleranceInMin Future Tolerance In Min
     * @returns {Boolean} Class Time Within Time Frame
     */
    WithinTimeFrame(classTime = "", pastToleranceInMin, futureToleranceInMin){
        const hour = String(classTime).split(":");
        console.log("HOUR")
        console.log(hour)
        const pastCheck = !this.#timeInPast(hour[0], hour[1], pastToleranceInMin);
        const futureCheck = !this.#timeInFuture(hour[0], hour[1], futureToleranceInMin);
        console.log("Past Check", pastCheck);
        console.log("Future Check", futureCheck)
        if (pastCheck && futureCheck) {
            return true
        }else {
            return false
        }
    }
    
    /**
     * Handles the process of a user taking a class by verifying the provided token,
     * validating the extracted data, determining the joiner type, and adding the user
     * to the class joining list.
     *
     * @async
     * @param {string} token - The JWT token containing class and user information.
     * @returns {Promise<Object>} - A promise that resolves to an object containing the result of the operation.
     * @property {number} code - The status code of the operation (e.g., 200 for success, 400 for client error, 500 for server error).
     * @property {string} message - A message describing the result of the operation.
     * @property {string} [detail] - Additional details about the result of the operation.
     * @property {string} [link] - The link to join the class if the operation is successful.
     * 
     * @throws {Error} - Throws an error if required data is missing or invalid, or if the joiner type cannot be determined.
     */
    async ClassTaken(token) {
        try {
            console.log("token: ", token)
            // Decode and verify the JWT token
            const {
                classroomID,
                historyID,
                timetableID,
                classDate,
                classTime,
                link,
                uid
            } = jwt.verify(token, process.env.OTHER_JWT_SECRET);
            const withinRange = this.WithinTimeFrame(classTime, 50, 10)
            console.log("Within Range", withinRange)
            if (!withinRange) {
                return {
                    message: "Can't Join The Class",
                    detail: "Class Is Either 50 Min in past or 10 Min in future",
                    code: 400
                }
            }

            console.log("Adding Class Joining Record For history ID: ", historyID)
            
            // Validate extracted data
            const missingFields = [];
            if (!classroomID) missingFields.push("classroomID");
            if (!historyID) missingFields.push("historyID");
            if (!timetableID) missingFields.push("timetableID");
            if (!classDate) missingFields.push("classDate");
            if (!classTime) missingFields.push("classTime");
            if (!uid) missingFields.push("uid");

            if (missingFields.length > 0) {
                throw new Error(`Missing required data from token: ${missingFields.join(", ")}`);
            }    
            // Additional validation for specific fields
            if (!Number.isInteger(classroomID) || classroomID <= 0) {
                throw new Error("Invalid 'classroomID': Must be a positive integer.");
            }
            if (!Number.isInteger(historyID) || historyID <= 0) {
                throw new Error("Invalid 'historyID': Must be a positive integer.");
            }
            if (!Number.isInteger(timetableID) || timetableID <= 0) {
                throw new Error("Invalid 'timetableID': Must be a positive integer.");
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(classDate)) {
                throw new Error("Invalid 'classDate': Must be in 'YYYY-MM-DD' format.");
            }
            if (!/^\d{2}:\d{2}(:\d{2})?$/.test(classTime)) {
                throw new Error("Invalid 'classTime': Must be in 'HH:MM:SS' or 'HH:MM' format.");
            }
    
            // Determine the joiner type
            const joinerType = await this.#getPersonType(uid);
            console.log("Joiner Type: ")
            console.log(joinerType)
            if (!joinerType) {
                throw new Error("Unable to determine joiner type for the given UID.");
            }
    
            // Add to class joining
            const Adder = await this.#addToClassJoining(historyID, uid, timetableID, classDate, classTime, classroomID, joinerType);
    
            // Check if the operation was successful
            if (Adder.code !== 200) {
                return Adder; // Return the error response
            }
    
            // Add the link to the response and return
            Adder.link = link;
            return Adder;
    
        } catch (error) {
            // Handle errors gracefully
            console.error(error)
            console.error("Error in ClassTaken:", error.message);
            return {
                code: 500,
                message: "An error occurred while processing the request.",
                detail: error.message
            };
        }
    }
    
    /**
     * Retrieves the total number of classes from a given date for a specific user.
     * 
     * @param {string} date - The date from which to count the classes.
     * @param {string} uid - The user ID for whom the classes are being counted.
     * @returns {Promise<number>} - A promise that resolves to the total number of classes.
     * @throws {Error} - Throws an error if the database query fails.
     * @private
     */
    async #getTotalClassesFrom(date, uid){
        const usertype = await this.#getPersonType(uid);
        if (usertype === "TEACHER") {
           const {rate, lastPayed} = await this.#getTeacherHourlyRate(uid);
           date = lastPayed;
        }
        const query = `
        SELECT COUNT(*) AS 'count' FROM convenientportal.class_history ch WHERE classDate > ?
        AND 
        (
            (ch.timetableID IN (SELECT id FROM convenientedu.classrooms c WHERE c.managerID = ?)) -- MANAGER
            OR 
            (ch.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation cr WHERE cr.userID = ?)) -- STUDENT
            OR 
            (ch.teacherID = ?) -- TEACHER
            OR 
            (ch.classroomID IN (SELECT classroomID FROM convenientedu.classroom_relation cr INNER JOIN convenientedu.parentRelation pr ON cr.userID = pr.Student_id WHERE pr.Parent_id = ?)) -- Parent For General Classes
            OR 
            ("ADMIN" IN (SELECT usertype FROM convenientedu.users u WHERE u.id = ?)) -- ADMIN
        )
        ;
        `
        const params = [date, uid, uid, uid, uid, uid];
        const [rows] = await this.pool.execute(query, params);
        console.log("Total Classes: ", rows)
        return rows[0].count

    }

    /**
     * Retrieves the total count of distinct class joining history records for a user from a specified date.
     * 
     * @async
     * @private
     * @param {string} date - The date from which to start counting the class joining history.
     * @param {number} uid - The user ID for whom the count is being retrieved.
     * @returns {Promise<number>} - A promise that resolves to the count of distinct class joining history records.
     */
    async #getTotalTakenFrom(date, uid){
        const usertype = await this.#getPersonType(uid);
        if (usertype === "TEACHER") {
            const {rate, lastPayed} = await this.#getTeacherHourlyRate(uid);
            date = lastPayed;
        }
         
        const query = `
            SELECT COUNT(DISTINCT (history_id)) AS 'count'
            FROM convenientportal.class_joining cj 
            WHERE cj.classDate > ?
            AND 
            (
                (cj.uid IN (SELECT Student_id FROM convenientedu.parentRelation pr WHERE pr.Parent_id = ?)) 
                OR
                (cj.uid = ? AND (cj.joinerType IN ("STUDENT", "TEACHER")))
                OR
                (cj.TimetableID IN (SELECT classID FROM convenientportal.timetable t INNER JOIN convenientedu.classrooms c WHERE c.managerID = ?))
                OR
                ("ADMIN" IN (SELECT usertype FROM convenientedu.users WHERE id = ?))
            );
        `
        const params = [date, uid, uid, uid, uid];
        const [rows] = await this.pool.execute(query, params);
        return rows[0].count

    }

    async #getAverageScoreFrom(date, uid){
        return 0
    }

    /**
     * Retrieves the payment value for a teacher based on the provided date and user ID.
     *
     * @param {Date} date - The date for which the payment value is being calculated.
     * @param {string} uid - The unique identifier of the teacher.
     * @returns {Promise<number>} - A promise that resolves to the teacher's hourly rate.
     * @private
     */
    async #getPaymentValueForTeacher(date, uid){
        const {rate, lastPayed} = await this.#getTeacherHourlyRate(uid);
        return rate
    }

    /**
     * Retrieves the hourly rate and last payment date for a teacher based on their unique identifier (uid).
     *
     * @private
     * @async
     * @param {string} uid - The unique identifier of the teacher.
     * @returns {Promise<{rate: number|null, lastPayed: string|null}>} An object containing the teacher's hourly rate and last payment date.
     */
    async #getTeacherHourlyRate(uid){
        try {
            const query = "SELECT paymentValue, lastPayment FROM convenientedu.teacher_payments WHERE uid = ?";
            const params = [uid];
            const [rows] = await this.pool.execute(query, params);
            return {
                rate: rows[0].paymentValue,
                lastPayed: rows[0].lastPayment
            }

        } catch (error) {
            return {
                rate: null,
                lastPayed: null
            }
        }
    }
    
    /**
     * Retrieves the date paid till for general classes for a given user ID.
     *
     * @async
     * @param {string|null} uid - The user ID (either parentID or studentID). If null, an error response is returned.
     * @returns {Promise<Object>} An object containing the result of the query:
     * - If successful:
     *   - message: "Date Paid Till Received"
     *   - detail: "We are able to query successfully"
     *   - code: 200
     *   - data: Array of rows containing the payedTill date
     * - If uid is null:
     *   - message: "Invalid Input Provided"
     *   - detail: "We were not able to get paid till date"
     *   - code: 422
     * - If an error occurs during the query:
     *   - message: "Unsuccessful Query"
     *   - detail: "We were not able to query Date Paid Till"
     *   - code: 500
     */
    async feeDatePaidTillForGeneralClasses(uid = null){
        try{
            if (uid === null) {
                return {
                    message: "Invalid Input Provided",
                    detail: "We were not able to get paid till date",
                    code : 422
                }
            }
            const query = 'SELECT payedTill FROM convenientedu.feePayedForGeneralClassesTill WHERE parentID = ? OR studentID = ?';
            const param = [uid, uid];
            const [rows] = await this.pool.execute(query ,param);
            return {
                message: "Date Paid Till Received",
                detail: "We are able to query successfully",
                code: 200,
                data: rows
            }
        }catch (err) {
            this.logger.error(err.message);
            return {
                message: "Unsuccessful Query",
                detail: "We were not able to query Date Paid Till",
                code: 500
            }
        }
    }

    /**
     * Checks if the user has support based on their user type.
     *
     * @async
     * @private
     * @param {string} uid - The unique identifier of the user.
     * @param {string} usertype - The type of the user, either "STUDENT" or "PARENT".
     * @returns {Promise<boolean|null>} - Returns true if the user has support, false otherwise, or null if the usertype is invalid.
     */
    async #checkIfSupportUser(uid, usertype){
        let query;
        const params = [uid]
        if (usertype === "STUDENT") {
            query = "SELECT COUNT(*) FROM convenientedu.number_of_payed_classes nopc INNER JOIN convenientedu.parentRelation pr ON pr.Parent_id = nopc.parentID WHERE pr.Student_id = ?;"
        }else if (usertype === "PARENT"){
            query = "SELECT COUNT(*) FROM convenientedu.number_of_payed_classes nopc INNER JOIN convenientedu.parentRelation pr ON pr.Parent_id = nopc.parentID WHERE pr.Parent_id = ?;"
        }else {
            return null
        }
        const [rows] = await this.pool.execute(query, params);
        return (rows[0]["COUNT(*)"] > 0) ? true : false
    }

    /**
     * Retrieves the number of fee-paid support classes for a given user.
     * 
     * @param {string|null} [uid=null] - The user ID. If null, the method will use the instance's `uid`.
     * @returns {Promise<Object>} - An object containing the result of the query.
     * 
     * @property {string} message - A message describing the result.
     * @property {string} detail - Additional details about the result.
     * @property {number} code - The HTTP status code representing the result.
     * @property {number} [data] - The number of fee-paid support classes (only present on success).
     * 
     * @throws {Error} - If an error occurs during the database query.
     */
    async getNumberOFfeePayedSupportClasses(uid = null){
        if (uid === null) {
            uid = this.uid
        }
        if (!["PARENT", "STUDENT"].includes(this.usertype)) {
            console.log("Invalid Usertype", this.usertype)
            return {
                message: "Unable to fetch",
                detail:"Can't fetch number of classes for current usertype",
                code: 400
            }
        }
        try {
            if (uid === null) {
                return {
                    message: "Support Classes Not Received",
                    detail: "We were not able to get any support classes due to null user id",
                    error: 400    
                }
            }
            const query = 'SELECT classes FROM convenientedu.number_of_payed_classes nopc INNER JOIN convenientedu.parentRelation pr ON pr.Parent_id = nopc.parentID WHERE nopc.parentID = ? OR pr.Student_id = ? ; ';
            const param = [uid, uid];
            const [rows]  = await this.pool.execute(query, param);
            return {
                message: "Support Classes",
                detail: "Requested Support Classes",
                code: 200,
                data: rows[0].classes
            }
        } catch (error) {
            console.error(error)
            this.logger.error(error.message);
            const errorPayload = {
                message: "Support Classes Not Received",
                detail: "We were not able to get any support classes",
                error: 500
            }
            this.logger.verbose(errorPayload);
            return errorPayload
        }
    }

    /**
     * Adds support classes for a parent after payment.
     * 
     * @async
     * @private
     * @function #addSupportClassesAfterPayment
     * @param {number} Parentid - The ID of the parent.
     * @param {number} classesAdded - The number of classes to add.
     * @returns {Promise<Object>} A promise that resolves to an object containing the result of the operation.
     * @throws Will throw an error if the database operation fails.
     */
    async #addSupportClassesAfterPayment(Parentid, classesAdded){
        try {
            const query = 'UPDATE convenientedu.number_of_payed_classes SET classes = classes + ? WHERE parentID = ?;';
            const parameters = [classesAdded, Parentid];
            const [rows] = await this.pool.execute(query, parameters);
            if (rows.affectedRows > 0) {
                return {
                    message:"Classes Added",
                    detail: "New Classes Were Added After Payment",
                    code: 200
                }    
            }else {
                this.logger.error("Some Error Caused Us Not To Add Classes For Support Student");
                return {
                    message: "Classes Were Not Added",
                    detail: "No New Classes Were Added Please Check",
                    code: 400
                }
            }
        } catch (error) {
            this.logger.error(error.message);
            return {
                message: "Classes Were Not Added",
                detail: "No New Classes Were Added Please Check",
                code: 500
            }
        }

    }

    /**
     * Retrieves statistical data for a user based on their user type.
     *
     * @param {number} uid - The unique identifier of the user.
     * @param {string} usertype - The type of the user. Must be one of "STUDENT", "PARENT", "ADMIN", "MANAGER", "TEACHER".
     * @returns {Promise<Object>} An object containing the user's statistics, including total classes, total taken, average score, payment value (if user is a teacher), and the current date.
     *
     * @throws {Error} If invalid parameters are provided.
     *
     * @example
     * const stats = await getStats(123, "STUDENT");
     * console.log(stats);
     */
    async getStats(uid, usertype){

        /**
            *   totalClasses: 12,
            *   totalTaken: 8,
            *   averageScore: 0,
            *   paymentValue: 2,
            *   date: new Date()

         */

        if (uid > 0 && ["STUDENT", "PARENT", "ADMIN", "MANAGER", "TEACHER"].includes(usertype)) {
            this.logger.verbose("Stats Requested With Correct Parameters")
        }else {
            this.logger.error("Somehow Invalid Inputs Were Provided");
            console.log("uid", uid);
            console.log("Usertype: ", usertype)
            return {
                message: "Invalid Parameters",
                detail: "Please Check With Admin For More Detail",
                code: 422
            }
        }
        const today = new Date();
        today.setMonth(today.getMonth() - 1); // Subtract one month
        
        // Format the date as YYYY-MM-DD
        const pastDate = today.toISOString().split('T')[0];
        const totalClasses = await this.#getTotalClassesFrom(pastDate, uid);
        const totalTaken = await this.#getTotalTakenFrom(pastDate, uid);
        const avgScore = await this.#getAverageScoreFrom(pastDate, uid);
        let paymentValue = 0
        if (usertype === "TEACHER") {
            paymentValue = await this.#getPaymentValueForTeacher(pastDate, uid);
        }
        return {
            data: {
                totalClasses: totalClasses,
                totalTaken: totalTaken,
                averageScore: avgScore,
                paymentValue: paymentValue,
                date: new Date()        
            },
            code: 200,
            message: "Stats Received",
            detail: "We were able to receive stats"
        }
    }


}

module.exports = portal;

