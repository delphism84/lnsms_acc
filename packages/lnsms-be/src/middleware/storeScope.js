const Store = require('../models/Store');

async function storeScope(req, res, next) {
  try {
    const userid = String(req.params.userid || '').trim();
    const storeId = String(req.params.storeId || '').trim();
    if (!userid || !storeId) {
      return res.status(400).json({ error: 'userid and storeId are required' });
    }

    const store = await Store.findOne({ userid, storeId });
    if (!store) {
      return res.status(404).json({ error: 'Store not found for this userid/storeId scope' });
    }

    req.storeScope = {
      userid,
      storeId,
      storeRef: store._id,
      store,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = storeScope;
