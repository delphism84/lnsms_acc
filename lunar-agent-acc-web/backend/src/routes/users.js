import { Router } from 'express';
import { getUsersCollection } from '../db.js';

const router = Router();

/** GET /api/users - 목록 */
router.get('/', async (req, res) => {
  try {
    const coll = getUsersCollection();
    const list = await coll.find({}).project({ userpw: 0 }).sort({ userid: 1 }).toArray();
    return res.json(list);
  } catch (err) {
    console.error('GET /api/users', err);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/users - 생성. body: { userid, userpw } */
router.post('/', async (req, res) => {
  try {
    const { userid, userpw } = req.body || {};
    if (!userid || !userpw) {
      return res.status(400).json({ success: false, message: 'userid, userpw 필요' });
    }
    const id = String(userid).trim();
    const coll = getUsersCollection();
    const existing = await coll.findOne({ userid: id });
    if (existing) {
      return res.status(400).json({ success: false, message: '이미 존재하는 userid' });
    }
    await coll.insertOne({
      userid: id,
      userpw: String(userpw),
      createdAt: new Date(),
    });
    return res.status(201).json({ userid: id });
  } catch (err) {
    console.error('POST /api/users', err);
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/users/:userid */
router.delete('/:userid', async (req, res) => {
  try {
    const userid = req.params.userid;
    const coll = getUsersCollection();
    const r = await coll.deleteOne({ userid });
    if (r.deletedCount === 0) return res.status(404).json({ error: 'Not found' });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/users/:userid', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
