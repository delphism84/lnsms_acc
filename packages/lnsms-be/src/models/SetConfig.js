const mongoose = require('mongoose');

const setConfigSchema = new mongoose.Schema(
  {
    setid: { type: String, required: true, index: true },
    userid: { type: String, required: true, index: true },
    phrases: { type: [mongoose.Schema.Types.Mixed], default: [] },
    serial: {
      type: mongoose.Schema.Types.Mixed,
      default: { ports: [] },
    },
  },
  { timestamps: true }
);

// userid + setid 조합은 유일
setConfigSchema.index({ userid: 1, setid: 1 }, { unique: true });

module.exports = mongoose.model('SetConfig', setConfigSchema, 'set_configs');

