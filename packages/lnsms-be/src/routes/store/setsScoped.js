const express = require('express');
const SetConfig = require('../../models/SetConfig');
const { emitChanged } = require('../../ws/gateway');

const router = express.Router({ mergeParams: true });

function scope(req) {
  return { userid: req.storeScope.userid, storeId: req.storeScope.storeId };
}

router.get('/', async (req, res, next) => {
  try {
    const { userid, storeId } = scope(req);
    const items = await SetConfig.find({ userid, storeId }).sort({ setid: 1 });
    res.json(items);
  } catch (err) {
    next(err);
  }
});

router.get('/:setid', async (req, res, next) => {
  try {
    const { userid, storeId } = scope(req);
    const setid = String(req.params.setid || '').trim();
    const item = await SetConfig.findOne({ userid, storeId, setid });
    if (!item) return res.status(404).json({ error: 'SetConfig not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { userid, storeId } = scope(req);
    const setid = String(req.body?.setid || '').trim();
    if (!setid) return res.status(400).json({ error: 'setid is required' });

    const existing = await SetConfig.findOne({ userid, storeId, setid }).select('_id').lean();
    if (existing) return res.status(400).json({ error: 'setid already exists' });

    const item = new SetConfig({
      userid,
      storeId,
      setid,
      phrases: req.body?.phrases || {},
      serial: req.body?.serial || { ports: [] },
    });
    await item.save();
    emitChanged(req, 'sets', 'create', setid);
    res.status(201).json(item);
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: 'setid already exists' });
    next(err);
  }
});

router.put('/:setid', async (req, res, next) => {
  try {
    const { userid, storeId } = scope(req);
    const setid = String(req.params.setid || '').trim();
    const item = await SetConfig.findOneAndUpdate(
      { userid, storeId, setid },
      {
        ...(req.body?.phrases !== undefined ? { phrases: req.body.phrases } : {}),
        ...(req.body?.serial !== undefined ? { serial: req.body.serial } : {}),
      },
      { new: true, runValidators: true }
    );
    if (!item) return res.status(404).json({ error: 'SetConfig not found' });
    emitChanged(req, 'sets', 'update', setid);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

router.delete('/:setid', async (req, res, next) => {
  try {
    const { userid, storeId } = scope(req);
    const setid = String(req.params.setid || '').trim();
    const item = await SetConfig.findOneAndDelete({ userid, storeId, setid });
    if (!item) return res.status(404).json({ error: 'SetConfig not found' });
    emitChanged(req, 'sets', 'delete', setid);
    res.json({ message: 'SetConfig deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
