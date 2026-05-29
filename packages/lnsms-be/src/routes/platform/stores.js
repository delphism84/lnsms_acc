const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const Category = require('../../models/Category');
const Menu = require('../../models/Menu');
const Device = require('../../models/Device');

/** Platform: all stores */
router.get('/', async (req, res, next) => {
  try {
    const stores = await Store.find({}).sort({ agentId: 1, storeId: 1, agentid: 1, userid: 1, createdAt: -1 });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

/** Platform: stores by agent */
router.get('/by-agent/:agentId', async (req, res, next) => {
  try {
    const agentId = String(req.params.agentId || '').trim();
    const stores = await Store.find({ $or: [{ agentId }, { agentid: agentId }] }).sort({
      storeId: 1,
      userid: 1,
      createdAt: -1,
    });
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

/** Platform: create store */
router.post('/', async (req, res, next) => {
  try {
    const agentId = String(req.body.agentId || req.body.agentid || '').trim();
    const storeId = String(req.body.storeId || req.body.userid || '').trim();
    const { name } = req.body;
    if (!agentId || !storeId || !name) {
      return res.status(400).json({ error: 'Agent ID, Store ID, 이름은 필수입니다.' });
    }
    const existing = await Store.findOne({
      $or: [
        { agentId, storeId },
        { agentid: agentId, userid: storeId },
      ],
    });
    if (existing) {
      return res.status(400).json({ error: '이미 존재하는 Agent ID와 Store ID 조합입니다.' });
    }
    const store = new Store({
      ...req.body,
      agentId,
      storeId,
      agentid: agentId,
      userid: storeId,
    });
    await store.save();
    res.status(201).json(store);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 Agent ID와 Store ID 조합입니다.' });
    }
    next(err);
  }
});

/** Platform: get store by mongo id */
router.get('/:id', async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (err) {
    next(err);
  }
});

/** Platform: update store by mongo id */
router.put('/:id', async (req, res, next) => {
  try {
    const agentId = req.body.agentId || req.body.agentid;
    const storeId = req.body.storeId || req.body.userid;
    if (agentId && storeId) {
      const existing = await Store.findOne({
        $or: [
          { agentId, storeId },
          { agentid: agentId, userid: storeId },
        ],
        _id: { $ne: req.params.id },
      });
      if (existing) {
        return res.status(400).json({ error: '이미 존재하는 Agent ID와 Store ID 조합입니다.' });
      }
    }
    const store = await Store.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        ...(agentId ? { agentId: String(agentId).trim(), agentid: String(agentId).trim() } : {}),
        ...(storeId ? { storeId: String(storeId).trim(), userid: String(storeId).trim() } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(store);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: '이미 존재하는 Agent ID와 Store ID 조합입니다.' });
    }
    next(err);
  }
});

/** Platform: delete store by mongo id */
router.delete('/:id', async (req, res, next) => {
  try {
    const store = await Store.findById(req.params.id);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const storeRef = store._id;
    await Category.deleteMany({ storeId: storeRef });
    await Menu.deleteMany({ storeId: storeRef });
    await Device.deleteMany({
      $or: [{ storeRef }, { storeIdLegacy: storeRef }],
    });
    await Store.findByIdAndDelete(req.params.id);
    res.json({ message: 'Store and related data deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
