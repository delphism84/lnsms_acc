import { Router } from 'express';
import { getUsersCollection } from '../db.js';

const router = Router();

async function ensureAdminUser() {
  const coll = getUsersCollection();
  const admin = await coll.findOne({ userid: 'admin' });
  if (!admin) {
    await coll.insertOne({
      userid: 'admin',
      userpw: 'admin',
      createdAt: new Date(),
    });
  }
}

/** POST /api/auth/login - body: { userid, userpw } */
router.post('/login', async (req, res) => {
  try {
    await ensureAdminUser();
    const { userid, userpw } = req.body || {};
    if (!userid || !userpw) {
      return res.status(400).json({ success: false, message: 'userid, userpw 필요' });
    }
    const coll = getUsersCollection();
    const user = await coll.findOne({ userid: String(userid).trim() });
    if (!user || user.userpw !== String(userpw)) {
      return res.status(401).json({ success: false, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }
    return res.json({ success: true, userid: user.userid });
  } catch (err) {
    console.error('POST /api/auth/login', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
