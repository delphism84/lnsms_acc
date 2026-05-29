const express = require('express');
const storeScope = require('../../middleware/storeScope');
const contextRouter = require('./context');
const categoriesRouter = require('./categories');
const menusRouter = require('./menus');
const setsRouter = require('./setsScoped');
const eqidsRouter = require('./eqids');
const uploadRouter = require('../upload');
const didRouter = require('../did');

const router = express.Router({ mergeParams: true });

router.use(storeScope);
router.use(contextRouter);
router.use('/categories', categoriesRouter);
router.use('/menus', menusRouter);
router.use('/sets', setsRouter);
router.use('/eqids', eqidsRouter);
router.use('/upload', uploadRouter);
router.use('/did', didRouter);

module.exports = router;
