const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let connected = false;
let bot = null;

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

createBot();

const server = http.createServer((req, res) => {
  if (req.url === "/ping") {
    res.writeHead(200);
    return res.end("OK");
  }

  res.writeHead(200);
  res.end("Bot running");
});

server.listen(process.env.PORT || 3000, () => {
  console.log("Web server running");
});
