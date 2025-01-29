const express = require("express");
const router = express.Router()
const argon = require("argon2")
const auth = require("./classes/auth")
const portal = require("./classes/portal")
const users = require("./classes/users")
const mysql =  require('mysql2/promise');  // Ensure proper import
const winston = require('winston');
const Users = require("./classes/users");
require("dotenv").config()

const pool = mysql.createPool({
            host: process.env.SQLHOST,
            user: process.env.SQLUSER,
            password: process.env.SQLPASSWORD,
            waitForConnections: true,
            connectionLimit: 80,  // Limit the pool size (number of connections)
            queueLimit: 0,  // No queue limit for waiting connections
            debug: false
        });

const logger = winston.createLogger({
            level: 'verbose',
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message }) => {
                    return `${timestamp} ${level}: ${message}`;
                })
            ),
            transports: [
                new winston.transports.Console({ format: winston.format.combine(winston.format.colorize(), winston.format.simple()) }),
                new winston.transports.File({ filename: 'logs/auth.log' }),
            ],
        });

router.get("/username/:username", async (req, res) => {
    const proposedUsername = req.params.username;
    const users = new Users(pool, logger);
    
    try {
        const checkPass = await users.checkUsername(proposedUsername);
        
        if (checkPass) {
            // Username exists or is valid
            return res.status(200).json({ message: 'Username is available' });
        } else {
            // Username is not valid or does not exist
            return res.status(400).json({ message: 'Username is taken or invalid' });
        }
    } catch (error) {
        // Handling errors from the checkUsername method or DB
        logger.error(error); // Log the error for debugging
        return res.status(500).json({ message: 'Internal server error' });
    }
});

router.get("/country_list", (req, res) => {
    const countryKeyPair = new users(pool, logger).getCountryList();
    res.status(200).send(countryKeyPair)
})

router.get("/subject", (req, res) => {
    const subjectList = new users(pool, logger).getSubjectList();
    res.status(200).send({subjects: subjectList})
})

router.post("/insert/parent", async (req, res) => {
    const connection = await pool.getConnection();
    // Set a secure isolation level globally for this transaction
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction()
    try {
        const {username, firstname, lastname, password, country} = req.body;
        const Users = new users(connection, logger);
        logger.verbose("Trying To Add New User")
        const response = await Users.createNewParent(username, firstname, lastname, password, country);
        console.log(response)
        if (response.code !== 200) {
            await connection.rollback();
        }
        await connection.commit()
        return res.status(response.code).send({message: response.message, detail: response.detail, insertID: response.insertID});
    } catch (error) {
        console.log(error);
        logger.error(error.message, error.stack)
        await connection.rollback();
        return res.status(400).send({message: "Unable To Add New Parent", detail: "We Were Unable To Add nre", err: error});
    } finally {
        connection.release();  // Don't forget to release the connection back to the pool
    }
});


router.use((req, res, next) => {
    if (req.user.uid === 0) {
        res.status(401).send({
            "message":"User Not Logged In",
            "detail": "Please Login To Continue"
        })
    }else{
        next()
    }
})

router.use((req, res, next) => {
    if (["ADMIN", "MANAGER", "PARENT"].includes(req.user.usertype)) {
        next()   
    }else{
        return res.status(401).send({
            message: "Not Allowed",
            detail: "Permissions Not Granted For The Function",
            code: 401
        })
    }    
})

router.post("/add/student", async (req, res) => {
    const {username, firstname, lastname, password, country, classroom, studentType} = req.body;
    const connection = await pool.getConnection();
    // Set a secure isolation level globally for this transaction
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction()
    const Users = new users(connection, logger);
    try {
        let parentID = req.user.uid;
        if (req.user.usertype === "ADMIN") {
            parentID = req.body.parentID;   
        }

        console.log(req.body)
        if (studentType === "SUPPORT") {
            const rows = await Users.createNewStudentForSupport(username, firstname, lastname, password, country, parentID);
            if (rows.code !== 201) {
                await connection.rollback()
            }else{
                await connection.commit()
            }
            return res.status(rows.code).send({message: rows.message, detail: rows.detail})
        }else if  (studentType === "GENERAL") {
            const rows = await Users.createNewStudentForGeneral(username, firstname, lastname, password, country, parentID, classroom)
            if (rows.code !== 201) {
                await connection.rollback()
            }else{
                await connection.commit()
            }
            return res.status(rows.code).send({message: rows.message, detail: rows.detail})
        }else{
            console.log("Invalid Student Type: ", studentType)
            await connection.rollback()
            return res.status(400).send({message: "Invalid Student Type", detail: "Please Specify Student Type"})
        }
    } catch (error) {
        await connection.rollback();
    } finally { 
        await connection.release();
    }
})


router.use((req, res, next) => {
    if (["ADMIN", "MANAGER"].includes(req.user.usertype)) {
        next()   
    }else{
        return res.status(401).send({
            message: "Not Allowed",
            detail: "Permissions Not Granted For The Function",
            code: 401
        })
    }    
})

router.post("/insert/classroom", async (req, res) => {
    const connection = await pool.getConnection();
    // Set a secure isolation level globally for this transaction
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction()

    const {classroomName, maxStudents, managerID, classtype, parentID} = req.body;
    const Users = new users(connection, logger);
    try {
        const response = await Users.insertClassroom(classroomName, maxStudents, managerID, classtype, parentID);
        logger.info(`Classroom Added With Name ${classroomName}`)
        if (response.code !== 200) {
            console.log("ROLL BACK")
            await connection.rollback();
        }
        await connection.commit()
        return res.status(response.code).send({message: response.message, detail: response.detail});
    } catch (error) {
        console.log("ROLL BACK")
        logger.error(error)
        await connection.rollback();
        res.status(400).send({message: "Unable To Add New Classroom", detail: "", err: error})
    } finally {
        connection.release();  // Don't forget to release the connection back to the pool
    }
});

