const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');

/** GET /api/s/:agentId/:storeId/context */
router.get('/context', (req, res) => {
  const { agentId, storeId, storeRef, store } = req.storeScope;
  const doc = store.toObject ? store.toObject() : store;
  res.json({
    agentId,
    storeId,
    storeRef: String(storeRef),
    name: store.name,
    description: store.description,
    store: doc,
  });
});

/** PUT /api/s/:agentId/:storeId/context — 매장 프로필 수정 */
router.put('/context', async (req, res, next) => {
  try {
    const { store } = req.storeScope;
    const agentId = store.agentId || store.agentid;
    const storeId = store.storeId || store.userid;

    const updated = await Store.findByIdAndUpdate(
      store._id,
      {
        ...req.body,
        agentId,
        storeId,
        agentid: agentId,
        userid: storeId,
      },
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Store not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

/** PUT /api/s/:agentId/:storeId/context/password */
router.put('/context/password', async (req, res, next) => {
  try {
    const { store } = req.storeScope;
    const password = req.body.userpw ?? req.body.pw;
    if (!password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'pw(userpw)는 필수입니다.',
      });
    }
    store.userpw = password;
    store.pw = password;
    await store.save();
    res.json({
      message: '비밀번호가 변경되었습니다.',
      store: {
        _id: store._id,
        agentId: store.agentId || store.agentid,
        storeId: store.storeId || store.userid,
        updatedAt: store.updatedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
