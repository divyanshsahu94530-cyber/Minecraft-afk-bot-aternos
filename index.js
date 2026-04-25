const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let connected = false;
let bot = null;

// -------------------- BOT --------------------
function createBot() {
  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version || false
  });

  bot.on('spawn', () => {
    connected = true;
    console.log("Bot joined");
  });

  bot.on('end', () => {
    connected = false;
    console.log("Disconnected, reconnecting...");
    setTimeout(createBot, 5000);
  });

  bot.on('error', err => {
    console.log("Error:", err);
  });
}

// -------------------- WEB SERVER --------------------
const server = http.createServer((req, res) => {
  if (req.url === "/ping") {
    res.writeHead(200);
    return res.end("OK");
  }

  res.writeHead(200);
  res.end("Bot running");
});

const PORT = process.env.PORT || 3000;

// ✅ START SERVER FIRST
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);

  // ✅ THEN START BOT AFTER DELAY
  setTimeout(createBot, 2000);
});
