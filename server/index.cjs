'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const { WebSocketServer, WebSocket } = require('ws');

for (const file of ['roster', 'sprites', 'transformations', 'combos', 'traits', 'skills', 'techniques', 'assists', 'engine', 'generated-manifest', 'animation-overrides', 'generated-sprites']) {
  require(`../versus/${file}.js`);
}
const DV = globalThis.DV;
const { VERSION, snapshotMatch } = require('../versus/net-protocol.js');
const roster = new Map(DV.roster.map(spec => [spec.id, spec]));
const INPUTS = new Set(['left', 'right', 'guard', 'charge']);
const COMMANDS = new Set(['attack', 'light', 'heavy', 'jump', 'dash', 'ki', 'super', 'combo', 'grab', 'counter', 'assist', 'burst', 'escape', 'transform', 'teleport', 'warp']);
const RUNTIME = new Set(['roster.js', 'sprites.js', 'transformations.js', 'combos.js', 'traits.js', 'skills.js', 'techniques.js', 'assists.js', 'engine.js', 'generated-manifest.js', 'animation-overrides.js', 'generated-sprites.js', 'render.js', 'tournament.js', 'bt3-manifest.js', 'bt3-technique-voices.js', 'bt3-audio.js', 'bt3-codecs.js', 'bt3-audit.js', 'onboarding.js', 'app.js', 'boot.js', 'styles.css', 'net-protocol.js', 'network.js', 'network-config.js', 'online-ui.js', 'online.css', 'touch-controls.js', 'touch-controls.css', 'settings-ui.js', 'settings.css', 'keyboard-settings.js']);
const MEDIA_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf' };

