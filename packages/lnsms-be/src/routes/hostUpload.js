const express = require('express');
const uploadRouter = require('./upload');
const { requireHostOrPlatformAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(requireHostOrPlatformAuth);
router.use('/', uploadRouter);

module.exports = router;
