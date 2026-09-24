/**
 * NexusFeed WebSocket Client
 * Maintains bidirectional live synchronization with the server
 */

class RealtimeFeedClient {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 15;
    this.reconnectInterval = 2000;
    this.listeners = new Map();
    this.isConnected = false;

    this.connect();
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.updateStatus(true);
        this.dispatch('open', {});
      };

      this.socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleMessage(payload);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.updateStatus(false);
        this.attemptReconnect();
      };

      this.socket.onerror = (err) => {
        console.warn('WebSocket connection error, will retry...', err);
        this.socket.close();
      };
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnection attempts reached.');
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1), 10000);
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  updateStatus(online) {
    const badge = document.getElementById('liveStatusBadge');
    const text = document.getElementById('liveStatusText');
    if (badge && text) {
      if (online) {
        badge.classList.remove('disconnected');
        text.textContent = 'Live Feed Active';
      } else {
        badge.classList.add('disconnected');
        text.textContent = 'Reconnecting...';
      }
    }
  }

  handleMessage(message) {
    const { type, data } = message;

    // Handle peer count badge
    if (type === 'ONLINE_COUNT' || (type === 'CONNECTED' && data.onlineCount)) {
      const count = type === 'ONLINE_COUNT' ? data.count : data.onlineCount;
      const countBadge = document.getElementById('peerCountBadge');
      if (countBadge) {
        countBadge.textContent = `${count} online`;
      }
    }

    // Dispatch to registered event listeners
    this.dispatch(type, data);
  }

  on(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }

  off(eventType, callback) {
    if (!this.listeners.has(eventType)) return;
    const filtered = this.listeners.get(eventType).filter(cb => cb !== callback);
    this.listeners.set(eventType, filtered);
  }

  dispatch(eventType, data) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in WebSocket listener for ${eventType}:`, err);
        }
      });
    }
  }
}

// Instantiate global live client
window.realtimeClient = new RealtimeFeedClient();
