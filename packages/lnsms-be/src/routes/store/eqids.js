const express = require('express');
const router = express.Router();
const Eqid = require('../../models/Eqid');
const Store = require('../../models/Store');
const { emitChanged } = require('../../ws/gateway');

function storeRefId(req) {
  return req.storeScope.storeRef;
}

function storeQuery(req) {
  const storeRef = storeRefId(req);
  return { $or: [{ storeRef }, { storeIdLegacy: storeRef }, { storeId: storeRef }] };
}

async function findOwnedEqid(req, id) {
  const eqid = await Eqid.findById(id);
  if (!eqid) return null;
  const storeRef = String(storeRefId(req));
  const refs = [eqid.storeRef, eqid.storeIdLegacy, eqid.storeId].filter(Boolean).map(String);
  if (!refs.includes(storeRef)) return null;
  return eqid;
}

router.get('/', async (req, res, next) => {
  try {
    const eqids = await Eqid.find(storeQuery(req)).sort({ createdAt: -1 });
    res.json(eqids);
  } catch (err) {
    next(err);
  }
});

router.delete('/category/:category', async (req, res, next) => {
  try {
    const storeRef = storeRefId(req);
    const category = String(req.params.category || '').trim();
    const allowed = new Set(['localserver', 'did', 'kds', 'callbell', 'etc']);
    if (!allowed.has(category)) {
      return res.status(400).json({ error: 'Validation Error', message: 'invalid category' });
    }
    const store = await Store.findById(storeRef).select('storeId userid').lean();
    const storeIdStr = String(store?.storeId || store?.userid || '').trim();
    const result = await Eqid.deleteMany({
      $or: [
        { storeRef },
        { storeIdLegacy: storeRef },
        ...(storeIdStr ? [{ storeId: storeIdStr }] : []),
      ],
      category,
    });
    res.json({ deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/resources', async (req, res, next) => {
  try {
    const eqid = await findOwnedEqid(req, req.params.id);
    if (!eqid) return res.status(404).json({ error: 'EQID not found' });
    const resourceData = {
      ...req.body,
      enabled: req.body.enabled !== undefined ? req.body.enabled : true,
      displayTime: req.body.displayTime || eqid.displayTime || 5000,
      fadeInOut: req.body.fadeInOut || false,
    };
    eqid.resources.push(resourceData);
    await eqid.save();
    emitChanged(req, 'devices', 'update', String(eqid._id));
    res.json(eqid);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/resources/:resourceIndex', async (req, res, next) => {
  try {
    const eqid = await findOwnedEqid(req, req.params.id);
    if (!eqid) return res.status(404).json({ error: 'EQID not found' });
    const resourceIndex = parseInt(req.params.resourceIndex, 10);
    if (resourceIndex < 0 || resourceIndex >= eqid.resources.length) {
      return res.status(400).json({ error: 'Invalid resource index' });
    }
    const { enabled, displayTime, fadeInOut } = req.body;
    if (enabled !== undefined) eqid.resources[resourceIndex].enabled = enabled;
    if (displayTime !== undefined) eqid.resources[resourceIndex].displayTime = displayTime;
    if (fadeInOut !== undefined) eqid.resources[resourceIndex].fadeInOut = fadeInOut;
    await eqid.save();
    emitChanged(req, 'devices', 'update', String(eqid._id));
    res.json(eqid);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id/resources/:resourceIndex', async (req, res, next) => {
  try {
    const eqid = await findOwnedEqid(req, req.params.id);
    if (!eqid) return res.status(404).json({ error: 'EQID not found' });
    const resourceIndex = parseInt(req.params.resourceIndex, 10);
    if (resourceIndex >= 0 && resourceIndex < eqid.resources.length) {
      eqid.resources.splice(resourceIndex, 1);
      await eqid.save();
    }
    emitChanged(req, 'devices', 'update', String(eqid._id));
    res.json(eqid);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { eqid, deviceId, displayTime, enabled } = req.body;
    const idToUse = deviceId || eqid;
    if (!idToUse) return res.status(400).json({ error: 'EQID와 Store ID는 필수입니다.' });

    const { store, agentId, storeId, storeRef } = req.storeScope;
    const agentKey = store.agentId || store.agentid || agentId;
    const existingEqid = await Eqid.findOne({ agentId: agentKey, deviceId: idToUse }).select('_id').lean();
    if (existingEqid) return res.status(400).json({ error: '이미 존재하는 EQID입니다.' });

    const newEqid = new Eqid({
      deviceId: idToUse,
      eqid: idToUse,
      agentId: agentKey,
      storeId: store.storeId || store.userid || storeId,
      storeRef,
      storeIdLegacy: storeRef,
      displayTime: displayTime || 5000,
      enabled: enabled !== undefined ? enabled : true,
      resources: [],
    });
    await newEqid.save();
    emitChanged(req, 'devices', 'create', String(newEqid._id));
    res.status(201).json(newEqid);
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: '이미 존재하는 EQID입니다.' });
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedEqid(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'EQID not found' });

    const { displayTime, enabled, useResourceFadeInOut, didOptions, category } = req.body;
    const updateData = {};
    if (displayTime !== undefined) updateData.displayTime = displayTime;
    if (enabled !== undefined) updateData.enabled = enabled;
    if (useResourceFadeInOut !== undefined) updateData.useResourceFadeInOut = useResourceFadeInOut;
    if (didOptions !== undefined) updateData.didOptions = didOptions;
    if (category !== undefined) updateData.category = category;

    const eqid = await Eqid.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    emitChanged(req, 'devices', 'update', String(eqid._id));
    res.json(eqid);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await findOwnedEqid(req, req.params.id);
    if (!existing) return res.status(404).json({ error: 'EQID not found' });
    await Eqid.findByIdAndDelete(req.params.id);
    emitChanged(req, 'devices', 'delete', String(req.params.id));
    res.json({ message: 'EQID deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
