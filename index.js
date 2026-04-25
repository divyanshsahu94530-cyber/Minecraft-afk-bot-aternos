const http = require('http');
const mineflayer = require('mineflayer');
const CONFIG = require("./config.json");

let connected = false;
let bot = null;
let reconnecting = false;
let refreshTimer = null;

const actions = ['forward', 'back', 'left', 'right', 'jump'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const getRandom = array => array[Math.floor(Math.random() * array.length)];

// ===== LOG SYSTEM =====
const LOG_LIMIT = 200;
const logs = [];

function pushLog(level, msg) {
    const line = `[${new Date().toISOString().replace('T', ' ').slice(0, 19)}] ${msg}`;
    logs.push({ level, line });
    if (logs.length > LOG_LIMIT) logs.shift();
}

const origLog = console.log.bind(console);
const origErr = console.error.bind(console);

console.log = (...args) => { pushLog('info', args.join(' ')); origLog(...args); };
console.error = (...args) => { pushLog('error', args.join(' ')); origErr(...args); };

// ===== RECONNECT =====
async function reconnect() {
    if (reconnecting) return;
    reconnecting = true;
    connected = false;

    if (refreshTimer) {
        clearTimeout(refreshTimer);
        refreshTimer = null;
    }

    if (bot) {
        try { bot.removeAllListeners(); } catch (_) {}
        try { bot.quit(); } catch (_) {}
        try { bot.end(); } catch (_) {}
        bot = null;
    }

    console.log(`Reconnecting in ${CONFIG.retryTimes.text}...`);
    await sleep(CONFIG.retryTimes.ms);

    reconnecting = false;
    createAFKBot();
}

// ===== AUTO REFRESH =====
function scheduleRefresh() {
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
        console.log('Auto refresh: reconnecting...');
        reconnect();
    }, 30 * 60 * 1000);
}

// ===== BOT =====
function createAFKBot() {
    if (bot) return;

    bot = mineflayer.createBot({
        host: CONFIG.host,
        port: CONFIG.port,
        username: CONFIG.username,
        version: CONFIG.version || false,
        checkTimeoutInterval: 120 * 1000,
        keepAlive: true,
        connectTimeout: 60 * 1000
    });

    bot.on('spawn', () => {
        connected = true;
        scheduleRefresh();

        async function doMoving() {
            if (!connected) return;

            const action = getRandom(actions);
            bot.setControlState(action, true);

            if (Math.random() < 0.5) bot.setControlState('sprint', true);

            await sleep(getRandom(CONFIG.actionDelays));

            try {
                bot.setControlState(action, false);
                bot.setControlState('sprint', false);
            } catch (_) {}

            await sleep(getRandom(CONFIG.actionDelays));
            if (connected) doMoving();
        }

        async function changeViewPos() {
            if (!connected) return;

            const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI);
            const pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);

            try { bot.look(yaw, pitch, false); } catch (_) {}

            await sleep(getRandom(CONFIG.actionDelays));
            if (connected) changeViewPos();
        }

        changeViewPos();
        doMoving();
    });

    bot.on('login', () => {
        console.log(`Logged in as ${CONFIG.username}`);
    });

    bot.on('error', err => {
        console.error(`Error: ${err}`);
        reconnect();
    });

    bot.on('end', reason => {
        console.error(`Disconnected: ${reason}`);
        reconnect();
    });

    bot.on('kicked', reason => {
        console.error(`Kicked: ${reason}`);
        reconnect();
    });
}

// ===== GLOBAL ERRORS =====
process.on('uncaughtException', err => {
    console.error('Uncaught:', err?.message || err);
    reconnect();
});

process.on('unhandledRejection', err => {
    console.error('Unhandled:', err?.message || err);
});

// START BOT
createAFKBot();

// ===== WEB SERVER =====
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[c]));
}

function renderPage() {
    const status = connected ? 'CONNECTED' : 'DISCONNECTED';
    const color = connected ? '#22c55e' : '#ef4444';

    const rows = logs.slice().reverse().map(l =>
        `<div class="row ${l.level}">${escapeHtml(l.line)}</div>`
    ).join('');

    return `<!doctype html>
<html><head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="5"/>
<title>AFK Bot</title>
<style>
body{font-family:monospace;background:#0b0f17;color:#e6edf3;padding:20px;}
.status{padding:6px 12px;border-radius:8px;background:${color};color:#000;font-weight:bold;}
.logs{background:#0f1623;padding:10px;border-radius:8px;max-height:70vh;overflow:auto;}
.row{font-size:13px;}
</style>
</head><body>
<h2>AFK Bot Status</h2>
<div class="status">${status}</div>
<div class="logs">${rows || 'No logs yet'}</div>
</body></html>`;
}

const server = http.createServer((req, res) => {
    if (req.url === '/ping') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        return res.end(`OK ${connected ? 'CONNECTED' : 'DISCONNECTED'}`);
    }

    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(renderPage());
});

server.listen(process.env.PORT || 3000, () => {
    console.log('Web server running');
});
