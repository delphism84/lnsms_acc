/**
 * setid.md: 서버로 브로드캐스팅. 모든 등록된 Agent에 RX 시뮬레이션 전파.
 */
import { Router } from 'express';
import { getRegisteredAgents } from '../agentsStore.js';

const router = Router();

/** POST /api/broadcast - body: { bellCode }. 등록된 모든 Agent에 RX 시뮬레이션 요청 전송 */
router.post('/', async (req, res) => {
  try {
    const { bellCode } = req.body || {};
    if (!bellCode || typeof bellCode !== 'string' || !bellCode.trim()) {
      return res.status(400).json({ success: false, message: 'bellCode 필요' });
    }
    const code = bellCode.trim();
    const list = getRegisteredAgents();
    const results = await Promise.allSettled(
      list.map((a) =>
        fetch(`${a.callbackUrl.replace(/\/$/, '')}/api/broadcast/receive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bellCode: code }),
          signal: AbortSignal.timeout(5000),
        })
      )
    );
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value?.ok).length;
    const fail = results.length - ok;
    return res.json({ success: true, bellCode: code, sent: results.length, ok, fail });
  } catch (err) {
    console.error('POST /api/broadcast', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