function createGameServer(options = {}) {
  const rootDir = fs.realpathSync(options.rootDir || path.resolve(__dirname, '..'));
  const now = options.now || Date.now;
  const maxRooms = options.maxRooms ?? 100;
  const maxConnections = options.maxConnections ?? 250;
  const maxConnectionsPerIp = options.maxConnectionsPerIp ?? 12;
  const resumeGraceMs = options.resumeGraceMs ?? 20000;
  const roomTtlMs = options.roomTtlMs ?? 20 * 60 * 1000;
  const maxMessagesPerSecond = options.maxMessagesPerSecond ?? 120;
  const allowedOrigins = new Set(options.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean));
  const rooms = new Map(), ipCounts = new Map();
  let closing = false, timer, heartbeatTimer;

  function reply(response, status, body, headers = {}) {
    response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...headers });
    response.end(body);
  }
  async function serve(request, response) {
    if (!['GET', 'HEAD'].includes(request.method)) return reply(response, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
    const raw = request.url.split('?')[0];
    let pathname;
    try { pathname = decodeURIComponent(raw); } catch { return reply(response, 400, 'Bad request'); }
    if (pathname.includes('\\') || pathname.includes('\0') || pathname.includes('%') || pathname.split('/').includes('..')) return reply(response, 400, 'Bad request');
    if (pathname === '/healthz') return reply(response, 200, request.method === 'HEAD' ? '' : JSON.stringify({ ok: true, version: VERSION }), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    if (pathname === '/') pathname = '/index.html';
    const parts = pathname.slice(1).split('/'), extension = path.extname(pathname).toLowerCase();
    const media = parts[0] === 'assets' && parts.length > 1 && MEDIA_TYPES[extension]
      && parts.every(part => part && !part.startsWith('.') && !/^(source|sources|review|reviews|tmp|tools|node_modules)$/i.test(part));
    const runtime = parts[0] === 'versus' && parts.length === 2 && RUNTIME.has(parts[1]);
    if (pathname !== '/index.html' && !media && !runtime) return reply(response, 404, 'Not found');
    const candidate = path.resolve(rootDir, '.' + pathname);
    if (!candidate.startsWith(rootDir + path.sep)) return reply(response, 404, 'Not found');
    try {
      // Reject every link in the path, including links that resolve back inside root.
      let current = rootDir;
      for (const part of parts) {
        current = path.join(current, part);
        if ((await fs.promises.lstat(current)).isSymbolicLink()) return reply(response, 404, 'Not found');
      }
      const resolved = await fs.promises.realpath(candidate);
      if (!resolved.startsWith(rootDir + path.sep)) return reply(response, 404, 'Not found');
      const stat = await fs.promises.stat(resolved);
      if (!stat.isFile()) return reply(response, 404, 'Not found');
      let start = 0, end = stat.size - 1, status = 200;
      const headers = {
        'Content-Type': MEDIA_TYPES[extension] || (extension === '.js' ? 'text/javascript; charset=utf-8' : extension === '.css' ? 'text/css; charset=utf-8' : 'text/html; charset=utf-8'),
        'Content-Length': stat.size, 'X-Content-Type-Options': 'nosniff',
        'Cache-Control': runtime || pathname === '/index.html' ? 'no-cache' : 'public, max-age=3600', 'Accept-Ranges': 'bytes'
      };
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!range || (!range[1] && !range[2])) return reply(response, 416, '', { 'Content-Range': `bytes */${stat.size}` });
        start = range[1] ? Number(range[1]) : Math.max(0, stat.size - Number(range[2]));
        end = range[1] && range[2] ? Math.min(Number(range[2]), stat.size - 1) : stat.size - 1;
        if (start > end || start >= stat.size) return reply(response, 416, '', { 'Content-Range': `bytes */${stat.size}` });
        status = 206; headers['Content-Length'] = end - start + 1; headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      }
      response.writeHead(status, headers);
      if (request.method === 'HEAD' || !stat.size) return response.end();
      const stream = fs.createReadStream(resolved, { start, end });
      stream.on('error', () => response.destroy()); response.on('close', () => stream.destroy()); stream.pipe(response);
    } catch { if (!response.headersSent) reply(response, 404, 'Not found'); else response.destroy(); }
  }
  const httpServer = http.createServer((req, res) => { void serve(req, res); });
  httpServer.requestTimeout = 15000; httpServer.headersTimeout = 10000;
  const wss = new WebSocketServer({ noServer: true, maxPayload: 2048, perMessageDeflate: false });
  function send(ws, message) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 512 * 1024) { ws.terminate(); return; }
    ws.send(JSON.stringify(message));
  }
  const error = (ws, code, message) => send(ws, { type: 'error', code, message });
  function publicRoom(room) {
    return { code: room.code, host: room.host, phase: room.phase, stageIndex: room.stageIndex,
      seats: room.seats.map((seat, side) => seat ? { side, fighterId: seat.fighterId, assistId: seat.assistId, ready: seat.ready, connected: !!seat.ws } : null) };
  }
  function updateRoom(room) {
    const view = publicRoom(room);
    room.seats.forEach((seat, side) => { if (seat?.ws) send(seat.ws, { type: 'room', version: VERSION, room: view, side, token: seat.token }); });
  }
  function broadcast(room, message) { room.seats.forEach(seat => send(seat?.ws, message)); }
  function state(room) {
    if (!room.match) return;
    broadcast(room, { type: 'state', snapshot: snapshotMatch(room.match), events: room.events.splice(0) });
  }
  function attach(ws, room, side) {
    const seat = room.seats[side]; seat.ws = ws; seat.disconnectedAt = null;
    ws.room = room; ws.side = side; room.lastActivity = now();
    if (room.match && room.phase === 'battle') room.match.paused = room.seats.some(s => s && !s.ws);
    updateRoom(room);
    if (room.match) send(ws, { type: 'started', room: publicRoom(room), snapshot: snapshotMatch(room.match) });
  }
  function seatFrom(message) {
    if (!roster.has(message.fighterId) || !roster.has(message.assistId)) return null;
    return { fighterId: message.fighterId, assistId: message.assistId, token: crypto.randomBytes(24).toString('hex'), ready: false, ws: null, disconnectedAt: null };
  }
  function migrateHost(room) {
    if (!room.seats[room.host]) room.host = room.seats.findIndex(Boolean);
    if (room.host < 0) room.host = 0;
  }
  function forfeit(room, side) {
    if (room.phase !== 'battle' || !room.match) return;
    room.match.paused = false;
    room.match.fighters[side].hp = 0;
    const opponent = room.seats[1 - side];
    if (opponent && !opponent.ws && opponent.disconnectedAt !== null && now() - opponent.disconnectedAt > resumeGraceMs) room.match.fighters[1 - side].hp = 0;
    room.match.checkEnd();
    room.phase = 'over'; state(room);
  }
  function detach(ws, explicit = false) {
    const room = ws.room, side = ws.side;
    if (!room || room.seats[side]?.ws !== ws) return;
    const seat = room.seats[side]; seat.ws = null; seat.ready = false; seat.disconnectedAt = now();
    if (room.match) for (const key of INPUTS) room.match.setInput(side, key, false);
    ws.room = null; ws.side = null;
    if (explicit) { forfeit(room, side); room.seats[side] = null; migrateHost(room); }
    else if (room.match && room.phase === 'battle') room.match.paused = true;
    room.lastActivity = now();
    if (room.seats.every(s => !s)) rooms.delete(room.code);
    else updateRoom(room);
  }
  function validCommand(message, fighter) {
    if (typeof message.action !== 'string' || message.action.length > 80) return false;
    if (!COMMANDS.has(message.action) && !/^unique:[a-zA-Z0-9_-]{1,60}$/.test(message.action)) return false;
    if (message.action.startsWith('unique:')) {
      const key = message.action.slice(7);
      if (['__proto__', 'constructor', 'prototype'].includes(key)) return false;
      if (![DV.uniqueMapOf?.(fighter), DV.resolveMoves(fighter), fighter.gainedMoves].some(table => table && Object.hasOwn(table, key))) return false;
    }
    if (message.action === 'transform') return typeof message.arg === 'string' && roster.has(message.arg);
    return message.arg === undefined;
  }
  function receive(ws, bytes, binary) {
    const currentTime = now();
    if (currentTime - ws.windowStart >= 1000) { ws.windowStart = currentTime; ws.messageCount = 0; }
    if (++ws.messageCount > maxMessagesPerSecond) { error(ws, 'RATE_LIMIT', '操作过于频繁，请稍后重试'); ws.close(1008, 'Rate limit'); return; }
    let message;
    try { if (binary) throw new Error(); message = JSON.parse(bytes.toString()); } catch { return error(ws, 'BAD_MESSAGE', '消息格式不正确'); }
    if (!message || Array.isArray(message) || typeof message !== 'object' || typeof message.type !== 'string') return error(ws, 'BAD_MESSAGE', '消息格式不正确');
    if (message.type === 'ping') {
      if (typeof message.sent !== 'number' || !Number.isFinite(message.sent)) return error(ws, 'BAD_MESSAGE', '延迟检测格式不正确');
      return send(ws, { type: 'pong', sent: message.sent });
    }
    if (['create', 'join', 'resume'].includes(message.type)) {
      if (message.version !== VERSION) return error(ws, 'VERSION_MISMATCH', '游戏版本不一致，请刷新页面');
      if (ws.room) return error(ws, 'ALREADY_IN_ROOM', '请先离开当前房间');
      if (message.type === 'create') {
        const seat = seatFrom(message);
        if (!seat) return error(ws, 'INVALID_SELECTION', '角色或援助选择不存在');
        if (rooms.size >= maxRooms) return error(ws, 'SERVER_FULL', '服务器房间已满，请稍后再试');
        let code; do { code = String(crypto.randomInt(100000, 1000000)); } while (rooms.has(code));
        const room = { code, host: 0, phase: 'lobby', stageIndex: 0, seats: [seat, null], match: null, events: [], snapshotClock: 0, lastActivity: currentTime };
        rooms.set(code, room); return attach(ws, room, 0);
      }
      if (typeof message.code !== 'string' || !/^\d{6}$/.test(message.code)) return error(ws, 'BAD_CODE', '请输入六位房间号');
      const room = rooms.get(message.code);
      if (!room) return error(ws, 'ROOM_NOT_FOUND', '房间不存在或已结束');
      if (message.type === 'resume') {
        const side = room.seats.findIndex(seat => seat && typeof message.token === 'string' && message.token === seat.token);
        const seat = room.seats[side];
        if (!seat || seat.ws || seat.disconnectedAt === null || currentTime - seat.disconnectedAt > resumeGraceMs) return error(ws, 'RESUME_DENIED', '恢复连接失败，席位已失效或仍在线');
        return attach(ws, room, side);
      }
      if (room.phase !== 'lobby') return error(ws, 'ROOM_STARTED', '对局已经开始，请等待房主返回选人');
      const side = room.seats.findIndex(seat => !seat);
      if (side < 0) return error(ws, 'ROOM_FULL', '房间已满，最多两名玩家');
      const seat = seatFrom(message);
      if (!seat) return error(ws, 'INVALID_SELECTION', '角色或援助选择不存在');
      room.seats[side] = seat; room.seats.forEach(s => { if (s) s.ready = false; }); return attach(ws, room, side);
    }
    const room = ws.room, side = ws.side;
    if (!room || room.seats[side]?.ws !== ws) return error(ws, 'NO_ROOM', '请先创建或加入房间');
    room.lastActivity = currentTime;
    const seat = room.seats[side];
    switch (message.type) {
      case 'leave': return detach(ws, true);
      case 'select': {
        if (room.phase !== 'lobby') return error(ws, 'BAD_PHASE', '请先返回房间再选人');
        if (message.stageIndex !== undefined && side !== room.host) return error(ws, 'HOST_ONLY', '只有房主可以选择地图');
        if (message.stageIndex !== undefined && (!Number.isInteger(message.stageIndex) || !DV.stages[message.stageIndex])) return error(ws, 'INVALID_SELECTION', '地图选择不存在');
        if ((message.fighterId !== undefined && !roster.has(message.fighterId)) || (message.assistId !== undefined && !roster.has(message.assistId))) return error(ws, 'INVALID_SELECTION', '角色或援助选择不存在');
        if (message.fighterId !== undefined) seat.fighterId = message.fighterId;
        if (message.assistId !== undefined) seat.assistId = message.assistId;
        if (message.stageIndex !== undefined) room.stageIndex = message.stageIndex;
        room.seats.forEach(s => { if (s) s.ready = false; }); return updateRoom(room);
      }
      case 'ready':
        if (room.phase !== 'lobby') return error(ws, 'BAD_PHASE', '当前不能更改准备状态');
        if (typeof message.value !== 'boolean') return error(ws, 'BAD_MESSAGE', '准备状态格式不正确');
        seat.ready = message.value; return updateRoom(room);
      case 'start': {
        if (side !== room.host) return error(ws, 'HOST_ONLY', '只有房主可以开始对战');
        if (room.phase !== 'lobby') return error(ws, 'BAD_PHASE', '对局已经开始');
        if (!room.seats.every(s => s?.ready && s.ws)) return error(ws, 'NOT_READY', '请等待双方加入并准备');
        const [a, b] = room.seats;
        room.events = [];
        room.match = new DV.Match({ p1: roster.get(a.fighterId), p2: roster.get(b.fighterId), assist1: roster.get(a.assistId), assist2: roster.get(b.assistId), mode: 'local', intro: true, seed: crypto.randomInt(1, 0x7fffffff), onEvent: (name, data) => { if (room.events.length < 160) room.events.push([name, data]); } });
        room.phase = 'battle'; room.snapshotClock = 0; updateRoom(room);
        return broadcast(room, { type: 'started', room: publicRoom(room), snapshot: snapshotMatch(room.match) });
      }
      case 'input':
        if (!INPUTS.has(message.key) || typeof message.value !== 'boolean') return error(ws, 'INVALID_INPUT', '操作按键不正确');
        if (room.phase !== 'battle') return error(ws, 'BAD_PHASE', '当前不能进行战斗操作');
        if (room.match.paused && message.value) return;
        return room.match.setInput(side, message.key, message.value);
      case 'command':
        if (room.phase !== 'battle') return error(ws, 'BAD_PHASE', '当前不能进行战斗操作');
        if (!validCommand(message, room.match.fighters[side])) return error(ws, 'INVALID_COMMAND', '战斗指令不正确');
        room.match.command(side, message.action, message.arg); return;
      case 'lobby':
        if (side !== room.host) return error(ws, 'HOST_ONLY', '只有房主可以返回选人');
        if (room.phase === 'battle') return error(ws, 'BAD_PHASE', '请等待当前对局结束');
        room.phase = 'lobby'; room.match = null; room.events = [];
        room.seats.forEach(s => { if (s) s.ready = false; }); return updateRoom(room);
      default: return error(ws, 'BAD_MESSAGE', '不支持的消息类型');
    }
  }
  httpServer.on('upgrade', (request, socket, head) => {
    const reject = (status, message) => { socket.end(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); };
    if (closing || request.url.split('?')[0] !== '/rooms') return reject(404, 'Not Found');
    const origin = request.headers.origin;
    if (allowedOrigins.size && (!origin || !allowedOrigins.has(origin))) return reject(403, 'Forbidden');
    const ip = request.socket.remoteAddress || '';
    if (wss.clients.size >= maxConnections || (ipCounts.get(ip) || 0) >= maxConnectionsPerIp) return reject(503, 'Service Unavailable');
    wss.handleUpgrade(request, socket, head, ws => { ws.ip = ip; wss.emit('connection', ws, request); });
  });
  wss.on('connection', ws => {
    ipCounts.set(ws.ip, (ipCounts.get(ws.ip) || 0) + 1);
    ws.windowStart = now(); ws.messageCount = 0; ws.alive = true;
    ws.on('pong', () => { ws.alive = true; });
    ws.on('message', (bytes, binary) => receive(ws, bytes, binary));
    ws.on('error', () => {});
    ws.on('close', () => { ipCounts.set(ws.ip, Math.max(0, (ipCounts.get(ws.ip) || 1) - 1)); detach(ws); });
  });
  function tick() {
    const currentTime = now();
    for (const room of rooms.values()) {
      for (const [side, seat] of room.seats.entries()) {
        if (seat && !seat.ws && seat.disconnectedAt !== null && currentTime - seat.disconnectedAt > resumeGraceMs) {
          forfeit(room, side); room.seats[side] = null; migrateHost(room); updateRoom(room);
        }
      }
      if (room.seats.every(s => !s?.ws) && currentTime - room.lastActivity > roomTtlMs) { rooms.delete(room.code); continue; }
      if (!room.match) continue;
      room.snapshotClock++;
      room.match.step();
      if (room.match.phase === 'over' && room.phase !== 'over') { room.phase = 'over'; state(room); updateRoom(room); }
      else if (room.snapshotClock % 3 === 0) state(room);
    }
  }
  async function start(port = 0, host = '127.0.0.1') {
    await new Promise((resolve, reject) => { httpServer.once('error', reject); httpServer.listen(port, host, () => { httpServer.removeListener('error', reject); resolve(); }); });
    if (options.autoTick !== false) {
      let previous = performance.now(), accumulator = 0;
      timer = setInterval(() => {
        const current = performance.now(); accumulator += Math.min(current - previous, 100); previous = current;
        let steps = 0;
        while (accumulator >= 1000 / 60 && steps++ < 6) { accumulator -= 1000 / 60; tick(); }
      }, 8);
      timer.unref();
    }
    heartbeatTimer = setInterval(() => {
      for (const ws of wss.clients) { if (!ws.alive) ws.terminate(); else { ws.alive = false; ws.ping(); } }
    }, 10000); heartbeatTimer.unref();
    return httpServer.address();
  }
  async function close() {
    closing = true; clearInterval(timer); clearInterval(heartbeatTimer);
    for (const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    if (httpServer.listening) await new Promise(resolve => { httpServer.close(resolve); httpServer.closeAllConnections(); });
    rooms.clear(); ipCounts.clear();
  }
  return { httpServer, wss, rooms, start, close, tick };
}

module.exports = { createGameServer };
if (require.main === module) {
  const server = createGameServer();
  const port = Number(process.env.PORT || 4173);
  server.start(port, '0.0.0.0').then(address => console.log(`Dragon Clash listening on ${address.port}`)).catch(error => { console.error(error); process.exitCode = 1; });
  const shutdown = () => { void server.close().then(() => { process.exitCode = 0; }); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
}
