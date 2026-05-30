const express = require('express');
const Store = require('../models/Store');
const { verifyToken, signHostTokens, authResponse } = require('../lib/jwt');

const router = express.Router();

router.post('/login', async (req, res, next) => {
  try {
    const userid = String(req.body.userid || '').trim();
    const storeId = String(req.body.storeId || '').trim();
    const password = req.body.password ?? req.body.userpw ?? req.body.pw;

    if (!userid || !storeId || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'userid, storeId, password는 필수입니다.',
      });
    }

    const store = await Store.findOne({ userid, storeId });
    if (!store) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: '매장 정보 또는 비밀번호가 잘못되었습니다.',
      });
    }

    const ok = await store.comparePassword(password);
    if (!ok) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: '매장 정보 또는 비밀번호가 잘못되었습니다.',
      });
    }

    const tokens = signHostTokens(store);
    res.json(
      authResponse(tokens, {
        message: '로그인 성공',
        userid,
        storeId,
        store: { _id: store._id, userid, storeId, name: store.name },
      })
    );
  } catch (err) {
    next(err);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.body.refresh;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Validation Error', message: 'refreshToken이 필요합니다.' });
    }

    const decoded = verifyToken(refreshToken);
    if (decoded.typ !== 'refresh' || decoded.aud !== 'host') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 refresh 토큰입니다.' });
    }

    const store = await Store.findOne({ userid: decoded.userid, storeId: decoded.storeId });
    if (!store) {
      return res.status(401).json({ error: 'Authentication Error', message: '매장을 찾을 수 없습니다.' });
    }

    const tokens = signHostTokens(store);
    res.json(authResponse(tokens, { userid: store.userid, storeId: store.storeId }));
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 refresh 토큰입니다.' });
    }
    next(err);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication Error', message: '토큰이 필요합니다.' });
    }

    const decoded = verifyToken(token);
    if (decoded.typ === 'refresh' || decoded.aud !== 'host') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
    }

    const store = await Store.findOne({ userid: decoded.userid, storeId: decoded.storeId });
    if (!store) {
      return res.status(401).json({ error: 'Authentication Error', message: '매장을 찾을 수 없습니다.' });
    }

    res.json({
      valid: true,
      userid: store.userid,
      storeId: store.storeId,
      store: { _id: store._id, userid: store.userid, storeId: store.storeId, name: store.name },
    });
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
    }
    next(err);
  }
});

module.exports = router;
