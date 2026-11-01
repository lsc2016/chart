// 끊기면 다시 붙는 WebSocket. 폰에서 화면을 껐다 켜도 이어지게
export class ReconnectingSocket {
  constructor(url, { onOpen, onMessage, name = 'ws' } = {}) {
    this.url = url;
    this.onOpen = onOpen;
    this.onMessage = onMessage;
    this.name = name;
    this.closed = false;
    this.retry = 0;
    this._visHandler = () => {
      if (document.visibilityState === 'visible' && !this.closed && (!this.ws || this.ws.readyState > 1)) this._connect();
    };
    document.addEventListener('visibilitychange', this._visHandler);
    this._connect();
  }
  _connect() {
    clearTimeout(this._timer);
    try {
      this.ws = new WebSocket(this.url);
    } catch (e) {
      return this._schedule();
    }
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => { this.retry = 0; this.onOpen?.(this.ws); };
    this.ws.onmessage = (e) => {
      const text = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data);
      try { this.onMessage?.(JSON.parse(text)); } catch { /* 무시 */ }
    };
    this.ws.onclose = () => this._schedule();
    this.ws.onerror = () => { try { this.ws.close(); } catch { /* */ } };
  }
  _schedule() {
    if (this.closed) return;
    clearTimeout(this._timer);
    const delay = Math.min(30000, 1000 * 2 ** this.retry++);
    this._timer = setTimeout(() => this._connect(), delay);
  }
  send(obj) {
    if (this.ws?.readyState === 1) this.ws.send(typeof obj === 'string' ? obj : JSON.stringify(obj));
  }
  close() {
    this.closed = true;
    clearTimeout(this._timer);
    document.removeEventListener('visibilitychange', this._visHandler);
    try { this.ws?.close(); } catch { /* */ }
  }
}
