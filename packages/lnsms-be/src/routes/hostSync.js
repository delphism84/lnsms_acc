const express = require('express');
const Store = require('../models/Store');
const Category = require('../models/Category');
const Menu = require('../models/Menu');
const Device = require('../models/Device');
const SetConfig = require('../models/SetConfig');
const { requireHostOrPlatformAuth } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(requireHostOrPlatformAuth);

async function loadStore(userid, storeId) {
  return Store.findOne({ userid, storeId });
}

async function exportBundle(store) {
  const storeRef = store._id;
  const { userid, storeId } = store;
  const [categories, menus, devices, setConfigs] = await Promise.all([
    Category.find({ storeId: storeRef }).lean(),
    Menu.find({ storeId: storeRef }).lean(),
    Device.find({ $or: [{ storeRef }, { storeId: storeRef }, { storeIdLegacy: storeRef }] }).lean(),
    SetConfig.find({ userid, storeId }).lean(),
  ]);

  return {
    version: 2,
    userid,
    storeId,
    storeRef: String(storeRef),
    exportedAt: new Date().toISOString(),
    store: store.toObject(),
    collections: { categories, menus, devices, set_configs: setConfigs },
    files: [],
  };
}

router.post('/export', async (req, res, next) => {
  try {
    const userid = String(req.params.userid || '').trim();
    const storeId = String(req.params.storeId || '').trim();
    const store = await loadStore(userid, storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    res.json(await exportBundle(store));
  } catch (err) {
    next(err);
  }
});

router.post('/import', async (req, res, next) => {
  try {
    const userid = String(req.params.userid || '').trim();
    const storeId = String(req.params.storeId || '').trim();
    const bundle = req.body?.bundle;
    const mode = req.body?.mode === 'merge' ? 'merge' : 'replace';

    if (!bundle?.collections) {
      return res.status(400).json({ error: 'bundle.collections required' });
    }

    const store = await loadStore(userid, storeId);
    if (!store) return res.status(404).json({ error: 'Store not found' });
    const storeRef = store._id;

    const setConfigs = bundle.collections.set_configs || bundle.collections.setConfigs || [];

    if (mode === 'replace') {
      await Promise.all([
        Category.deleteMany({ storeId: storeRef }),
        Menu.deleteMany({ storeId: storeRef }),
        Device.deleteMany({ $or: [{ storeRef }, { storeId: storeRef }, { storeIdLegacy: storeRef }] }),
        SetConfig.deleteMany({ userid, storeId }),
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
    if (setConfigs.length) {
      await SetConfig.insertMany(
        setConfigs.map((cfg) => {
          const doc = { ...cfg, userid, storeId };
          delete doc._id;
          return doc;
        })
      );
    }

    res.json({ success: true, mode, userid, storeId, storeRef: String(storeRef) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
