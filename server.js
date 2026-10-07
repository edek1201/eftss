/**
 * EFT Tactical 2D - Server Entrypoint & Dual-Transport Network Server
 * Supports Pre-Raid Squad Lobby, Dynamic Map Switching, In-Raid Container Loot Sync,
 * and 30Hz Synchronized Deployment.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RoomManager, SERVER_TICK_RATE } from './server/game-engine.js';
import { AccountStore } from './server/account-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const accountStore = new AccountStore(
  process.env.EFT_ACCOUNTS_FILE || path.join(__dirname, 'data', 'accounts.json')
);
const sessions = new Map();
const authAttempts = new Map();
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'text/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  handleHttpRequest(req, res).catch((error) => {
    console.error('[EFT] HTTP request failed:', error);
    if (!res.headersSent) sendJson(res, 500, { error: 'Internal server error' });
    else res.destroy();
  });
});

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(data));
}

function sessionCookie(token, maxAge = Math.floor(SESSION_TTL_MS / 1000)) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `eft_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function getSession(req) {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader.split(';').map((entry) => entry.trim())
    .find((entry) => entry.startsWith('eft_session='))
    ?.slice('eft_session='.length);
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, session };
}

function getClientIp(req) {
  return req.socket.remoteAddress || 'unknown';
}

function enforceAuthRateLimit(req) {
  const now = Date.now();
  for (const [ip, attempt] of authAttempts) {
    if (attempt.resetAt <= now) authAttempts.delete(ip);
  }
  const ip = getClientIp(req);
  const attempt = authAttempts.get(ip);
  if (attempt && attempt.count >= 12) {
    throw new HttpError(429, 'Too many attempts. Please wait before trying again.');
  }
  authAttempts.set(ip, attempt && attempt.resetAt > now
    ? { count: attempt.count + 1, resetAt: attempt.resetAt }
    : { count: 1, resetAt: now + 15 * 60 * 1000 });
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 300 * 1024) throw new HttpError(413, 'Request body is too large');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON request');
  }
}

function validateProfile(profile) {
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
    throw new HttpError(400, 'Invalid operator profile');
  }
  if (typeof profile.callsign !== 'string' || !profile.callsign.trim() || profile.callsign.length > 16) {
    throw new HttpError(400, 'Callsign must be 1-16 characters');
  }
  if (!['USEC', 'BEAR'].includes(profile.faction)) {
    throw new HttpError(400, 'Choose a valid PMC faction');
  }
  if (typeof profile.roubles !== 'number' || !Number.isFinite(profile.roubles) || profile.roubles < 0) {
    throw new HttpError(400, 'Invalid operator balance');
  }
  if (!profile.stats || typeof profile.stats !== 'object' || Array.isArray(profile.stats) ||
      !profile.loadout || typeof profile.loadout !== 'object' || Array.isArray(profile.loadout) ||
      !Array.isArray(profile.stashItems)) {
    throw new HttpError(400, 'Operator profile is incomplete');
  }
  if (Buffer.byteLength(JSON.stringify(profile), 'utf8') > 256 * 1024) {
    throw new HttpError(413, 'Operator profile is too large');
  }
  return JSON.parse(JSON.stringify(profile));
}

function publicAccount(account) {
  return { username: account.username, profile: account.profile };
}

async function handleApiRequest(req, res, url) {
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && req.headers.origin) {
    let originHost;
    try {
      originHost = new URL(req.headers.origin).host;
    } catch {
      throw new HttpError(403, 'Request origin is not allowed');
    }
    if (originHost !== req.headers.host) {
      throw new HttpError(403, 'Request origin is not allowed');
    }
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/me') {
    const current = getSession(req);
    if (!current) {
      sendJson(res, 200, { authenticated: false });
      return;
    }
    await accountStore.ready;
    const account = accountStore.accounts.get(current.session.usernameKey);
    if (!account) {
      sessions.delete(current.token);
      sendJson(res, 200, { authenticated: false }, {
        'Set-Cookie': sessionCookie('', 0)
      });
      return;
    }
    sendJson(res, 200, { authenticated: true, account: publicAccount(account) });
    return;
  }

  if (req.method === 'POST' && ['/api/auth/register', '/api/auth/login'].includes(url.pathname)) {
    enforceAuthRateLimit(req);
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Invalid account request');
    }
    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!/^[a-zA-Z0-9_.-]{3,20}$/.test(username)) {
      throw new HttpError(400, 'Username must be 3-20 letters, numbers, dots, dashes, or underscores');
    }
    if (password.length < 8 || password.length > 128) {
      throw new HttpError(400, 'Password must be 8-128 characters');
    }

    let account;
    if (url.pathname === '/api/auth/register') {
      const callsign = typeof body.callsign === 'string' ? body.callsign.trim() : '';
      if (!callsign || callsign.length > 16) {
        throw new HttpError(400, 'Callsign must be 1-16 characters');
      }
      if (!['USEC', 'BEAR'].includes(body.faction)) {
        throw new HttpError(400, 'Choose a valid PMC faction');
      }
      const profile = validateProfile(body.profile);
      if (profile.callsign !== callsign || profile.faction !== body.faction) {
        throw new HttpError(400, 'Operator details do not match the profile');
      }
      try {
        account = await accountStore.createAccount(username, password, profile);
      } catch (error) {
        if (error.code === 'ACCOUNT_EXISTS') {
          throw new HttpError(409, error.message);
        }
        throw error;
      }
    } else {
      account = await accountStore.authenticate(username, password);
      if (!account) throw new HttpError(401, 'Incorrect username or password');
    }

    const token = crypto.randomBytes(32).toString('base64url');
    sessions.set(token, {
      usernameKey: account.usernameKey,
      expiresAt: Date.now() + SESSION_TTL_MS
    });
    sendJson(res, 200, { authenticated: true, account: publicAccount(account) }, {
      'Set-Cookie': sessionCookie(token)
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/logout') {
    const current = getSession(req);
    if (current) sessions.delete(current.token);
    sendJson(res, 200, { ok: true }, { 'Set-Cookie': sessionCookie('', 0) });
    return;
  }

  if (req.method === 'PUT' && url.pathname === '/api/auth/profile') {
    const current = getSession(req);
    if (!current) throw new HttpError(401, 'Please sign in again');
    const body = await readJsonBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'Invalid profile request');
    }
    const profile = validateProfile(body.profile);
    if (!await accountStore.saveProfile(current.session.usernameKey, profile)) {
      throw new HttpError(401, 'Please sign in again');
    }
    sendJson(res, 200, { ok: true });
    return;
  }

  throw new HttpError(404, 'API endpoint not found');
}

async function handleHttpRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApiRequest(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.message });
        return;
      }
      throw error;
    }
    return;
  }

  let reqUrl = url.pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  const isSharedFile = reqUrl.startsWith('/shared/');
  const allowedRoot = path.resolve(__dirname, isSharedFile ? 'shared' : 'public');
  const relativeUrl = isSharedFile ? reqUrl.slice('/shared/'.length) : reqUrl.replace(/^\/+/, '');
  const normalizedPath = path.resolve(allowedRoot, relativeUrl);
  if (normalizedPath !== allowedRoot && !normalizedPath.startsWith(allowedRoot + path.sep)) {
    res.writeHead(403);
    res.end('Access Denied');
    return;
  }

  fs.stat(normalizedPath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(normalizedPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    fs.createReadStream(normalizedPath).pipe(res);
  });
}

const roomManager = new RoomManager();
const socketClients = new Map();

function broadcastToRoom(roomCode, payloadObject) {
  const room = roomManager.rooms.get(roomCode);
  if (!room) return;

  const jsonStr = JSON.stringify(payloadObject);
  for (const socketId of room.players.keys()) {
    const sendFn = socketClients.get(socketId);
    if (sendFn) {
      sendFn(jsonStr);
    }
  }
}

function broadcastSnapshotToRoom(roomCode, snapshot) {
  broadcastToRoom(roomCode, { type: 'snapshot', data: snapshot });
}

// RFC 6455 WebSocket Implementation
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeWsFrame(dataString) {
  const payload = Buffer.from(dataString, 'utf8');
  const length = payload.length;
  let header;

  if (length <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = length;
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

server.on('upgrade', (req, socket, head) => {
  if (req.headers['upgrade']?.toLowerCase() !== 'websocket') {
    socket.destroy();
    return;
  }

  if (!getSession(req)) {
    socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(key + WS_GUID)
    .digest('base64');

  const responseHeaders = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${acceptKey}`
  ];

  socket.write(responseHeaders.join('\r\n') + '\r\n\r\n');

  const socketId = 's_' + crypto.randomBytes(6).toString('hex');
  const sendFn = (msg) => {
    if (!socket.destroyed) {
      socket.write(encodeWsFrame(msg));
    }
  };

  socketClients.set(socketId, sendFn);

  let buffer = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);

    while (buffer.length >= 2) {
      const byte1 = buffer[0];
      const byte2 = buffer[1];
      const opcode = byte1 & 0x0f;
      const isMasked = (byte2 & 0x80) !== 0;
      let payloadLength = byte2 & 0x7f;
      let offset = 2;

      if (opcode === 0x8) {
        socket.end();
        return;
      }

      if (payloadLength === 126) {
        if (buffer.length < 4) return;
        payloadLength = buffer.readUInt16BE(2);
        offset = 4;
      } else if (payloadLength === 127) {
        if (buffer.length < 10) return;
        payloadLength = Number(buffer.readBigUInt64BE(2));
        offset = 10;
      }

      let maskKey = null;
      if (isMasked) {
        if (buffer.length < offset + 4) return;
        maskKey = buffer.subarray(offset, offset + 4);
        offset += 4;
      }

      if (buffer.length < offset + payloadLength) return;

      const payload = buffer.subarray(offset, offset + payloadLength);
      buffer = buffer.subarray(offset + payloadLength);

      if (isMasked && maskKey) {
        for (let i = 0; i < payload.length; i++) {
          payload[i] ^= maskKey[i % 4];
        }
      }

      if (opcode === 0x1) {
        try {
          const msgStr = payload.toString('utf8');
          const message = JSON.parse(msgStr);
          handleClientMessage(socketId, message, sendFn);
        } catch (e) {
          console.error('Error handling WebSocket message:', e);
        }
      } else if (opcode === 0x9) {
        const pongHeader = Buffer.from([0x8a, 0x00]);
        socket.write(pongHeader);
      }
    }
  });

  socket.on('close', () => {
    handleClientDisconnect(socketId);
  });

  socket.on('error', (err) => {
    console.warn(`Socket [${socketId}] error:`, err.message);
    handleClientDisconnect(socketId);
  });
});

function handleClientMessage(socketId, message, sendFn) {
  const { type, data } = message;

  switch (type) {
    case 'join': {
      const roomCode = data?.room || 'EFT1';
      const playerName = data?.name || 'Operator';
      const { room, player } = roomManager.joinRoom(
        socketId,
        roomCode,
        playerName,
        broadcastSnapshotToRoom
      );

      if (player) {
        sendFn(JSON.stringify({
          type: 'joinedLobby',
          data: {
            playerId: player.id,
            isHost: player.isHost,
            room: room.getLobbyState()
          }
        }));

        broadcastToRoom(room.code, {
          type: 'lobbyUpdate',
          data: room.getLobbyState()
        });
      }
      break;
    }

    case 'selectMap': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room) {
        const result = room.selectMap(socketId, data?.mapId);
        if (result.success) {
          broadcastToRoom(room.code, {
            type: 'lobbyUpdate',
            data: room.getLobbyState()
          });
        }
      }
      break;
    }

    case 'deploySquad': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room) {
        const result = room.deployRaid(socketId);
        if (result.success) {
          broadcastToRoom(room.code, {
            type: 'raidStarted',
            data: {
              roomCode: room.code,
              mapId: room.map.id,
              mapName: room.map.name,
              mapWidth: room.map.width,
              mapHeight: room.map.height,
              tileSize: room.map.tileSize,
              extractZones: room.map.extractZones,
              containers: Array.from(room.containers.values()),
              raidDuration: room.raidTimeRemaining
            }
          });
        }
      }
      break;
    }

    case 'getContainerLoot': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data?.containerId) {
        const containerData = room.getContainerData(data.containerId);
        if (containerData) {
          sendFn(JSON.stringify({
            type: 'containerData',
            data: containerData
          }));
        }
      }
      break;
    }

    case 'lootNoise': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data?.containerId) room.alertScavsToLooting(socketId, data.containerId);
      break;
    }

    case 'transferContainerItem': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data?.containerId) {
        const success = room.transferContainerItem(
          data.containerId,
          data.itemId,
          data.action,
          data.targetItem
        );
        if (success) {
          const updated = room.getContainerData(data.containerId);
          if (updated) {
            broadcastToRoom(room.code, {
              type: 'containerUpdated',
              data: updated
            });
          } else {
            broadcastToRoom(room.code, {
              type: 'containerRemoved',
              data: { id: data.containerId }
            });
          }
        }
      }
      break;
    }

    case 'dropItem':
    case 'dropWeapon': {
      const room = roomManager.getRoomBySocket(socketId);
      const itemKey = data?.itemKey || data?.weaponType;
      if (room && data?.itemId && itemKey) {
        const groundContainer = room.dropItem(
          socketId,
          data.itemId,
          itemKey,
          data.sourceContainerId,
          data.itemState || data
        );
        if (groundContainer && data.sourceContainerId) {
          const updated = room.getContainerData(data.sourceContainerId);
          broadcastToRoom(room.code, {
            type: updated ? 'containerUpdated' : 'containerRemoved',
            data: updated || { id: data.sourceContainerId }
          });
        }
      }
      break;
    }

    case 'throwGrenade': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data?.grenadeKey && Number.isFinite(data.angle)) {
        room.throwPlayerGrenade(socketId, data.grenadeKey, data.angle);
      }
      break;
    }

    case 'input': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data) {
        room.enqueueInput(socketId, data);
      }
      break;
    }

    case 'ping': {
      sendFn(JSON.stringify({
        type: 'pong',
        data: {
          clientTime: data?.clientTime || 0,
          serverTime: Date.now()
        }
      }));
      break;
    }
  }
}

function handleClientDisconnect(socketId) {
  const room = roomManager.getRoomBySocket(socketId);
  if (room) {
    roomManager.leaveRoom(socketId);
    broadcastToRoom(room.code, {
      type: 'lobbyUpdate',
      data: room.getLobbyState()
    });
  }
  socketClients.delete(socketId);
}

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  EFT TACTICAL 2D - EXTRACTION SHOOTER ENGINE`);
  console.log(`=======================================================`);
  console.log(`* Status: Authoritative Server Online`);
  console.log(`* Tickrate: ${SERVER_TICK_RATE} Hz (${1000 / SERVER_TICK_RATE}ms step)`);
  console.log(`* Local Access: http://localhost:${PORT}`);
  console.log(`* Network Transport: Universal WebSockets (RFC 6455 Ready)`);
  console.log(`=======================================================`);
});
