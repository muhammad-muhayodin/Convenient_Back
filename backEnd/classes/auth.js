const mysql =  require('mysql2/promise');  // Ensure proper import
const winston = require('winston');
const argon = require("argon2");
require("dotenv").config();
const Users = require("./users");
const jwt = require("jsonwebtoken");
const portal = require('./portal');



class Auth {
    constructor(pool, logger) {
        // Create a pool with connection settings
        this.pool = pool
        this.logger = logger;
        
        this.checkConnection()
    }


    /**
     * Check mySQL Connection
     */
    async checkConnection() {
        try {
            const [rows] = await this.pool.execute('SELECT 1');  // Simple query to test the connection
            console.log('Connection is successful:', rows);
        } catch (err) {
            console.error('Error connecting to the database:', err);
            this.logger.error("SQL connection Failed")
        }
    }

    /**
     * Login Functionality Of Convenient Portal
     * @param {string} username Username Of The Logger
     * @param {string} password Password Of The Logger
     */
    async login(username, password){
        const query = 'SELECT password_hash, id, usertype, username FROM convenientedu.users WHERE username = ?';
        const parameters = [username];
        try {
            const [rows] = await this.pool.execute(query, parameters);
            const hash = rows[0].password_hash;
            const verification = await argon.verify(hash, password)
            if (!verification) {
                return {
                    token: null,
                    supportClass: null,
                    username: null,
                    userType: null,
                    uid: null
                }    
            }
            console.log("Verification: ", verification);
            const token = await this.#generateToken(username, rows[0].usertype, rows[0].id)
            let supportClass;
            if (["PARENT", "STUDENT"].includes(rows[0].usertype)) {
                supportClass = await this.checkIfSupportClass(rows[0].id)
            }else{
                supportClass = false
            }
            return {
                token: token,
                supportClass:supportClass,
                userType: rows[0]["usertype"],
                username: rows[0]['username'],
                uid: rows[0]['id']
            }
        } catch (error) {
            console.log("Error While Logging In")
            this.logger.error(error.message, error.stack);
            return {
                token: null,
                supportClass: null,
                username: null,
                userType: null,
                uid: null
            }
        }
        
    }

    async checkIfSupportClass(uid){
        try {
            const query = `
            SELECT COUNT(*) FROM convenientedu.classrooms c 
            INNER JOIN convenientedu.parentRelation pr ON pr.Parent_id = c.parentID 
            WHERE (c.parentID = ? OR pr.Student_id = ?) AND c.classType = "SUPPORT";

            `
            const [rows] = await this.pool.execute(query, [uid, uid]);
            let SupportClass = (rows[0]["COUNT(*)"] > 0) ? true : false
            return SupportClass 
        } catch (error) {
            console.log("checkIfSupportClass")
            this.logger.error(error.message, error.stack, "checkIfSupportClass");
            return false    
        }
    }

    /**
     * Function to generate token
     * @param {string} username Username Of The Logger
     * @param {string} usertype User Type Of The Logger
     * @param {Number} userID UID of the logger
     * @param {object} permissions Permission containing allowUserInsertion, allowsClassInsertion, allowsCancellation
     * @param {object} routes Routes containing classrooms, children, teachers
     * @returns JWT token
     */
    async #generateToken(username, usertype, userID)   
    {

    const JWT_SECRET = process.env.JWT_SECRET;
    const payload = {
        username: username,
        usertype: usertype,
        uid: userID}
    
    return await jwt.sign(payload, JWT_SECRET, {expiresIn:"10h"})

    }

    /**
     * Verify Token
     * @param {string} token JWT token
     * @returns {object | Boolean} Object Containing Routes, 
     */
    async verifyToken(token){
        try {
            const JWT_SECRET = process.env.JWT_SECRET;
            return await jwt.verify(token, JWT_SECRET);    
        } catch (error) {
            return false
        }
    }

}

module.exports = Auth