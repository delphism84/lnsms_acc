const mongoose = require('mongoose');

const bellEventSchema = new mongoose.Schema({
  eventId: { type: String, required: true, index: true },
  userid: { type: String, required: true, index: true },
  storeId: { type: String, required: true, index: true },
  eqId: { type: String, required: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  receivedAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

bellEventSchema.index({ eventId: 1, eqId: 1 }, { unique: true });
bellEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('BellEvent', bellEventSchema, 'bell_events');
