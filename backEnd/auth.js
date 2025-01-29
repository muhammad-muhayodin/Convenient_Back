const express = require("express");
const router = express.Router()
const argon = require("argon2")
const auth = require("./classes/auth")
const portal = require("./classes/portal")
const winston = require('winston');
require("dotenv").config()
const mysql =  require('mysql2/promise');  // Ensure proper import

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

router.post("/login", async (req, res) => {
    const {username, password} = req.body;
    console.log("Logged In")
    const Auth = new auth(pool, logger);
    await Auth.checkConnection();
    const data = await Auth.login(username, password);
    try {
        let payedTill = false
        if (data.userType === "STUDENT") {
            const payedTillx = await new portal(pool, logger, data.uid, "STUDENT").feeDatePaidTillForGeneralClasses(data.uid);
            console.log("Student Has Paid For: ", payedTillx)
            if (payedTillx < new Date()) {
                payedTill = false
            }else {
                payedTill = true
            }
            data.payedTill = payedTill
        }
        data.uid = null
    } catch (error) {
        console.log(error)
    }
    
    res.status(200).send(data)
})


module.exports = router