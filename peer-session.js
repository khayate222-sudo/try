import { packet, peerId, roomCode } from './remote-protocol.js';

// PeerJS's public signaling service brokers the initial WebRTC connection.
// Deployments can inject another PeerJS server via the constructor options.
export const PEER_OPTIONS = Object.freeze({ debug: 0 });

export class RemoteSession {
  constructor({ Peer, options = PEER_OPTIONS, role, code, getState = () => ({}), onReady = () => {}, onConnected = () => {}, onPacket = () => {}, onDisconnected = () => {}, onError = () => {} }) {
    Object.assign(this, { role, getState, onReady, onConnected, onPacket, onDisconnected, onError });
    this.code = code || roomCode(); this.connected = false; this.closed = false;
    this.peer = new Peer(role === 'host' ? peerId(this.code) : `pawplay-pad-${roomCode()}${roomCode()}`, options);
    this.openTimeout = setTimeout(() => this.fail('接続サービスに届きません。ネット接続を確認して、もう一度お試しください。'), 15000);
    this.peer.on('open', () => {
      if (this.closed) return;
      clearTimeout(this.openTimeout); this.onReady(this.code);
      if (role === 'controller') this.bind(this.peer.connect(peerId(this.code), { reliable: true, serialization: 'json', metadata: { app: 'pawplay-remote-v1' } }));
    });
    this.peer.on('connection', connection => {
      if (this.closed || role !== 'host' || this.connection || connection.metadata?.app !== 'pawplay-remote-v1') { connection.close(); return; }
      this.bind(connection);
    });
    this.peer.on('error', error => {
      if (this.closed || (this.connected && ['network', 'socket-error', 'server-error'].includes(error.type))) return;
      const message = error.type === 'browser-incompatible' ? 'このブラウザは端末間通信に対応していません。対応するブラウザでお試しください。' : error.type === 'peer-unavailable' ? 'TV側が見つかりません。TVで接続コードを表示してから、もう一度お試しください。' : '接続できませんでした。同じWi-Fiにつなぎ、TVのコードを確認してお試しください。';
      this.fail(message);
    });
  }
  bind(connection) {
    this.connection = connection;
    this.handshakeTimeout = setTimeout(() => this.fail('端末同士をつなげられません。同じWi-Fiを使い、ゲスト用Wi-FiやVPNを外して再接続してください。'), 18000);
    connection.on('open', () => { if (!this.closed && this.role === 'controller') this.send({ type: 'hello' }); });
    connection.on('data', raw => {
      if (this.closed || this.connection !== connection) return;
      const data = packet(raw); if (!data) return;
      this.lastSeen = performance.now();
      if (!this.connected) {
        if (this.role === 'host' && data.type === 'hello') {
          this.connected = true; clearTimeout(this.handshakeTimeout); this.onConnected(); this.sendState('welcome'); this.heartbeat();
        } else if (this.role === 'controller' && data.type === 'welcome') {
          this.connected = true; clearTimeout(this.handshakeTimeout); this.onConnected(data); this.onPacket(data); this.heartbeat();
        }
        return;
      }
      if (data.type === 'ping') { this.send({ type: 'pong' }); return; }
      if (data.type === 'pong') return;
      if (this.role === 'host' && ['move', 'hide', 'pause', 'settings'].includes(data.type)) this.onPacket(data);
      if (this.role === 'controller' && data.type === 'state') this.onPacket(data);
    });
    connection.on('close', () => this.drop(connection));
    connection.on('error', () => this.drop(connection));
  }
  heartbeat() {
    clearInterval(this.beat); this.lastSeen = performance.now();
    this.beat = setInterval(() => {
      if (!this.connected || this.closed) return;
      if (performance.now() - this.lastSeen > 7000) { this.drop(this.connection); return; }
      if (this.role === 'host') this.sendState(); else this.send({ type: 'ping' });
    }, 1000);
  }
  send(data) {
    if (this.closed || !this.connection?.open) return false;
    if (data.type === 'move' && this.connection.dataChannel?.bufferedAmount > 16384) return false;
    try { this.connection.send({ ...data, v: 1 }); return true; } catch { this.drop(this.connection); return false; }
  }
  sendState(type = 'state') { if (this.role === 'host' && this.connected) this.send({ type, ...this.getState() }); }
  drop(connection) {
    if (this.closed || !connection || this.connection !== connection) return;
    const wasConnected = this.connected;
    this.connection = null; this.connected = false;
    clearTimeout(this.handshakeTimeout); clearInterval(this.beat); connection.close();
    if (wasConnected) this.onDisconnected();
    else this.fail('接続が完了しませんでした。コードを確認して、もう一度お試しください。');
  }
  fail(message) { if (this.closed) return; this.close(); this.onError(message); }
  close() {
    if (this.closed) return;
    this.closed = true; this.connected = false;
    clearTimeout(this.openTimeout); clearTimeout(this.handshakeTimeout); clearInterval(this.beat);
    this.connection?.close(); this.peer.destroy();
  }
}
