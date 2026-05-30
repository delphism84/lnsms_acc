const express = require('express');
const platformStoresRouter = require('./stores');

const router = express.Router();

router.use('/stores', platformStoresRouter);

module.exports = router;
