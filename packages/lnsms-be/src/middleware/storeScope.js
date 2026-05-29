const Store = require('../models/Store');

async function storeScope(req, res, next) {
  try {
    const agentId = String(req.params.agentId || '').trim();
    const storeId = String(req.params.storeId || '').trim();
    if (!agentId || !storeId) {
      return res.status(400).json({ error: 'agentId and storeId are required' });
    }

    const store = await Store.findOne({
      $or: [
        { agentId, storeId },
        { agentid: agentId, userid: storeId },
      ],
    });

    if (!store) {
      return res.status(404).json({ error: 'Store not found for this agent/store scope' });
    }

    req.storeScope = {
      agentId: store.agentId || store.agentid,
      storeId: store.storeId || store.userid,
      storeRef: store._id,
      store,
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = storeScope;
