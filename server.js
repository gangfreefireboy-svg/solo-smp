const express = require("express");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const { spawn } = require("child_process");
const { Client, GatewayIntentBits } = require("discord.js");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());
app.use(express.static("public"));

const SECRET = "votex_secret";

/* ================= AUTH ================= */

let db = { users: [] };
if (fs.existsSync("database.json")) {
  db = JSON.parse(fs.readFileSync("database.json"));
}

function saveDB() {
  fs.writeFileSync("database.json", JSON.stringify(db, null, 2));
}

function generateToken(user) {
  return jwt.sign(user, SECRET);
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.send("No token");
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.send("Invalid token");
  }
}

/* ================= ROUTES ================= */

app.get("/", (req, res) => {
  res.send("✅ VOTEX PANEL RUNNING");
});

/* REGISTER */
app.post("/register", (req, res) => {
  const { username, password } = req.body;
  if (db.users.find(u => u.username === username)) {
    return res.send("User exists");
  }
  db.users.push({ username, password, role: "admin" });
  saveDB();
  res.send("Registered");
});

/* LOGIN */
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.users.find(u => u.username === username && u.password === password);
  if (!user) return res.send("Invalid");
  res.json({ token: generateToken(user) });
});

/* ================= SERVER CONTROL ================= */

let servers = {};
let logs = {};

app.post("/create", verifyToken, (req, res) => {
  const name = req.body.name;
  fs.mkdirSync(`./servers/${name}`, { recursive: true });
  res.send("Created");
});

app.post("/start", verifyToken, (req, res) => {
  const name = req.body.name;

  const proc = spawn("java", ["-Xmx1G", "-jar", "server.jar", "nogui"], {
    cwd: `./servers/${name}`
  });

  servers[name] = proc;
  logs[name] = [];

  proc.stdout.on("data", d => {
    logs[name].push(d.toString());
  });

  res.send("Started");
});

app.post("/stop", verifyToken, (req, res) => {
  servers[req.body.name]?.kill("SIGINT");
  res.send("Stopped");
});

app.get("/logs/:name", verifyToken, (req, res) => {
  res.json(logs[req.params.name] || []);
});

/* ================= DISCORD BOT ================= */

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
    await fetch("http://localhost:" + PORT + "/start", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "bot" },
      body: JSON.stringify({ name })
    });
    interaction.reply(`Started ${name}`);
  }

  if (interaction.commandName === "stop") {
    await fetch("http://localhost:" + PORT + "/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "bot" },
      body: JSON.stringify({ name })
    });
    interaction.reply(`Stopped ${name}`);
  }
});

client.login(process.env.TOKEN);

/* ================= START SERVER ================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Running on port " + PORT);
});
