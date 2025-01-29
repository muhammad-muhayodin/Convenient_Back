const express = require("express");
const router = express.Router()
const argon = require("argon2");
const jwt = require("jsonwebtoken")
const mysql =  require('mysql2/promise');  // Ensure proper import
const winston = require('winston');
const portal = require("./classes/portal");
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
    level: 'info',
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

router.use((req, res, next) => {
    if (req.user.uid === 0) {
        console.log("req.user.uid: ", req.user.uid)
        res.status(401).send({
            "message":"User Not Logged In",
            "detail": "Please Login To Continue"
        })
    }else{
        next()
    }
})


router.post("/insert/class/timetable", async (req, res) => {
    const connection = await pool.getConnection();
    await connection.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    await connection.beginTransaction();
    try {
        const Portal = new portal(connection, logger, req.user.uid, req.user.usertype);
        const {classroom, time, day, date, teacher, classname, active} = req.body;
        const data = await Portal.insertClassToTimetable(classname, time, day, teacher, classroom, date, active);
        console.log(data)
        if (data.code !== 200) {
            await connection.rollback();}
        else{
            await connection.commit();
        }
        return res.status(data.code).send(data)
    } catch (error) {
        console.log(error)
        await connection.rollback();
        logger.error(error.message);
        return res.status(500).send({message: "Error Adding New Class", detail: "We tried adding new class but failed due to internal error"})
    }
})


router.post("/insert/class/timetable/support", async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
        if (day !== null && date === null) {
            res.status(400).send({message: "Unsupported Request", detail: "Please use a date to schedule a support class", code: 400})
        }
        const Portal = new portal(connection, logger, req.user.uid, req.user.userType);
        const {classroom, time, day, date, teacher, classname, active} = req.body;
        const data = await Portal.insertClassToTimetable(classname, time, day, teacher, classroom, date, active);
        console.log(data)
        if (data.code !== 200) {
            await connection.rollback();
        }else{
            await connection.commit();
        }
        return res.status(data.code).send(data)
    } catch (error) {
        await connection.rollback();
        console.log(error)
        logger.error(error.message);
        return res.status(500).send({message: "Error Adding New Class", detail: "We tried adding new class but failed due to internal error"})
    }
})

router.post("/insert/class/history", async (req, res) => {
    try {
        const Portal = new portal(pool, logger);
        const {classID, classDate, classTime} = req.body;
        const data = await Portal.insertClassHistory(classID, classDate, classTime);
        console.log(data)
        return res.status(data.code).send(data)
    } catch (error) {
        console.log(error)
        logger.error(error.message);
        return res.status(500).send({message: "Error Adding To History Class", detail: "We tried adding new class to history but failed due to internal error"})
    }

})
router.post("/timetable", async (req, res) => {
    try {
        const {uid, usertype} = req.user;
        const Portal = new portal(pool, logger);
        const data = await Portal.getTimetableAll(usertype, uid);
        return res.status(data.code).send({
            message: data.message,
            detail: data.detail,
            data: data.data
        })
    
    } catch (error) {
        console.log(error)
        logger.error(error.message)
        return res.status(500).send({
            message: "There was an error getting timetable",
            detail: "We tried getting the timetable but failed due to unknown error",
            code: 500
        })
    }
})


router.post("/home", async (req, res) => {
    try {
        const {uid, usertype} = req.user;
        const Portal = new portal(pool, logger);
        const data = await Portal.home(usertype, uid);
        return res.status(data.code).send({
            message: data.message,
            detail: data.detail,
            data: data.data
        })
    
    } catch (error) {
        console.log(error)
        logger.error(error.message)
        return res.status(500).send({
            message: "There was an error getting timetable",
            detail: "We tried getting the timetable but failed due to unknown error",
            code: 500
        })
    }
})

router.post("/reports", async (req, res) => {
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    try {
        const Portal = new portal(connection, logger, req.user.uid, req.user.usertype);
        data = await Portal.GetReports();
        return res.status(200).send({message: "Successful", detail: "We were able to get reports", data: data})
    } catch (error) {
        console.log(error)
        return res.status(400).send({message: "Unable to get reports", detail: "We were not able to get reports"})
    }
})


router.post("/children", async (req, res) => {
    try {
        console.log(req.user)
        const Portal = new portal(pool, logger, req.user.uid, req.user.usertype);
        const data = await Portal.Children();
        return res.status(data.code).send({
            message: data.message,
            detail: data.detail,
            data: data.data
        })
    
    } catch (error) {
        console.log(error)
        logger.error(error.message)
        return res.status(500).send({
            message: "There was an error getting children",
            detail: "We tried getting the children but failed due to unknown error",
            code: 500
        })
    }
});

router.post("/add/class/populate", async (req, res) => {
    try {
        const Portal = new portal(pool, logger, req.user.uid, req.user.usertype);
        const data = await Portal.addClassPage();
        data.code = 200
        return res.status(200).send(data);
    } catch (error) {
        console.log(error)
        return res.status(400).send({
            message: "Unable to populate",
            detail: "We couldn't fetch data from server",
            code: 400
        })
    }
})

router.post("/join", async (req, res) => {
    const key = req.body.classToken;
    const Portal = new portal(pool, logger);

    const detail = await Portal.ClassTaken(key);
    console.log(detail)
    if (detail.link === null) {
        const redirectUrl =  detail.link;
        // Redirect to the generated URL
        return res.redirect(redirectUrl);
    }else{
        console.log("Detail Code: ", detail.code)
        return res.status(detail.code).send(detail)
    }
    
});

router.post("/cancel", async (req, res) => {
    const key = req.body.classToken;
    const Portal = new portal(pool, logger);

    const detail = await Portal.CancelClass(key);
    console.log(detail)
    if (detail.link === null) {
        const redirectUrl =  detail.link;
        // Redirect to the generated URL
        return res.redirect(redirectUrl);
    }else{
        console.log("Detail Code: ", detail.code)
        return res.status(detail.code).send(detail)
    }
    
});


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


setImmediate(async () => {
    try {
        await new portal(pool, logger).insertClassHistoryFromToday()
    } catch (error) {
        if (String(error.message).split(" ").includes("Duplicate")) {
            // Do nothing
        }else {
            console.error(error)
        }
    }
})

setInterval(async () => {
    try {
        await new portal(pool, logger).insertClassHistoryFromToday()
    } catch (error) {
        if (String(error.message).split(" ").includes("Duplicate")) {
            // Do nothing
        }else {
            console.error(error)
        }
    }
}, 600000);

module.exports = router