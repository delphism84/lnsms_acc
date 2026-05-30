const WebSocket = require('ws');
const { verifyToken } = require('../lib/jwt');
const { frame, topicMatches } = require('./lunar');

/** @type {import('ws').WebSocketServer | null} */
let wss = null;
const clients = new Set();

function send(ws, tag, msg, extra = {}) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(frame({ tag, msg, ...extra })));
}

function isAllowed(ws, userid, storeId) {
  if (!ws.session?.authed) return false;
  if (ws.session.aud === 'platform') return true;
  return ws.session.aud === 'host' && ws.session.userid === userid && ws.session.storeId === storeId;
}

function broadcastFrame(evt, { userid, storeId, topic }) {
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN || !ws.session?.authed) continue;
    if (userid && storeId && !isAllowed(ws, userid, storeId)) continue;
    const subs = ws.session.topics || [];
    const t = topic || evt.topic;
    if (subs.length && t && !subs.some((p) => topicMatches(p, t))) continue;
    ws.send(JSON.stringify(evt));
  }
}

function attachWsGateway(httpServer) {
  wss = new WebSocket.Server({ server: httpServer, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.session = { authed: false, aud: null, userid: null, storeId: null, topics: [] };
    clients.add(ws);

    ws.on('message', (raw) => {
      let data;
      try {
        data = JSON.parse(String(raw));
      } catch {
        return send(ws, 'ERR.parse', { message: 'invalid JSON' });
      }

      const tag = String(data.tag || '');
      const msg = data.msg || {};

      if (tag === 'REQ.hello') {
        try {
          const token = msg.token || msg.accessToken;
          if (!token) return send(ws, 'ERR.auth', { message: 'token required' });
          const decoded = verifyToken(token);
          if (decoded.typ === 'refresh') return send(ws, 'ERR.auth', { message: 'access token required' });
          ws.session.authed = true;
          ws.session.aud = decoded.aud;
          ws.session.userid = decoded.userid || null;
          ws.session.storeId = decoded.storeId || null;
          ws.session.username = decoded.username || null;
          return send(ws, 'REP.hello', {
            aud: decoded.aud,
            userid: decoded.userid,
            storeId: decoded.storeId,
            username: decoded.username,
          });
        } catch {
          return send(ws, 'ERR.auth', { message: 'invalid token' });
        }
      }

      if (!ws.session.authed) {
        return send(ws, 'ERR.auth', { message: 'hello required' });
      }

      if (tag === 'REQ.listen') {
        const topics = Array.isArray(msg.topics) ? msg.topics.map(String) : [];
        ws.session.topics = topics;
        return send(ws, 'REP.listen', { topics });
      }

      if (tag === 'REQ.ping') {
        return send(ws, 'REP.pong', { ts: Date.now() });
      }

      if (tag === 'REQ.ingest') {
        const { ingestBell } = require('./bell');
        const eventId = String(msg.eventId || data.trid || '').trim();
        const eqId = String(msg.eqId || msg.eqid || '').trim();
        const userid = String(msg.userid || ws.session.userid || '').trim();
        const storeId = String(msg.storeId || ws.session.storeId || '').trim();

        ingestBell({ eventId, eqId, userid, storeId, payload: msg })
          .then((result) => send(ws, 'REP.ingest', result))
          .catch((err) => send(ws, 'ERR.ingest', { message: err.message || 'ingest failed' }));
        return;
      }

      return send(ws, 'ERR.unknown', { message: `unsupported tag: ${tag}` });
    });

    ws.on('close', () => clients.delete(ws));
    ws.on('error', () => clients.delete(ws));
  });

  console.log('WS gateway attached at /ws');
  return wss;
}

function broadcastEvt({ userid, storeId, entity, action, id, payload }) {
  const topic = `lnsms.store.${userid}.${storeId}.${entity}`;
  const evt = frame({
    topic,
    tag: 'EVT.changed',
    msg: { action, id, entity, ...(payload || {}) },
  });
  broadcastFrame(evt, { userid, storeId, topic });
}

function broadcastUploadDone({ userid, storeId, payload }) {
  const topic = `lnsms.store.${userid}.${storeId}.upload`;
  const evt = frame({
    topic,
    tag: 'EVT.upload.done',
    msg: payload || {},
  });
  broadcastFrame(evt, { userid, storeId, topic });
}

function emitChanged(req, entity, action, id, payload) {
  const { userid, storeId } = req.storeScope || {};
  if (!userid || !storeId) return;
  broadcastEvt({ userid, storeId, entity, action, id, payload });
}

module.exports = {
  attachWsGateway,
  broadcastEvt,
  broadcastUploadDone,
  broadcastFrame,
  emitChanged,
  getWsClients: () => clients,
};
