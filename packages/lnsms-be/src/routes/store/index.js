const express = require('express');
const storeScope = require('../../middleware/storeScope');
const { requireHostOrPlatformAuth } = require('../../middleware/auth');
const contextRouter = require('./context');
const categoriesRouter = require('./categories');
const menusRouter = require('./menus');
const setsRouter = require('./setsScoped');
const eqidsRouter = require('./eqids');
const uploadRouter = require('../upload');

const router = express.Router({ mergeParams: true });

router.use(requireHostOrPlatformAuth);
router.use(storeScope);
router.use(contextRouter);
router.use('/categories', categoriesRouter);
router.use('/menus', menusRouter);
router.use('/sets', setsRouter);
router.use('/eqids', eqidsRouter);
router.use('/devices', eqidsRouter);
router.use('/upload', uploadRouter);

module.exports = router;
