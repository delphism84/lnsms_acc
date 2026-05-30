const express = require('express');
const Store = require('../models/Store');
const { requireHostOrPlatformAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.put('/password', requireHostOrPlatformAuth, async (req, res, next) => {
  try {
    const userid = String(req.params.userid || '').trim();
    const storeId = String(req.params.storeId || '').trim();
    const password = req.body.password ?? req.body.userpw ?? req.body.pw;

    if (!password) {
      return res.status(400).json({ error: 'Validation Error', message: 'password는 필수입니다.' });
    }

    const store = await Store.findOne({ userid, storeId });
    if (!store) {
      return res.status(404).json({ error: 'Not Found', message: '매장을 찾을 수 없습니다.' });
    }

    store.userpw = password;
    await store.save();

    res.json({
      message: '비밀번호가 변경되었습니다.',
      userid: store.userid,
      storeId: store.storeId,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
