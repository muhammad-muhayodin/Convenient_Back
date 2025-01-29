const express = require("express")
const auth = require("./auth")
const users = require("./users")
const portal = require("./portal")
const cors = require("cors")
const app = express();
require("dotenv").config()
const jwt = require("jsonwebtoken")
app.use(express.json())

app.use(cors())


app.use(async (req, res, next) => {
    req.user = {
        username: "",
        uid: 0,
        usertype:""
    }
    try {
        console.log("req.body.AuthToken: ", req.body.AuthToken);
        const tokenAuthPayload = jwt.verify(req.body.AuthToken, process.env.JWT_SECRET);
        console.log("Logging Token Auth Payload: ", tokenAuthPayload)
        req.user = tokenAuthPayload    
    } catch (error) {
        console.error(error)
    }
    next()
})

console.log("Initialized Basic App")
app.use("/auth", auth);
console.log("Initialized Auth")

app.use("/user", users);
console.log("Initialized User")

app.use("/portal", portal)
console.log("Initialized Portal")

app.listen(30001, () => {
    console.log("Portal Server Running On 30001")
})