const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const Category = require('../../models/Category');
const Menu = require('../../models/Menu');
const Device = require('../../models/Device');
const { requirePlatformAuth } = require('../../middleware/auth');

router.use(requirePlatformAuth);

router.get('/', async (req, res, next) => {
  try {
    const stores = await Store.find({}).sort({ userid: 1, storeId: 1, createdAt: -1 });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

router.get('/by-user/:userid', async (req, res, next) => {
  try {
    const userid = String(req.params.userid || '').trim();
    const stores = await Store.find({ userid }).sort({ storeId: 1, createdAt: -1 });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const userid = String(req.body.userid || '').trim();
    const storeId = String(req.body.storeId || '').trim();
    const { name, password } = req.body;
    if (!userid || !storeId || !name) {
      return res.status(400).json({ error: 'userid, storeId, name은 필수입니다.' });
    }

    const existing = await Store.findOne({ userid, storeId });
    if (existing) {
      return res.status(400).json({ error: '이미 존재하는 StoreKey입니다.' });
    }

    const store = new Store({
      ...req.body,
      userid,
      storeId,
      name,
      ...(password ? { userpw: password } : {}),
    });
    await store.save();
    res.status(201).json(store);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 StoreKey입니다.' });
    }
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const userid = req.body.userid ? String(req.body.userid).trim() : undefined;
    const storeId = req.body.storeId ? String(req.body.storeId).trim() : undefined;
    if (userid && storeId) {
      const existing = await Store.findOne({ userid, storeId, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ error: '이미 존재하는 StoreKey입니다.' });
      }
    }

    const update = { ...req.body };
    if (update.password) {
      update.userpw = update.password;
      delete update.password;
    }

    const store = await Store.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 StoreKey입니다.' });
    }
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const storeRef = store._id;
    await Category.deleteMany({ storeId: storeRef });
    await Menu.deleteMany({ storeId: storeRef });
    await Device.deleteMany({ $or: [{ storeRef }, { storeId: storeRef }] });
    await Store.findByIdAndDelete(req.params.id);
    res.json({ message: 'Store and related data deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
