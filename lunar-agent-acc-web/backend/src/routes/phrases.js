import { Router } from 'express';
import { getPhrasesCollection, DOC_ID } from '../db.js';
const router = Router();
const DEFAULT_UID = '90000001';
const DEFAULT_BELL_CODE = 'crcv.assist';

function normalizeBellCodes(bellCodes) {
  if (!Array.isArray(bellCodes)) return [];
  return [...new Set(bellCodes
    .filter((c) => c != null && String(c).trim() !== '')
    .map((c) => String(c).toLowerCase().trim()))];
}

function ensureDefaultPhrase(doc) {
  const phrases = doc?.phrases || [];
  const withDefaultUid = phrases.filter((p) => p.uid === DEFAULT_UID);
  let validDefault = withDefaultUid.find(
    (p) => Array.isArray(p.bellCodes) && p.bellCodes.some((c) => String(c).toLowerCase().trim() === DEFAULT_BELL_CODE)
  );

  // Remove [TEST] phrases
  const cleaned = phrases.filter((p) => !(p.text && p.text.startsWith('[TEST]')));
  let needsSave = phrases.length !== cleaned.length;

  for (const p of withDefaultUid) {
    const hasDefault = Array.isArray(p.bellCodes) && p.bellCodes.some((c) => String(c).toLowerCase().trim() === DEFAULT_BELL_CODE);
    if (!hasDefault) {
      if (validDefault == null && withDefaultUid.length === 1) {
        p.bellCodes = p.bellCodes || [];
        if (!p.bellCodes.some((c) => String(c).toLowerCase().trim() === DEFAULT_BELL_CODE)) {
          p.bellCodes.push(DEFAULT_BELL_CODE);
          p.updatedAt = new Date();
          validDefault = p;
          needsSave = true;
        }
      } else {
        const idx = cleaned.indexOf(p);
        if (idx !== -1) {
          cleaned.splice(idx, 1);
          needsSave = true;
        }
      }
    }
  }

  if (validDefault == null) {
    cleaned.unshift({
      uid: DEFAULT_UID,
      text: '도와주세요.',
      isEnabled: true,
      color: '#FF0000',
      bellCodes: [DEFAULT_BELL_CODE],
      autoCloseEnabled: false,
      autoCloseSeconds: 10,
      imageUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    needsSave = true;
  } else {
    const idx = cleaned.indexOf(validDefault);
    if (idx > 0) {
      cleaned.splice(idx, 1);
      cleaned.unshift(validDefault);
      needsSave = true;
    }
  }

  return { phrases: cleaned, needsSave };
}

/** GET /api/phrases - 목록 */
router.get('/', async (req, res) => {
  try {
    const coll = getPhrasesCollection();
    const doc = await coll.findOne({ _id: DOC_ID });
    let phrases = doc?.phrases || [];
    const { phrases: normalized, needsSave } = ensureDefaultPhrase({ phrases });
    phrases = normalized;
    if (needsSave) {
      await coll.replaceOne(
        { _id: DOC_ID },
        { _id: DOC_ID, phrases },
        { upsert: true }
      );
    }
    return res.json({ phrases });
  } catch (err) {
    console.error('GET /api/phrases', err);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/phrases - 생성 */
router.post('/', async (req, res) => {
  try {
    const coll = getPhrasesCollection();
    let doc = await coll.findOne({ _id: DOC_ID });
    let phrases = doc?.phrases || [];
    const { phrases: normalized } = ensureDefaultPhrase({ phrases });
    phrases = normalized;

    const body = req.body || {};
    if (body.uid === DEFAULT_UID) {
      return res.status(400).json({ success: false, message: '기본 문구는 생성할 수 없습니다.' });
    }

    let uid = body.uid && String(body.uid).trim();
    if (!uid) {
      do {
        uid = crypto.randomUUID();
      } while (phrases.some((p) => p.uid === uid));
    } else if (phrases.some((p) => p.uid === uid)) {
      return res.status(400).json({ success: false, message: '이미 존재하는 Uid입니다.' });
    }

    let bellCodes = normalizeBellCodes(body.bellCodes);
    if (!phrases.some((p) => p.uid === DEFAULT_UID && (p.bellCodes || []).includes(DEFAULT_BELL_CODE))) {
      bellCodes = bellCodes.filter((c) => c !== DEFAULT_BELL_CODE);
    }

    const now = new Date();
    const phrase = {
      uid,
      text: (body.text && String(body.text).trim()) || '',
      isEnabled: body.isEnabled !== false,
      color: body.color || '#000000',
      bellCodes,
      autoCloseEnabled: Boolean(body.autoCloseEnabled),
      autoCloseSeconds: Math.max(1, Math.min(3600, Number(body.autoCloseSeconds) || 10)),
      imageUrl: body.imageUrl && String(body.imageUrl).trim() ? String(body.imageUrl).trim() : null,
      createdAt: now,
      updatedAt: now,
    };

    phrases.push(phrase);
    await coll.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, phrases }, { upsert: true });
    return res.json(phrase);
  } catch (err) {
    console.error('POST /api/phrases', err);
    return res.status(500).json({ error: err.message });
  }
});

/** PUT /api/phrases/:uid - 수정 */
router.put('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const coll = getPhrasesCollection();
    const doc = await coll.findOne({ _id: DOC_ID });
    let phrases = doc?.phrases || [];
    const { phrases: normalized } = ensureDefaultPhrase({ phrases });
    phrases = normalized;

    const existing = phrases.find((p) => p.uid === uid);
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const isDefault = existing.uid === DEFAULT_UID;
    let bellCodes = normalizeBellCodes(req.body?.bellCodes);
    if (isDefault) {
      if (!bellCodes.includes(DEFAULT_BELL_CODE)) bellCodes.push(DEFAULT_BELL_CODE);
    } else {
      bellCodes = bellCodes.filter((c) => c !== DEFAULT_BELL_CODE);
    }

    existing.text = (req.body?.text != null ? String(req.body.text) : existing.text) || '';
    existing.isEnabled = req.body?.isEnabled !== false;
    existing.color = req.body?.color ?? existing.color ?? '#000000';
    existing.bellCodes = bellCodes;
    existing.autoCloseEnabled = Boolean(req.body?.autoCloseEnabled);
    existing.autoCloseSeconds = Math.max(1, Math.min(3600, Number(req.body?.autoCloseSeconds) ?? existing.autoCloseSeconds ?? 10));
    existing.imageUrl = req.body?.imageUrl != null
      ? (req.body.imageUrl && String(req.body.imageUrl).trim() ? String(req.body.imageUrl).trim() : null)
      : existing.imageUrl;
    existing.updatedAt = new Date();

    await coll.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, phrases }, { upsert: true });
    return res.json(existing);
  } catch (err) {
    console.error('PUT /api/phrases/:uid', err);
    return res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/phrases/:uid - 삭제 */
router.delete('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const coll = getPhrasesCollection();
    const doc = await coll.findOne({ _id: DOC_ID });
    let phrases = doc?.phrases || [];
    const { phrases: normalized } = ensureDefaultPhrase({ phrases });
    phrases = normalized;

    const phrase = phrases.find((p) => p.uid === uid);
    if (!phrase) return res.status(404).json({ error: 'Not found' });

    const isDefault = (phrase.bellCodes || []).some((c) => String(c).toLowerCase().trim() === DEFAULT_BELL_CODE);
    if (isDefault) {
      return res.status(400).json({ error: '불가능 합니다.' });
    }

    phrases = phrases.filter((p) => p.uid !== uid);
    await coll.replaceOne({ _id: DOC_ID }, { _id: DOC_ID, phrases }, { upsert: true });
    return res.status(204).send();
  } catch (err) {
    console.error('DELETE /api/phrases/:uid', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
