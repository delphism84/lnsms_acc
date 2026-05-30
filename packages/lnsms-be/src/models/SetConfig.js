const mongoose = require('mongoose');

const setConfigSchema = new mongoose.Schema(
  {
    userid: { type: String, required: true, index: true },
    storeId: { type: String, required: true, index: true },
    setid: { type: String, required: true, index: true },
    phrases: { type: mongoose.Schema.Types.Mixed, default: {} },
    serial: { type: mongoose.Schema.Types.Mixed, default: { ports: [] } },
  },
  { timestamps: true }
);

setConfigSchema.index({ userid: 1, storeId: 1, setid: 1 }, { unique: true });

module.exports = mongoose.model('SetConfig', setConfigSchema, 'set_configs');
