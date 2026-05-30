const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const { emitChanged } = require('../../ws/gateway');

router.get('/context', (req, res) => {
  const { userid, storeId, storeRef, store } = req.storeScope;
  const doc = store.toObject ? store.toObject() : store;
  res.json({
    userid,
    storeId,
    storeRef: String(storeRef),
    name: store.name,
    description: store.description,
    store: doc,
  });
});

router.put('/context', async (req, res, next) => {
  try {
    const { store, userid, storeId } = req.storeScope;
    const updated = await Store.findByIdAndUpdate(
      store._id,
      { ...req.body, userid, storeId },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Store not found' });
    emitChanged(req, 'context', 'update', String(store._id));
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
