const express = require('express');
const router = express.Router();
const AdminUser = require('../models/AdminUser');
const { verifyToken, signPlatformTokens, authResponse } = require('../lib/jwt');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: '사용자명과 비밀번호는 필수입니다.',
      });
    }

    const user = await AdminUser.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        error: 'Authentication Error',
        message: '사용자명 또는 비밀번호가 잘못되었습니다.',
      });
    }

    const tokens = signPlatformTokens(user);
    res.json(
      authResponse(tokens, {
        message: '로그인 성공',
        user: { _id: user._id, username: user.username, role: user.role },
      })
    );
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const refreshToken = req.body.refreshToken || req.body.refresh;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Validation Error', message: 'refreshToken이 필요합니다.' });
    }

    const decoded = verifyToken(refreshToken);
    if (decoded.typ !== 'refresh' || decoded.aud !== 'platform') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 refresh 토큰입니다.' });
    }

    const user = await AdminUser.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'Authentication Error', message: '사용자를 찾을 수 없습니다.' });
    }

    const tokens = signPlatformTokens(user);
    res.json(
      authResponse(tokens, {
        user: { _id: user._id, username: user.username, role: user.role },
      })
    );
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 refresh 토큰입니다.' });
    }
    next(error);
  }
});

router.get('/verify', async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication Error', message: '토큰이 제공되지 않았습니다.' });
    }

    const decoded = verifyToken(token);
    if (decoded.typ === 'refresh' || decoded.aud !== 'platform') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
    }

    const user = await AdminUser.findById(decoded.sub);
    if (!user) {
      return res.status(401).json({ error: 'Authentication Error', message: '사용자를 찾을 수 없습니다.' });
    }

    res.json({
      valid: true,
      user: { _id: user._id, username: user.username, role: user.role },
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
    }
    next(error);
  }
});

module.exports = router;
