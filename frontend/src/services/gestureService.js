/**
 * GestureService — singleton WebSocket client for the Python gesture server.
 * Action names are kept in sync with App.jsx handleGestureDetected switch cases.
 */
class GestureService {
  constructor() {
    this.ws                  = null;
    this.isConnected         = false;
    this.isConnecting        = false;
    this.listeners           = new Map();
    this.reconnectAttempts   = 0;
    this.maxReconnectAttempts = 10;
    this._reconnectTimer     = null;
    this._pingTimer          = null;
    this._intentionalClose   = false;

    this.config = {
      wsUrl:           'ws://localhost:8765',
      pingIntervalMs:  25000,
      reconnectBaseMs: 2000,
    };

    // Maps Python gesture name  →  action name used in App.jsx switch()
    this.GESTURE_ACTION_MAP = {
      'thumbs_up':   'bookmark',
      'peace':       'summary',
      'open_palm':   'showDocuments',
      'fist':        'close',
      'pointing':    'select',
      'rock_sign':   'rock',
      'ok_sign':     'confirm',
      'three':       'three',
      'four':        'four',
      'swipe_left':  'prevPage',
      'swipe_right': 'nextPage',
      'swipe_up':    'prevDocument',
      'swipe_down':  'nextDocument',
      'pinch_in':    'zoomOut',
      'pinch_out':   'zoomIn',
      'pinch_close': 'select',
      'pinch_open':  'zoomReset',
    };

    console.log('[GestureService] Initialised');
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  connect() {
    if (this.isConnected || this.isConnecting) {
      return Promise.resolve();
    }

    this._intentionalClose = false;

    return new Promise((resolve, reject) => {
      this.isConnecting = true;
      console.log(`[GestureService] Connecting → ${this.config.wsUrl}`);

      let settled = false;
      const settle = (fn, val) => {
        if (settled) return;
        settled = true;
        fn(val);
      };

      // Connection timeout
      const timeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('[GestureService] Connection timeout');
          this.ws?.close();
          this.isConnecting = false;
          settle(reject, new Error('Connection timeout'));
        }
      }, 8000);

      try {
        this.ws = new WebSocket(this.config.wsUrl);

        this.ws.onopen = () => {
          clearTimeout(timeout);
          this.isConnected      = true;
          this.isConnecting     = false;
          this.reconnectAttempts = 0;
          console.log('[GestureService] ✅ Connected');
          this._startPing();
          this.emit('connected', { timestamp: Date.now() });
          settle(resolve);
        };

        this.ws.onmessage = (ev) => {
          try {
            this._handleMessage(JSON.parse(ev.data));
          } catch (e) {
            console.warn('[GestureService] Bad JSON:', ev.data);
          }
        };

        this.ws.onclose = (ev) => {
          clearTimeout(timeout);
          this.isConnected  = false;
          this.isConnecting = false;
          this._stopPing();
          console.log(`[GestureService] Closed  code=${ev.code}`);
          this.emit('disconnected', { code: ev.code });

          if (!this._intentionalClose && ev.code !== 1000) {
            this._scheduleReconnect();
          }
          // Reject the original promise only if we never connected
          settle(reject, new Error(`WebSocket closed (${ev.code})`));
        };

        this.ws.onerror = () => {
          // onerror fires before onclose; let onclose handle reconnect logic
          this.isConnecting = false;
          const msg = 'Cannot connect to gesture server — is it running?';
          console.error(`[GestureService] ❌ ${msg}`);
          this.emit('error', { error: msg });
          settle(reject, new Error(msg));
        };

      } catch (e) {
        clearTimeout(timeout);
        this.isConnecting = false;
        settle(reject, e);
      }
    });
  }

  disconnect() {
    this._intentionalClose = true;
    this._stopPing();
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
    this.isConnected      = false;
    this.isConnecting     = false;
    this.reconnectAttempts = 0;
    console.log('[GestureService] Disconnected intentionally');
  }

  on(event, cb)  {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
  }

  off(event, cb) {
    this.listeners.get(event)?.delete(cb);
  }

  emit(event, data) {
    this.listeners.get(event)?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(`[GestureService] Listener error (${event}):`, e); }
    });
  }

  sendCommand(command, data = {}) {
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'command', command, data, timestamp: Date.now() }));
      return true;
    }
    return false;
  }

  requestStatus()       { return this.sendCommand('get_status'); }
  resetGestureHistory() { return this.sendCommand('reset_gesture_history'); }

  getStatus() {
    return {
      connected:         this.isConnected,
      connecting:        this.isConnecting,
      reconnectAttempts: this.reconnectAttempts,
      wsUrl:             this.config.wsUrl,
    };
  }

  // ── Private ────────────────────────────────────────────────────────────────

  _handleMessage(data) {
    const { type } = data;

    if (type === 'gesture') {
      // Resolve action — prefer server-provided, fall back to our map
      const action = this.GESTURE_ACTION_MAP[data.gesture] ?? data.action ?? data.gesture;

      const gestureEvent = {
        gesture:        data.gesture,
        action,
        confidence:     data.confidence ?? 1,
        detection_type: data.detection_type ?? 'static',
        timestamp:      data.timestamp ?? Date.now(),
        // shape expected by GestureRecognition.jsx getGestureDisplay()
        display: {
          name:        data.gesture,
          emoji:       this._emoji(data.gesture),
          description: action,
        },
      };

      console.log(`[GestureService] 🎯 ${data.gesture} → ${action}  (${(gestureEvent.confidence * 100).toFixed(0)}%)`);
      this.emit('gesture', gestureEvent);

    } else if (type === 'status') {
      this.emit('status', data);

    } else if (type === 'pong') {
      // keep-alive acknowledged

    } else if (type === 'hand_detected') {
      this.emit('hand_detected', data);

    } else if (type === 'hand_lost') {
      this.emit('hand_lost', data);
    }
  }

  _emoji(gesture) {
    const MAP = {
      thumbs_up:   '👍', peace:       '✌️', open_palm:   '✋',
      fist:        '✊', pointing:    '👉', ok_sign:     '👌',
      rock_sign:   '🤘', three:       '🖖', four:        '🖐️',
      swipe_left:  '◀️', swipe_right: '▶️', swipe_up:    '⬆️',
      swipe_down:  '⬇️', pinch_in:    '🤏', pinch_out:   '🖐️',
      pinch_close: '🤏', pinch_open:  '🖐️',
    };
    return MAP[gesture] ?? '❓';
  }

  _startPing() {
    this._stopPing();
    this._pingTimer = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.config.pingIntervalMs);
  }

  _stopPing() {
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
  }

  _scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('[GestureService] Max reconnect attempts reached');
      this.emit('error', { error: 'Could not reconnect to gesture server' });
      return;
    }
    this.reconnectAttempts++;
    const delay = Math.min(this.config.reconnectBaseMs * this.reconnectAttempts, 15000);
    console.log(`[GestureService] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this._reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}

const gestureService = new GestureService();
export default gestureService;