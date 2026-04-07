import { Router } from 'express';
import { getAgentSetsCollection } from '../db.js';

const router = Router();

/** GET /api/sets - 목록. query: userid (필수, 세트는 userid에 종속) */
router.get('/', async (req, res) => {
  try {
    const { userid } = req.query;
    const coll = getAgentSetsCollection();
    const filter = userid ? { userid: String(userid) } : {};
    const list = await coll.find(filter).sort({ setid: 1 }).toArray();
    return res.json(list.map(({ setid, userid: uid, updatedAt }) => ({ setid, userid: uid, updatedAt })));
  } catch (err) {
    console.error('GET /api/sets', err);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/sets/:setid/config - 세트 설정 (DB·로컬 1:1). setid, phrases, serial, remoteControl 반환. */
router.get('/:setid/config', async (req, res) => {
  try {
    const setid = req.params.setid;
    const coll = getAgentSetsCollection();
    const doc = await coll.findOne({ setid });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    const rawPhrases = doc.phrases || [];
    const phrases = rawPhrases.map((p) => {
      const img = p?.image ?? (p?.imageUrl && typeof p.imageUrl === 'string' ? p.imageUrl.replace(/^.*[/\\]/, '') : null);
      const out = { ...p };
      out.image = img || null;
      return out;
    });
    return res.json({
      setid: doc.setid,
      phrases,
      serial: doc.serial || { ports: [] },
      remoteControl: doc.remoteControl || { remotes: [] },
    });
  } catch (err) {
    console.error('GET /api/sets/:setid/config', err);
    return res.status(500).json({ error: err.message });
  }
});

function normalizePhraseImage(phrase) {
  if (!phrase || typeof phrase !== 'object') return phrase;
  const p = { ...phrase };
  const raw = p.image ?? p.imageUrl ?? null;
  if (typeof raw === 'string' && raw.trim()) {
    p.image = raw.replace(/^.*[/\\]/, '').trim() || null;
  } else {
    p.image = null;
  }
  return p;
}

/** PUT /api/sets/:setid - 세트 설정 저장. body: { setid?, phrases, serial, remoteControl } */
router.put('/:setid', async (req, res) => {
  try {
    const setid = req.params.setid?.trim();
    if (!setid) return res.status(400).json({ success: false, message: 'setid 필요' });
    const { phrases, serial, remoteControl } = req.body || {};
    const coll = getAgentSetsCollection();
    const existing = await coll.findOne({ setid });
    if (!existing) return res.status(404).json({ success: false, message: '세트 없음' });
    const rawPhrases = Array.isArray(phrases) ? phrases : (existing.phrases || []);
    const normalizedPhrases = rawPhrases.map(normalizePhraseImage);
    const doc = {
      setid: existing.setid,
      userid: existing.userid,
      phrases: normalizedPhrases,
      serial: serial && typeof serial === 'object' ? serial : (existing.serial || { ports: [] }),
      remoteControl: remoteControl && typeof remoteControl === 'object'
        ? remoteControl
        : (existing.remoteControl || { remotes: [] }),
      updatedAt: new Date(),
    };
    await coll.updateOne({ setid }, { $set: doc });
    return res.json({ setid, success: true });
  } catch (err) {
    console.error('PUT /api/sets/:setid', err);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/sets - 신규 세트. body: { setid, userid } (세트는 userid에 종속) */
router.post('/', async (req, res) => {
  try {
    const { setid, userid } = req.body || {};
    if (!setid || !String(setid).trim()) {
      return res.status(400).json({ success: false, message: 'setid 필요' });
    }
    if (!userid || !String(userid).trim()) {
      return res.status(400).json({ success: false, message: 'userid 필요' });
    }
    const id = String(setid).trim();
    const uid = String(userid).trim();
    const coll = getAgentSetsCollection();
    const existing = await coll.findOne({ setid: id });
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 존재하는 setid' });
    }
    await coll.insertOne({
      setid: id,
      userid: uid,
      phrases: [],
      serial: { ports: [] },
      remoteControl: { remotes: [] },
      updatedAt: new Date(),
    });
    return res.status(201).json({ setid: id, userid: uid });
  } catch (err) {
    console.error('POST /api/sets', err);
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/sets/:setid */
router.delete('/:setid', async (req, res) => {
  try {
    const setid = req.params.setid;
    const coll = getAgentSetsCollection();
    const r = await coll.deleteOne({ setid });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/sets/:setid', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
