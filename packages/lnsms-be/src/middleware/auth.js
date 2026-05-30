const { verifyToken } = require('../lib/jwt');

function extractBearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return null;
}

function requirePlatformAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication Error', message: '토큰이 필요합니다.' });
    }
    const decoded = verifyToken(token);
    if (decoded.typ === 'refresh' || decoded.aud !== 'platform') {
      return res.status(401).json({ error: 'Authentication Error', message: 'Platform 토큰이 아닙니다.' });
    }
    req.auth = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
  }
}

function requireHostOrPlatformAuth(req, res, next) {
  try {
    const token = extractBearer(req);
    if (!token) {
      return res.status(401).json({ error: 'Authentication Error', message: '토큰이 필요합니다.' });
    }
    const decoded = verifyToken(token);
    if (decoded.typ === 'refresh') {
      return res.status(401).json({ error: 'Authentication Error', message: 'Access 토큰이 필요합니다.' });
    }

    if (decoded.aud === 'platform') {
      req.auth = decoded;
      return next();
    }

    if (decoded.aud === 'host') {
      const pathUserid = String(req.params.userid || '').trim();
      const pathStoreId = String(req.params.storeId || '').trim();
      if (pathUserid && pathStoreId) {
        if (decoded.userid !== pathUserid || decoded.storeId !== pathStoreId) {
          return res.status(403).json({ error: 'Forbidden', message: 'StoreKey가 일치하지 않습니다.' });
        }
      }
      req.auth = decoded;
      return next();
    }

    return res.status(401).json({ error: 'Authentication Error', message: '지원하지 않는 토큰입니다.' });
  } catch (err) {
    return res.status(401).json({ error: 'Authentication Error', message: '유효하지 않은 토큰입니다.' });
  }
}

module.exports = { extractBearer, requirePlatformAuth, requireHostOrPlatformAuth };
