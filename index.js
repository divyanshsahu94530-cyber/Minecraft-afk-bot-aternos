process.on("uncaughtException", (err) => {
  console.log("CRASH FIXED:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err);
});

const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let bot = null;
let connected = false;
let isCreating = false;

// -------------------- BOT --------------------
function createBot() {
  if (bot || isCreating) return;

  isCreating = true;

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version || false
  });

  bot.once('spawn', async () => {
    connected = true;
    isCreating = false;

    console.log("✅ Bot joined");

    // 🔴 WAIT BEFORE ANYTHING (IMPORTANT)
    await sleep(10000);

    // =========================
    // AUTH SYSTEM (SAFE ORDER)
    // =========================
    if (CONFIG.password) {
      try {
        bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`);
        console.log("Register sent");
      } catch {}

      await sleep(5000);

      try {
        bot.chat(`/login ${CONFIG.password}`);
        console.log("Login sent");
      } catch {}

      await sleep(7000);

      try {
        bot.chat(`/mvtp survival`);
        console.log("Teleported to survival");
      } catch {}
    }

    // 🔴 WAIT BEFORE MOVEMENT
    await sleep(10000);

    startMovement();
  });

  bot.on('end', (reason) => {
    connected = false;

    console.log("❌ Disconnected:", reason);

    if (bot) {
      try { bot.quit(); } catch {}
      bot = null;
    }

    // 🔴 LONG WAIT (VERY IMPORTANT)
    setTimeout(() => {
      console.log("🔄 Reconnecting...");
      createBot();
    }, CONFIG.retryTimes.ms);
  });

  bot.on('error', err => {
    console.log("Error:", err.message);
  });
}

// -------------------- MOVEMENT --------------------
function startMovement() {

  // light movement only
  setInterval(() => {
    if (!connected) return;

    if (Math.random() < 0.3) {
      const actions = ['forward', 'left', 'right'];
      const action = actions[Math.floor(Math.random() * actions.length)];

      bot.setControlState(action, true);

      setTimeout(() => {
        bot.setControlState(action, false);
      }, 1000);
    }
  }, 20000);

  // slow look
  setInterval(() => {
    if (!connected) return;

    const yaw = bot.entity.yaw + (Math.random() * 0.5 - 0.25);
    const pitch = bot.entity.pitch + (Math.random() * 0.3 - 0.15);

    bot.look(yaw, pitch, false);
  }, 15000);
}

// -------------------- HELPERS --------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

// -------------------- WEB SERVER --------------------
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

const PORT = process.env.PORT;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Server running on ${PORT}`);
  setTimeout(createBot, 5000);
});
