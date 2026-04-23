const express = require("express");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const SECRET = "votex_secret";

/* ================= SAFE DATABASE ================= */
let db = { users: [] };

try {
  if (fs.existsSync("database.json")) {
    db = JSON.parse(fs.readFileSync("database.json"));
  }
} catch (e) {
  console.log("DB load error:", e);
}

function saveDB() {
  fs.writeFileSync("database.json", JSON.stringify(db, null, 2));
}

/* ================= AUTH ================= */

function generateToken(user) {
  return jwt.sign(user, SECRET);
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).send("No token");

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).send("Invalid token");
  }
}

/* ================= ROOT (VERY IMPORTANT) ================= */

app.get("/", (req, res) => {
  res.send("✅ VOTEX PANEL RUNNING");
});

/* ================= AUTH ROUTES ================= */

app.post("/register", (req, res) => {
  try {
    const { username, password } = req.body;

    if (db.users.find(u => u.username === username)) {
      return res.send("User exists");
    }

    db.users.push({ username, password, role: "admin" });
    saveDB();

    res.send("Registered");
  } catch (e) {
    res.status(500).send("Register error");
  }
});

app.post("/login", (req, res) => {
  try {
    const { username, password } = req.body;

    const user = db.users.find(
      u => u.username === username && u.password === password
    );

    if (!user) return res.send("Invalid");

    res.json({ token: generateToken(user) });
  } catch (e) {
    res.status(500).send("Login error");
  }
});

/* ================= SERVER CONTROL ================= */

let servers = {};
let logs = {};

app.post("/create", verifyToken, (req, res) => {
  try {
    const name = req.body.name;
    fs.mkdirSync(`./servers/${name}`, { recursive: true });
    res.send("Created");
  } catch {
    res.status(500).send("Create error");
  }
});

app.post("/start", verifyToken, (req, res) => {
  try {
    const name = req.body.name;

    if (servers[name]) return res.send("Already running");

    const proc = spawn("java", ["-Xmx512M", "-jar", "server.jar", "nogui"], {
      cwd: `./servers/${name}`
    });

    servers[name] = proc;
    logs[name] = [];

    proc.stdout.on("data", d => {
      logs[name].push(d.toString());
    });

    proc.stderr.on("data", d => {
      logs[name].push("ERR: " + d.toString());
    });

    proc.on("close", () => {
      delete servers[name];
    });

    res.send("Started");
  } catch (e) {
    res.status(500).send("Start error");
  }
});

app.post("/stop", verifyToken, (req, res) => {
  try {
    const name = req.body.name;

    if (!servers[name]) return res.send("Not running");

    servers[name].kill("SIGINT");
    delete servers[name];

    res.send("Stopped");
  } catch {
    res.status(500).send("Stop error");
  }
});

app.get("/logs/:name", verifyToken, (req, res) => {
  try {
    res.json(logs[req.params.name] || []);
  } catch {
    res.json([]);
  }
});

/* ================= DISCORD BOT (SAFE) ================= */

try {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once("ready", () => {
    console.log("🤖 Bot Online");
  });

  client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const name = interaction.options.getString("name");

    if (interaction.commandName === "start") {
      interaction.reply("Use dashboard for now");
    }

    if (interaction.commandName === "stop") {
      interaction.reply("Use dashboard for now");
    }
  });

  if (process.env.TOKEN) {
    client.login(process.env.TOKEN);
  } else {
    console.log("⚠️ No TOKEN found, bot disabled");
  }

} catch (e) {
  console.log("Bot error:", e);
}

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});
