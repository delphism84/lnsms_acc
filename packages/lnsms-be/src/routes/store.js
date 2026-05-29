const express = require('express');
const router = express.Router();
const SetConfig = require('../models/SetConfig');

// lnms(에이전트) 쪽 호환을 위한 최소 Store API
// - GET /api/store?userid=xxx  => [{ storeid, userid, setids }]
// - GET /api/store/:storeid    => { storeid, userid, setids }

router.get('/', async (req, res, next) => {
  try {
    const userid = String(req.query?.userid || '').trim();
    if (!userid) return res.status(400).json({ success: false, message: 'userid가 필요합니다.' });

    const sets = await SetConfig.find({ userid }).select('setid').lean();
    const setids = sets.map((x) => x.setid).filter(Boolean).sort();

    res.json([{ storeid: userid, userid, setids }]);
  } catch (e) {
    next(e);
  }
});

router.get('/:storeid', async (req, res, next) => {
  try {
    const storeid = String(req.params.storeid || '').trim();
    if (!storeid) return res.status(400).json({ success: false, message: 'storeid가 필요합니다.' });

    const userid = storeid;
    const sets = await SetConfig.find({ userid }).select('setid').lean();
    const setids = sets.map((x) => x.setid).filter(Boolean).sort();

    res.json({ storeid, userid, setids });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

