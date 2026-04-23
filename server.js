const express = require("express");
const fs = require("fs");
const { spawn } = require("child_process");
const { generateToken, verifyToken } = require("./auth");
const app = express();

app.use(express.json());
app.use(express.static("public"));

let db = JSON.parse(fs.readFileSync("database.json"));
let servers = {};
let logs = {};

/* 🔐 REGISTER */
app.post("/register", (req,res)=>{
    const { username, password } = req.body;

    if(db.users.find(u=>u.username===username))
        return res.send("User exists");

    db.users.push({ username, password, role:"user" });
    fs.writeFileSync("database.json", JSON.stringify(db,null,2));

    res.send("Registered");
});

/* 🔐 LOGIN */
app.post("/login", (req,res)=>{
    const { username, password } = req.body;

    const user = db.users.find(u=>u.username===username && u.password===password);
    if(!user) return res.send("Invalid");

    const token = generateToken(user);
    res.json({ token });
});

/* 🎮 CREATE SERVER */
app.post("/create", verifyToken, (req,res)=>{
    const name = req.body.name;
    fs.mkdirSync(`./servers/${name}`, { recursive:true });
    res.send("Created");
});

/* ▶ START SERVER */
app.post("/start", verifyToken, (req,res)=>{
    const name = req.body.name;

    const proc = spawn("java", ["-Xmx1G","-jar","server.jar","nogui"], {
        cwd:`./servers/${name}`
    });

    servers[name] = proc;
    logs[name] = [];

    proc.stdout.on("data", d=>{
        logs[name].push(d.toString());
    });

    res.send("Started");
});

/* ⏹ STOP */
app.post("/stop", verifyToken, (req,res)=>{
    servers[req.body.name]?.kill("SIGINT");
    res.send("Stopped");
});

/* 📡 LIVE LOGS */
app.get("/logs/:name", verifyToken, (req,res)=>{
    res.json(logs[req.params.name] || []);
});

app.listen(3000, ()=>console.log("VOTEX PRO RUNNING"));
