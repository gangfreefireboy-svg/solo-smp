const jwt = require("jsonwebtoken");
const SECRET = "votex_secret";

function generateToken(user){
    return jwt.sign(user, SECRET, { expiresIn: "7d" });
}

function verifyToken(req, res, next){
    const token = req.headers["authorization"];
    if(!token) return res.status(403).send("No token");

    try {
        req.user = jwt.verify(token, SECRET);
        next();
    } catch {
        res.status(401).send("Invalid token");
    }
}

module.exports = { generateToken, verifyToken };