router.use((req, res, next) => {
    if (["ADMIN"].includes(req.user.usertype)) {
        next()   
    }else{
        return res.status(401).send({
            message: "Not Allowed",
            detail: "Permissions Not Granted For The Function",
            code: 401
        })
    }    
})

router.post("/insert/teacher", async (req, res) => {
    const connection = await pool.getConnection()
    // Set a secure isolation level globally for this transaction
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction()

    try {
        const Users = new users(connection, logger);
        const {username, firstname, lastname, password, country, subject, monday, tuesday, wednesday, thursday
            , friday, saturday, sunday} = req.body
        const response = await Users.createNewTeacher(username, firstname, lastname, "TEACHER", password, country, subject, monday, tuesday, wednesday, thursday
            , friday, saturday, sunday
        );
        logger.info("New Teacher Created")
        if (response.code === 200) {
            await connection.commit();
            return res.status(response.code).send({
                message: response.message,
                detail: response.detail
            });
    
        }else {
            console.log("rolledback", response)
            await connection.rollback();
            return res.status(response.code).send({
                message: response.message,
                detail: response.detail
            });
    
        }

    } catch (error) {
        logger.error(error.message);
        await connection.rollback()
        return res.status(500).send({
            "message":"Error Creating Teacher",
            "detail": "There was an error creating new teacher",
            code: 500,
            insertID: -1
        })
    } finally {
        await connection.release()
    }
})


router.post("/insert/manager", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // Set a secure isolation level globally for this transaction
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.beginTransaction()

        const Users = new users(connection, logger);
        const {username, firstname, lastname, password, country} = req.body;
        const response = await Users.createNewManager(username, firstname, lastname,password, country);
        console.log(response)
        if (response.code !== 200) {
            console.log("ROLL BACK")
            await connection.rollback();
        }
        await connection.commit()
        return res.status(response.code).send({message: response.message, detail: response.detail});

    } catch (error) {
        logger.error(error.message);
        console.log(error);
        return {
            message: "Unable To Insert New Manager",
            detail: "Internal Server Error While Inserting New Manager",
            code: 500
        }
    } finally {
        connection.release()
    }
})

router.post("/insert/admin", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        // Set a secure isolation level globally for this transaction
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.beginTransaction()

        const Users = new users(connection, logger);
        const {username, firstname, lastname, password, country} = req.body;
        const response = await Users.createNewAdmin(username, firstname, lastname,password, country);
        console.log(response)
        if (response.code !== 200) {
            console.log("ROLL BACK")
            await connection.rollback();
        }
        await connection.commit()
        return res.status(response.code).send({message: response.message, detail: response.detail});

    } catch (error) {
        logger.error(error.message);
        console.log(error);
        return {
            message: "Unable To Insert New Manager",
            detail: "Internal Server Error While Inserting New Manager",
            code: 500
        }
    } finally {
        connection.release()
    }
})


router.post("/insert/student/support", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Set a secure isolation level globally for this transaction
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.beginTransaction();

        const { username, firstname, lastname, password, country, parentID, className } = req.body;
        const usertype = "STUDENT"
        // Call the Users class to handle the student creation
        const Users = new users(connection, logger);
        const response = await Users.createNewStudentForSupport(
            username,
            firstname,
            lastname,
            password,
            country,
            parentID,
            className
        );

        console.log("Response to Add Support Student:", response);
        if (response.code !== 200 && response.code !== 201) {
            await connection.rollback();
            console.log("Rolled Back", response.code);
        } else {
            // Commit the transaction
            await connection.commit();
        }
        
        // Send the success response
        return res.status(response.code).send({
            message: response.message,
            detail: response.detail,
        });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error("Error during support student insertion:", error.message);

        // Log detailed error for debugging
        logger.error(
            `Error while adding new support student: ${error.message}`,
            { stack: error.stack }
        );

        // Send a generic error response
        return res.status(400).send({
            message: "We were unable to add the support student.",
            detail: "There was an unknown error during the insertion of a new support student.",
        });
    } finally {
        // Release the connection back to the pool
        connection.release();
    }
});
        

router.post("/insert/student/general", async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Set a secure isolation level globally for this transaction
        await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        await connection.beginTransaction();

        const { username, firstname, lastname, password, country, parentID, classroom } = req.body;
        const usertype = "STUDENT"
        // Call the Users class to handle the student creation
        const Users = new users(connection, logger);
        const response = await Users.createNewStudentForGeneral(
            username,
            firstname,
            lastname,
            password,
            country,
            parentID,
            classroom
        );

        console.log("Response to Add General Student:", response);

        if (response.code !== 200) {
            await connection.rollback()
        }else{
            // Commit the transaction
            await connection.commit();

        }
        // Send the success response
        return res.status(response.code).send({
            message: response.message,
            detail: response.detail,
        });
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error("Error during general student insertion:", error.message);

        // Log detailed error for debugging
        logger.error(
            `Error while adding new general student: ${error.message}`,
            { stack: error.stack }
        );

        // Send a generic error response
        return res.status(400).send({
            message: "We were unable to add the general student.",
            detail: "There was an unknown error during the insertion of a new general student.",
        });
    } finally {
        // Release the connection back to the pool
        connection.release();
    }
});



module.exports = router