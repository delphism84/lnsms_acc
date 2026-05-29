const express = require('express');
const setsRouter = require('../sets');

const router = express.Router({ mergeParams: true });

/** Inject store scope userid into sets API (set_configs keyed by storeId) */
router.use((req, res, next) => {
  const userid = String(req.storeScope?.storeId || req.storeScope?.store?.storeId || req.storeScope?.store?.userid || '').trim();
  if (!userid) return res.status(400).json({ success: false, message: 'store scope userid missing' });
  req.query = { ...req.query, userid };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.body = { ...(req.body && typeof req.body === 'object' ? req.body : {}), userid };
  }
  next();
});

router.use('/', setsRouter);

module.exports = router;
