const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const storeSchema = new mongoose.Schema({
  userid: { type: String, required: true, trim: true, index: true },
  storeId: { type: String, required: true, trim: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  manager: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
  },
  contact: {
    phoneMain: { type: String, default: '' },
    emailMain: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  location: {
    address1: { type: String, default: '' },
    address2: { type: String, default: '' },
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: 'KR' },
  },
  branding: {
    logoUrl: { type: String, default: '' },
    notice: { type: String, default: '' },
  },
  status: {
    active: { type: Boolean, default: true },
    suspended: { type: Boolean, default: false },
  },
  userpw: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

storeSchema.index({ userid: 1, storeId: 1 }, { unique: true });

storeSchema.pre('save', function preSave(next) {
  this.updatedAt = Date.now();
  next();
});

storeSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('userpw') || !this.userpw) return next();
  try {
    const looksHashed = /^\$2[aby]\$\d{2}\$/.test(this.userpw);
    if (!looksHashed) {
      const salt = await bcrypt.genSalt(10);
      this.userpw = await bcrypt.hash(this.userpw, salt);
    }
    next();
  } catch (err) {
    next(err);
  }
});

storeSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.userpw) return false;
  return bcrypt.compare(candidate, this.userpw);
};

module.exports = mongoose.model('Store', storeSchema);
