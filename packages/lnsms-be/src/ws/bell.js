const BellEvent = require('../models/BellEvent');
const Store = require('../models/Store');
const Device = require('../models/Device');
const { broadcastFrame } = require('./gateway');
const { frame } = require('./lunar');

const DEBOUNCE_MS = Number(process.env.BELL_DEBOUNCE_MS) || 5000;
const pendingResend = new Map();

function resendKey(userid, storeId, eventId) {
  return `${userid}:${storeId}:${eventId}`;
}

async function shouldAcceptIngest({ eventId, eqId }) {
  const existing = await BellEvent.findOne({ eventId, eqId });
  if (!existing) return { accept: true, reason: 'new' };

  const age = Date.now() - new Date(existing.receivedAt).getTime();
  if (age < DEBOUNCE_MS) {
    return { accept: false, reason: 'debounce', ageMs: age };
  }

  await BellEvent.deleteOne({ _id: existing._id });
  return { accept: true, reason: 'retry_after_debounce' };
}

async function recordIngest({ eventId, eqId, userid, storeId, payload }) {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await BellEvent.findOneAndUpdate(
    { eventId, eqId },
    { eventId, eqId, userid, storeId, payload, receivedAt: new Date(), expiresAt },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function listStoreEqIds(userid, storeId) {
  const store = await Store.findOne({ userid, storeId }).select('_id').lean();
  if (!store) return [];

  const storeRef = store._id;
  const devices = await Device.find({
    $or: [{ storeRef }, { storeIdLegacy: storeRef }, { storeId: storeRef }],
    enabled: { $ne: false },
  })
    .select('deviceId eqid')
    .lean();

  const ids = new Set();
  for (const d of devices) {
    const id = String(d.deviceId || d.eqid || '').trim();
    if (id) ids.add(id);
  }
  return [...ids];
}

function scheduleResend(userid, storeId, eventId, payload) {
  const k = resendKey(userid, storeId, eventId);
  if (pendingResend.has(k)) return;

  const timer = setTimeout(() => {
    void (async () => {
      pendingResend.delete(k);
      const eqIds = await listStoreEqIds(userid, storeId);
      const targets = eqIds.length ? eqIds : [payload?.eqId].filter(Boolean);

      for (const eqId of targets) {
        const evt = frame({
          topic: 'lnsms.bell',
          tag: 'EVT.resend',
          msg: { eventId, eqId, userid, storeId, ...(payload || {}) },
        });
        broadcastFrame(evt, { userid, storeId, topic: 'lnsms.bell' });
      }
    })().catch(() => {});
  }, DEBOUNCE_MS);

  pendingResend.set(k, timer);
}

async function ingestBell({ eventId, eqId, userid, storeId, payload }) {
  if (!eventId || !eqId || !userid || !storeId) {
    return { ok: false, error: 'eventId, eqId, userid, storeId required' };
  }

  const gate = await shouldAcceptIngest({ eventId, eqId });
  if (!gate.accept) {
    return { ok: true, accepted: false, debounced: true, reason: gate.reason, ageMs: gate.ageMs };
  }

  await recordIngest({ eventId, eqId, userid, storeId, payload });
  scheduleResend(userid, storeId, eventId, { ...payload, eqId });

  return { ok: true, accepted: true, eventId, eqId };
}

module.exports = { ingestBell, DEBOUNCE_MS, listStoreEqIds };
