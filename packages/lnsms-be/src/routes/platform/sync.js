const express = require('express');
const router = express.Router();
const Store = require('../../models/Store');
const Category = require('../../models/Category');
const Menu = require('../../models/Menu');
const Device = require('../../models/Device');
const SetConfig = require('../../models/SetConfig');

async function resolveStore(agentId, storeId) {
  return Store.findOne({
    $or: [
      { agentId, storeId },
      { agentid: agentId, userid: storeId },
    ],
  });
}

/** POST /api/platform/sync/export { agentId, storeId } */
router.post('/export', async (req, res, next) => {
  try {
    const agentId = String(req.body?.agentId || '').trim();
    const storeId = String(req.body?.storeId || '').trim();
    if (!agentId || !storeId) {
      return res.status(400).json({ error: 'agentId and storeId required' });
    }
    const store = await resolveStore(agentId, storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });

    const storeRef = store._id;
    const [categories, menus, devices, setConfigs] = await Promise.all([
      Category.find({ storeId: storeRef }).lean(),
      Menu.find({ storeId: storeRef }).lean(),
      Device.find({ $or: [{ storeRef }, { storeIdLegacy: storeRef }] }).lean(),
      SetConfig.find({ userid: store.storeId || store.userid }).lean(),
    ]);

    res.json({
      version: 1,
      agentId: store.agentId || store.agentid,
      storeId: store.storeId || store.userid,
      storeRef: String(storeRef),
      exportedAt: new Date().toISOString(),
      store: store.toObject(),
      collections: { categories, menus, devices, set_configs: setConfigs },
      files: [],
    });
  } catch (err) {
    next(err);
  }
});

/** POST /api/platform/sync/import { agentId, storeId, bundle, mode } */
router.post('/import', async (req, res, next) => {
  try {
    const agentId = String(req.body?.agentId || '').trim();
    const storeId = String(req.body?.storeId || '').trim();
    const bundle = req.body?.bundle;
    const mode = req.body?.mode === 'merge' ? 'merge' : 'replace';
    if (!agentId || !storeId || !bundle?.collections) {
      return res.status(400).json({ error: 'agentId, storeId, bundle.collections required' });
    }

    const store = await resolveStore(agentId, storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const storeRef = store._id;

    const userid = String(store.storeId || store.userid || '').trim();
    const setConfigs = bundle.collections.set_configs || bundle.collections.setConfigs || [];

    if (mode === 'replace') {
      await Promise.all([
        Category.deleteMany({ storeId: storeRef }),
        Menu.deleteMany({ storeId: storeRef }),
        Device.deleteMany({ $or: [{ storeRef }, { storeIdLegacy: storeRef }] }),
        ...(userid ? [SetConfig.deleteMany({ userid })] : []),
      ]);
    }

    const { categories = [], menus = [], devices = [] } = bundle.collections;
    if (categories.length) {
      await Category.insertMany(
        categories.map((c) => {
          const doc = { ...c, storeId: storeRef };
          delete doc._id;
          return doc;
        })
      );
    }
    if (menus.length) {
      await Menu.insertMany(
        menus.map((m) => {
          const doc = { ...m, storeId: storeRef };
          delete doc._id;
          return doc;
        })
      );
    }
    if (devices.length) {
      await Device.insertMany(
        devices.map((d) => {
          const doc = { ...d, storeRef, storeIdLegacy: storeRef };
          delete doc._id;
          return doc;
        })
      );
    }
    if (setConfigs.length && userid) {
      await SetConfig.insertMany(
        setConfigs.map((cfg) => {
          const doc = { ...cfg, userid };
          delete doc._id;
          return doc;
        })
      );
    }

    res.json({ success: true, mode, storeRef: String(storeRef) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
