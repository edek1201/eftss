/**
 * EFT Tactical 2D - Universal Network Client Adapter
 * Handles Pre-Raid Lobby Sync, Map Switching, Synchronized Deployment, and 20Hz Snapshots
 */

export class NetworkClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.latency = 0;

    // Callbacks
    this.onJoinedLobby = null;
    this.onLobbyUpdate = null;
    this.onRaidStarted = null;
    this.onSnapshot = null;
    this.onContainerUpdated = null;
    this.onContainerRemoved = null;
    this.onDisconnect = null;

    this.pingInterval = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
          this.isConnected = true;
          this._startPing();
          resolve(true);
        };

        this.socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this._handleMessage(message);
          } catch (e) {
            console.error('Failed to parse network message:', e);
          }
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          this._stopPing();
          if (this.onDisconnect) this.onDisconnect();
        };

        this.socket.onerror = (err) => {
          console.warn('WebSocket connection error:', err);
          if (!this.isConnected) {
            reject(err);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  _startPing() {
    this._stopPing();
    this.pingInterval = setInterval(() => {
      if (this.isConnected) {
        this.send('ping', { clientTime: performance.now() });
      }
    }, 2000);
  }

  _stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  _handleMessage(msg) {
    const { type, data } = msg;
    switch (type) {
      case 'joinedLobby':
        if (this.onJoinedLobby) this.onJoinedLobby(data);
        break;

      case 'lobbyUpdate':
        if (this.onLobbyUpdate) this.onLobbyUpdate(data);
        break;

      case 'raidStarted':
        if (this.onRaidStarted) this.onRaidStarted(data);
        break;

      case 'snapshot':
        if (this.onSnapshot) this.onSnapshot(data);
        break;

      case 'containerUpdated':
        if (this.onContainerUpdated) this.onContainerUpdated(data);
        break;

      case 'containerRemoved':
        if (this.onContainerRemoved) this.onContainerRemoved(data);
        break;

      case 'pong':
        if (data && data.clientTime) {
          this.latency = Math.round(performance.now() - data.clientTime);
        }
        break;
    }
  }

  send(type, data) {
    if (this.isConnected && this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, data }));
    }
  }

  joinRoom(roomCode, playerName) {
    this.send('join', { room: roomCode, name: playerName });
  }

  selectMap(mapId) {
    this.send('selectMap', { mapId });
  }

  deploySquad() {
    this.send('deploySquad', {});
  }

  sendInput(inputPayload) {
    this.send('input', inputPayload);
  }
}
