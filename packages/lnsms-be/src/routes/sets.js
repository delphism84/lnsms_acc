const express = require('express');
const router = express.Router();
const SetConfig = require('../models/SetConfig');

function pickUserId(req) {
  const q = (req.query?.userid ?? req.query?.userId ?? '').toString().trim();
  const b = (req.body?.userid ?? req.body?.userId ?? '').toString().trim();
  return q || b;
}

// 세트 목록 조회: GET /api/sets?userid=xxx
router.get('/', async (req, res, next) => {
  try {
    const userid = pickUserId(req);
    if (!userid) return res.status(400).json({ success: false, message: 'userid가 필요합니다.' });

    const list = await SetConfig.find({ userid })
      .select('setid userid updatedAt')
      .sort({ updatedAt: -1, setid: 1 })
      .lean();

    // 기존 클라이언트 호환: 배열 또는 {sets:[]} 둘 다 가능하니 여기선 배열로
    res.json(
      list.map((x) => ({
        setid: x.setid,
        userid: x.userid,
        updatedAt: x.updatedAt,
      }))
    );
  } catch (e) {
    next(e);
  }
});

// 세트 생성: POST /api/sets { setid, userid }
router.post('/', async (req, res, next) => {
  try {
    const setid = (req.body?.setid ?? '').toString().trim();
    const userid = pickUserId(req);
    if (!setid || !userid) return res.status(400).json({ success: false, message: 'setid, userid가 필요합니다.' });

    const created = await SetConfig.create({
      setid,
      userid,
      phrases: [],
      serial: { ports: [] },
    });

    res.status(201).json({ success: true, setid: created.setid, userid: created.userid });
  } catch (e) {
    // duplicate
    if (e && e.code === 11000) return res.status(409).json({ success: false, message: '이미 존재하는 setid 입니다.' });
    next(e);
  }
});

// 세트 설정 조회: GET /api/sets/:setid/config?userid=xxx
router.get('/:setid/config', async (req, res, next) => {
  try {
    const setid = (req.params.setid ?? '').toString().trim();
    const userid = pickUserId(req);
    if (!setid || !userid) return res.status(400).json({ success: false, message: 'setid, userid가 필요합니다.' });

    const doc = await SetConfig.findOne({ setid, userid }).lean();
    if (!doc) return res.status(404).json({ success: false, message: '세트를 찾을 수 없습니다.' });

    res.json({
      setid: doc.setid,
      phrases: Array.isArray(doc.phrases) ? doc.phrases : [],
      serial: doc.serial ?? { ports: [] },
    });
  } catch (e) {
    next(e);
  }
});

// 세트 설정 저장: PUT /api/sets/:setid { phrases, serial, userid? }
router.put('/:setid', async (req, res, next) => {
  try {
    const setid = (req.params.setid ?? '').toString().trim();
    const userid = pickUserId(req);
    if (!setid || !userid) return res.status(400).json({ success: false, message: 'setid, userid가 필요합니다.' });

    const phrases = Array.isArray(req.body?.phrases) ? req.body.phrases : [];
    const serial = req.body?.serial ?? { ports: [] };

    const doc = await SetConfig.findOneAndUpdate(
      { setid, userid },
      { $set: { phrases, serial } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({ success: true, setid: doc.setid, userid: doc.userid, updatedAt: doc.updatedAt });
  } catch (e) {
    next(e);
  }
});

// 세트 삭제: DELETE /api/sets/:setid?userid=xxx
router.delete('/:setid', async (req, res, next) => {
  try {
    const setid = (req.params.setid ?? '').toString().trim();
    const userid = pickUserId(req);
    if (!setid || !userid) return res.status(400).json({ success: false, message: 'setid, userid가 필요합니다.' });

    await SetConfig.deleteOne({ setid, userid });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

