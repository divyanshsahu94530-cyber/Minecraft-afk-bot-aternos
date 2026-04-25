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

const cLog = (msg, ...args) => {
        if (CONFIG.logger) console.log(msg, ...args);
};

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

        console.log(`Trying to reconnect in ${CONFIG.retryTimes.text}...`);
        await sleep(CONFIG.retryTimes.ms);
        reconnecting = false;
        createAFKBot();
}

function scheduleRefresh() {
        if (refreshTimer) clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
                console.log('Scheduled 10-minute refresh: reconnecting...');
                reconnect();
        }, 10 * 60 * 1000);
}

function createAFKBot() {
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
                        const lastAction = getRandom(actions);
                        bot.setControlState(lastAction, true);
                        if (Math.random() < 0.5) bot.setControlState('sprint', true);
                        cLog(`${lastAction}${bot.getControlState('sprint') ? " with sprint" : ''}`);
                        await sleep(getRandom(CONFIG.actionDelays));
                        try {
                                bot.setControlState(lastAction, false);
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

        bot.on('error', error => {
                console.error(`AFKBot got an error: ${error}`);
                reconnect();
        });
        bot.on('end', reason => {
                console.error(`AFKBot connection ended: ${reason}`);
                reconnect();
        });
        bot.on('kicked', (rawResponse) => {
                try {
                        const response = JSON.parse(rawResponse);
                        if (!(response instanceof Error)) {
                                console.error(`AFKbot kicked: ${response?.with?.map(v => v.text).join('\n') || rawResponse}`);
                        }
                } catch (_) {
                        console.error(`AFKbot kicked: ${rawResponse}`);
                }
                reconnect();
        });
        bot.on('login', () => {
                console.log(`AFKBot logged in ${CONFIG.username}`);
        });
}

process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err?.message || err);
        reconnect();
});
process.on('unhandledRejection', (err) => {
        console.error('Unhandled rejection:', err?.message || err);
});

createAFKBot();

function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
<title>Minecraft AFK Bot</title>
<style>
body{font-family:ui-monospace,Menlo,Consolas,monospace;background:#0b0f17;color:#e6edf3;margin:0;padding:24px;}
h1{margin:0 0 8px;font-size:20px;}
.status{display:inline-block;padding:6px 12px;border-radius:8px;background:${color};color:#000;font-weight:700;}
.meta{color:#9aa4b2;font-size:13px;margin:8px 0 16px;}
.logs{background:#0f1623;border:1px solid #1f2937;border-radius:10px;padding:12px;max-height:75vh;overflow:auto;}
.row{padding:3px 6px;border-radius:4px;font-size:13px;white-space:pre-wrap;word-break:break-word;}
.row.error{color:#fca5a5;}
.row.info{color:#cbd5e1;}
</style>
</head><body>
<h1>Minecraft AFK Bot</h1>
<div><span class="status">${status}</span></div>
<div class="meta">Server: ${escapeHtml(CONFIG.host)}:${CONFIG.port} &middot; User: ${escapeHtml(CONFIG.username)} &middot; Auto-refresh every 5s</div>
<div class="logs">${rows || '<div class="row info">No logs yet...</div>'}</div>
</body></html>`;
}

const server = http.createServer((req, response) => {
        if (req.url === '/ping') {
                response.writeHead(200, { 'Content-Type': 'text/plain' });
                return response.end(`Pong! Bot ${connected ? 'connected' : 'disconnected'}`);
        }
        if (req.url === '/logs.json') {
                response.writeHead(200, { 'Content-Type': 'application/json' });
                return response.end(JSON.stringify({ connected, logs }));
        }
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(renderPage());
});
server.listen(process.env.PORT || 3000, () => {
        console.log('Web for AntiAFK is running...');
});
