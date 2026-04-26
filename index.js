process.on("uncaughtException", (err) => {
  console.log("CRASH FIXED:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err);
});

const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let connected = false;
let bot = null;
let isCreating = false;
let hasAuthRun = false;

// -------------------- HELPERS --------------------
const actions = ['forward', 'back', 'left', 'right'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getRandom = (array) =>
  array[Math.floor(Math.random() * array.length)];

const cLog = (msg) => {
  if (CONFIG.logger) console.log(msg);
};

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

  bot.once('spawn', () => {
    connected = true;
    isCreating = false;
    hasAuthRun = false;

    console.log("Bot joined");

    // =========================
    // ONE TIME REGISTER + LOGIN + MVTP
    // =========================
    if (CONFIG.password) {
      setTimeout(() => {
        if (hasAuthRun) return;

        bot.chat(`/register ${CONFIG.password} ${CONFIG.password}`);
        console.log("Tried register");

        setTimeout(() => {
          bot.chat(`/login ${CONFIG.password}`);
          console.log("Tried login");

          setTimeout(() => {
            bot.chat(`/mvtp survival`);
            console.log("Sent /mvtp survival");

            hasAuthRun = true;
          }, 3000);

        }, 3000);

      }, 3000);
    }

    // =========================
    // RANDOM JUMP
    // =========================
    function randomJump() {
      if (!connected) return;

      if (Math.random() < 0.2) {
        bot.setControlState('jump', true);
        setTimeout(() => {
          bot.setControlState('jump', false);
        }, 200);
      }

      setTimeout(randomJump, 15000 + Math.random() * 20000);
    }

    // =========================
    // MOVEMENT LOOP
    // =========================
    async function doMoving() {
      while (connected) {

        if (Math.random() < 0.4) {
          cLog("Idle...");
          await sleep(20000 + Math.random() * 20000);
          continue;
        }

        const action = getRandom(actions);

        bot.setControlState(action, true);

        cLog(`Action: ${action}`);

        await sleep(1500 + Math.random() * 2000);

        bot.setControlState(action, false);

        await sleep(10000 + Math.random() * 20000);
      }
    }

    // =========================
    // LOOK AROUND
    // =========================
    async function changeViewPos() {
      while (connected) {
        const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI);
        const pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);

        bot.look(yaw, pitch, false);

        await sleep(8000 + Math.random() * 10000);
      }
    }

    randomJump();
    changeViewPos();
    doMoving();
  });

  bot.on('end', (reason) => {
    connected = false;

    console.log("Disconnected:", reason);

    if (bot) {
      try { bot.quit(); } catch {}
      bot = null;
    }

    setTimeout(() => {
      console.log("Reconnecting...");
      createBot();
    }, CONFIG.retryTimes.ms);
  });

  bot.on('error', err => {
    console.log("Error:", err);
  });
}

// -------------------- WEB SERVER --------------------
const server = http.createServer((req, res) => {
  if (req.url === "/" || req.url === "/ping") {
    res.writeHead(200);
    return res.end("OK");
  }

  res.writeHead(200);
  res.end("Bot running");
});

const PORT = process.env.PORT;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Web server running on port ${PORT}`);

  setTimeout(createBot, 3000);
});
