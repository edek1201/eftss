/**
 * EFT Tactical 2D - Server Entrypoint & Dual-Transport Network Server
 * Supports Pre-Raid Squad Lobby, Dynamic Map Switching, In-Raid Container Loot Sync,
 * and 20Hz Synchronized Deployment.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { RoomManager, SERVER_TICK_RATE } from './server/game-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;

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
  let reqUrl = req.url.split('?')[0];
  if (reqUrl === '/') reqUrl = '/index.html';

  let filePath;
  if (reqUrl.startsWith('/shared/')) {
    filePath = path.join(__dirname, reqUrl);
  } else {
    filePath = path.join(__dirname, 'public', reqUrl);
  }

  const normalizedPath = path.normalize(filePath);
  if (!normalizedPath.startsWith(__dirname)) {
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
});

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

    case 'dropWeapon': {
      const room = roomManager.getRoomBySocket(socketId);
      if (room && data?.itemId && data?.weaponType) {
        const groundContainer = room.dropWeapon(
          socketId,
          data.itemId,
          data.weaponType,
          data.sourceContainerId,
          data.ammoCur,
          data.ammoMax
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
