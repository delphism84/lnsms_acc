import { Router } from 'express';
import { registerAgent } from '../agentsStore.js';

const router = Router();

router.post('/register', (req, res) => {
  try {
    const { callbackUrl, setid, storeid } = req.body || {};
    if (!callbackUrl || typeof callbackUrl !== 'string' || !callbackUrl.trim()) {
      return res.status(400).json({ success: false, message: 'callbackUrl 필요' });
    }
    registerAgent({ callbackUrl: callbackUrl.trim(), setid, storeid });
    return res.json({ success: true });
  } catch (err) {
    console.error('POST /api/agents/register', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
