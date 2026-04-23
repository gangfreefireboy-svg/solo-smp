const express = require("express");
const { spawn } = require("child_process");
const fs = require("fs");
const util = require("minecraft-server-util");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let servers = {}; // running servers

function startServer(name, jar="server.jar", port=25565) {
    const path = `./servers/${name}`;

    if (!fs.existsSync(path)) {
        return "Server not found";
    }

    const proc = spawn("java", ["-Xmx1G", "-jar", jar, "nogui"], {
        cwd: path
    });

    servers[name] = proc;

    proc.stdout.on("data", (data) => {
        console.log(`[${name}] ${data}`);
    });

    proc.on("close", () => {
        delete servers[name];
    });

    return "Started";
}

function stopServer(name) {
    if (!servers[name]) return "Not running";
    servers[name].kill("SIGINT");
    return "Stopped";
}

app.post("/create", (req, res) => {
    const { name } = req.body;

    fs.mkdirSync(`./servers/${name}`);
    res.send("Server created");
});

app.post("/start", (req, res) => {
    res.send(startServer(req.body.name));
});

app.post("/stop", (req, res) => {
    res.send(stopServer(req.body.name));
});

app.post("/restart", (req, res) => {
    stopServer(req.body.name);
    setTimeout(() => {
        startServer(req.body.name);
    }, 2000);
    res.send("Restarting");
});

app.get("/status/:name", async (req, res) => {
    try {
        const status = await util.status("localhost", 25565);
        res.json(status);
    } catch {
        res.send("Offline");
    }
});

app.listen(3000, () => console.log("VOTEX PANEL RUNNING"));
