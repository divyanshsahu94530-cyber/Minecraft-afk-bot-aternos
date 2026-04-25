const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let connected = false;
let bot = null;

// -------------------- HELPERS --------------------
const actions = ['forward', 'back', 'left', 'right', 'jump'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const getRandom = (array) =>
  array[Math.floor(Math.random() * array.length)];

const cLog = (msg) => {
  if (CONFIG.logger) console.log(msg);
};

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

    // =========================
    // MOVE FORWARD MODE
    // =========================
    if (CONFIG.moveForward) {
      bot.setControlState('forward', true);
      console.log("Bot is moving forward");

      setInterval(() => {
        if (connected) {
          bot.setControlState('jump', true);
          setTimeout(() => {
            bot.setControlState('jump', false);
          }, 300);
        }
      }, 3000);
    }

    // =========================
    // RANDOM MOVEMENT LOOP
    // =========================
    async function doMoving() {
      if (connected) {
        const lastAction = getRandom(actions);

        bot.setControlState(lastAction, true);

        if (Math.random() < 0.5) {
          bot.setControlState('sprint', true);
        }

        cLog(`Action: ${lastAction}`);

        await sleep(getRandom(CONFIG.actionDelays));

        bot.setControlState(lastAction, false);
        bot.setControlState('sprint', false);
      }

      await sleep(getRandom(CONFIG.actionDelays));
      doMoving();
    }

    // =========================
    // LOOK AROUND LOOP
    // =========================
    async function changeViewPos() {
      if (connected) {
        const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI);
        const pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);

        bot.look(yaw, pitch, false);
      }

      await sleep(getRandom(CONFIG.actionDelays));
      changeViewPos();
    }

    changeViewPos();
    doMoving();
  });

  bot.on('end', () => {
    connected = false;
    console.log("Disconnected, reconnecting...");
    setTimeout(createBot, CONFIG.retryTimes.ms);
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

const PORT = process.env.PORT || 3000;

// Start web first (Railway safe)
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Web server running on port ${PORT}`);

  // Start bot after delay (prevents Railway timeout)
  setTimeout(createBot, 2000);
});
