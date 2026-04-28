process.on("uncaughtException", (err) => {
  console.log("CRASH FIXED:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err);
});

const http = require("http");
const mineflayer = require("mineflayer");
const CONFIG = require("./config.json");

let bot = null;
let connected = false;
let isCreating = false;
let lastJoinTime = 0;

// -------------------- HELPERS --------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// -------------------- BOT --------------------
function createBot() {
  const now = Date.now();

  // 🔴 prevent fast reconnect spam
  if (now - lastJoinTime < 45000) {
    console.log("⏳ Waiting before reconnect...");
    return setTimeout(createBot, 15000);
  }

  if (bot || isCreating) return;

  lastJoinTime = now;
  isCreating = true;

  bot = mineflayer.createBot({
    host: CONFIG.host,
    port: CONFIG.port,
    username: CONFIG.username,
    version: CONFIG.version || false
  });

  bot.once("spawn", async () => {
    connected = true;
    isCreating = false;

    console.log("✅ Bot joined");

    await sleep(12000);

    if (CONFIG.password) {
      try {
        bot.chat(`/login ${CONFIG.password}`);
        console.log("🔐 Login sent");
      } catch {}

      await sleep(5000);

      try {
        bot.chat(`/mvtp survival`);
        console.log("🌍 Sent /mvtp survival");
      } catch {}
    }

    startMovement();
  });

  bot.on("end", (reason) => {
    connected = false;

    console.log("❌ Disconnected:", reason);

    if (bot) {
      try { bot.quit(); } catch {}
      bot = null;
    }

    // ✅ NORMAL reconnect
    setTimeout(createBot, CONFIG.retryTimes.ms);

    // ✅ EXTRA SAFETY (Railway restart if stuck)
    setTimeout(() => {
      console.log("♻️ Forcing Railway restart...");
      process.exit(1);
    }, 60000); // 60 sec fallback
  });

  bot.on("error", (err) => {
    console.log("Error:", err.message);
  });
}

// -------------------- MOVEMENT --------------------
function startMovement() {
  setInterval(() => {
    if (!connected) return;

    if (Math.random() < 0.3) {
      const actions = ["forward", "left", "right"];
      const action = actions[Math.floor(Math.random() * actions.length)];

      bot.setControlState(action, true);

      setTimeout(() => {
        bot.setControlState(action, false);
      }, 1000);
    }
  }, 20000);

  setInterval(() => {
    if (!connected) return;

    const yaw = bot.entity.yaw + (Math.random() * 0.5 - 0.25);
    const pitch = bot.entity.pitch + (Math.random() * 0.3 - 0.15);

    bot.look(yaw, pitch, false);
  }, 15000);
}

// -------------------- WEB SERVER --------------------
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end("OK");
});

const PORT = process.env.PORT;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🌐 Web server running on port ${PORT}`);
  setTimeout(createBot, 5000);
});
