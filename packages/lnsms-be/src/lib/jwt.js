const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lnsms-dev-secret-change-me';
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '7d';

function signAccess(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign({ ...payload, typ: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function signPlatformTokens(user) {
  const base = {
    aud: 'platform',
    sub: String(user._id),
    username: user.username,
    role: user.role,
  };
  return {
    accessToken: signAccess(base),
    refreshToken: signRefresh(base),
  };
}

function signHostTokens(store) {
  const userid = store.userid;
  const storeId = store.storeId;
  const base = {
    aud: 'host',
    sub: `${userid}.${storeId}`,
    userid,
    storeId,
  };
  return {
    accessToken: signAccess(base),
    refreshToken: signRefresh(base),
  };
}

function authResponse(tokens, extra = {}) {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    token: tokens.accessToken,
    ...extra,
  };
}

module.exports = {
  JWT_SECRET,
  signAccess,
  signRefresh,
  verifyToken,
  signPlatformTokens,
  signHostTokens,
  authResponse,
};
