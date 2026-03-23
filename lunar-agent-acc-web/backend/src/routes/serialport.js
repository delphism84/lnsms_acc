import { Router } from 'express';
import { getSerialSettingsCollection, SERIAL_DOC_ID } from '../db.js';

const router = Router();

const defaultSettings = {
  portName: 'COM1',
  baudRate: 9600,
  autoConnect: true,
  secureEnabled: false,
  deviceSerialNumber: '00000000',
};

/** GET /api/serialport/settings */
router.get('/settings', async (req, res) => {
  try {
    const coll = getSerialSettingsCollection();
    const doc = await coll.findOne({ _id: SERIAL_DOC_ID });
    const s = doc || { _id: SERIAL_DOC_ID, ...defaultSettings };
    return res.json({
      portName: s.portName ?? defaultSettings.portName,
      baudRate: s.baudRate ?? defaultSettings.baudRate,
      autoConnect: s.autoConnect !== false,
      secureEnabled: Boolean(s.secureEnabled),
      deviceSerialNumber: s.deviceSerialNumber ?? defaultSettings.deviceSerialNumber,
    });
  } catch (err) {
    console.error('GET /api/serialport/settings', err);
    return res.status(500).json({ error: err.message });
  }
});

async function saveSettings(body) {
  const coll = getSerialSettingsCollection();
  const doc = {
    _id: SERIAL_DOC_ID,
    portName: body.portName ?? defaultSettings.portName,
    baudRate: Number(body.baudRate) || defaultSettings.baudRate,
    autoConnect: body.autoConnect !== false,
    secureEnabled: Boolean(body.secureEnabled),
    deviceSerialNumber: (body.deviceSerialNumber && String(body.deviceSerialNumber).trim()) || defaultSettings.deviceSerialNumber,
  };
  await coll.replaceOne({ _id: SERIAL_DOC_ID }, doc, { upsert: true });
  return doc;
}

/** POST /api/serialport/settings - 저장 (하드웨어 없음) */
router.post('/settings', async (req, res) => {
  try {
    await saveSettings(req.body || {});
    return res.json({ success: true, message: '설정이 저장되었습니다.', isConnected: false });
  } catch (err) {
    console.error('POST /api/serialport/settings', err);
    return res.status(500).json({ error: err.message });
  }
});

/** POST /api/serialport/settings/save-only */
router.post('/settings/save-only', async (req, res) => {
  try {
    await saveSettings(req.body || {});
    return res.json({ success: true, message: '설정이 저장되었습니다.' });
  } catch (err) {
    console.error('POST /api/serialport/settings/save-only', err);
    return res.status(500).json({ error: err.message });
  }
});

/** GET /api/serialport/ports - 서버에는 COM 없음 */
router.get('/ports', (req, res) => {
  return res.json([]);
});

/** GET /api/serialport/status - Node BE에는 시리얼 하드웨어 없음. 프론트가 boolean으로 쓰면 false */
router.get('/status', (req, res) => {
  return res.json(false);
});

export default router;
