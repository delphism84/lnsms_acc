import { Router } from 'express';
import { getStoreCollection } from '../db.js';

const router = Router();

/** GET /api/store - 목록. query: userid (optional, filter by parent). 각 항목에 setids 포함 */
router.get('/', async (req, res) => {
  try {
    const { userid } = req.query;
    const coll = getStoreCollection();
    const filter = userid ? { userid: String(userid) } : {};
    const list = await coll.find(filter).sort({ storeid: 1 }).toArray();
    return res.json(list.map(({ storeid, userid: uid, setids, createdAt }) => ({
      storeid,
      userid: uid,
      setids: Array.isArray(setids) ? setids : [],
      createdAt,
    })));
  } catch (err) {
    console.error('GET /api/store', err);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/store/:storeid - 단일 매장 (세트ID 내려받기용). setids 포함 */
router.get('/:storeid', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const coll = getStoreCollection();
    const doc = await coll.findOne({ storeid });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    return res.json({
      storeid: doc.storeid,
      userid: doc.userid,
      setids: Array.isArray(doc.setids) ? doc.setids : [],
      createdAt: doc.createdAt,
    });
  } catch (err) {
    console.error('GET /api/store/:storeid', err);
    return res.status(500).json({ error: err.message });
  }
});

/** PUT /api/store/:storeid/setids - 매장에 연결된 세트ID 목록 갱신. body: { setids: string[] } */
router.put('/:storeid/setids', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const { setids } = req.body || {};
    const coll = getStoreCollection();
    const arr = Array.isArray(setids) ? setids.map((s) => String(s).trim()).filter(Boolean) : [];
    const r = await coll.updateOne(
      { storeid },
      { $set: { setids: arr } },
      { upsert: false }
    );
    if (r.matchedCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ storeid, setids: arr, success: true });
  } catch (err) {
    console.error('PUT /api/store/:storeid/setids', err);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/store - 생성. body: { storeid, userid } */
router.post('/', async (req, res) => {
  try {
    const { storeid, userid } = req.body || {};
    if (!storeid) {
      return res.status(400).json({ success: false, message: 'storeid 필요' });
    }
    if (!userid || !String(userid).trim()) {
      return res.status(400).json({ success: false, message: 'userid 필요' });
    }
    const id = String(storeid).trim();
    const uid = String(userid).trim();
    const coll = getStoreCollection();
    const existing = await coll.findOne({ storeid: id });
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 존재하는 storeid' });
    }
    await coll.insertOne({
      storeid: id,
      userid: uid,
      setids: [],
      createdAt: new Date(),
    });
    return res.status(201).json({ storeid: id, userid: uid, setids: [] });
  } catch (err) {
    console.error('POST /api/store', err);
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/store/:storeid */
router.delete('/:storeid', async (req, res) => {
  try {
    const storeid = req.params.storeid;
    const coll = getStoreCollection();
    const r = await coll.deleteOne({ storeid });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/store/:storeid', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
