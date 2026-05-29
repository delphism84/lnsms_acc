const express = require('express');
const agentsRouter = require('../agents');
const platformStoresRouter = require('./stores');
const syncRouter = require('./sync');

const router = express.Router();

router.use('/agents', agentsRouter);
router.use('/stores', platformStoresRouter);
router.use('/sync', syncRouter);

module.exports = router;
