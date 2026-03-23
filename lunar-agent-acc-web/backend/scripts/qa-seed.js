/**
 * QA 봇: Admin BE API로 userid-storeid-setid 1개 필백 세팅
 * 사용: node scripts/qa-seed.js [BASE_URL]
 * 기본 BASE_URL: http://localhost:60000
 */
const BASE = process.argv[2] || 'http://localhost:60000';

const QA_USER_ID = 'qa-user-001';
const QA_USER_PW = 'qa-pw-001';
const QA_STORE_ID = 'qa-store-001';
const QA_SET_ID = 'qa-set-001';

const QA_PHRASES = [
  {
    uid: '90000001',
    text: '도와주세요',
    isEnabled: true,
    color: '#FF0000',
    bellCodes: ['crcv.assist'],
    autoCloseEnabled: false,
    autoCloseSeconds: 10,
    image: null,
    makerId: null,
    modelId: null,
  },
  {
    uid: 'qa-ph-1',
    text: 'QA 호출 1',
    isEnabled: true,
    color: '#0066CC',
    bellCodes: ['qa.1'],
    autoCloseEnabled: false,
    autoCloseSeconds: 10,
    image: null,
    makerId: null,
    modelId: null,
  },
];

async function request(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opt = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  if (!res.ok) throw new Error(data.message || data.error || `HTTP ${res.status}: ${text}`);
  return data;
}

async function main() {
  console.log('QA 시드: LNSMS BE', BASE);
  try {
    // 1) 유저 생성 (이미 있으면 400 무시)
    try {
      await request('POST', '/api/users', { userid: QA_USER_ID, userpw: QA_USER_PW });
      console.log('  user:', QA_USER_ID);
    } catch (e) {
      if (e.message && e.message.includes('이미 존재')) console.log('  user:', QA_USER_ID, '(기존)');
      else throw e;
    }

    // 2) 매장 생성
    try {
      await request('POST', '/api/store', { storeid: QA_STORE_ID, userid: QA_USER_ID });
      console.log('  store:', QA_STORE_ID);
    } catch (e) {
      if (e.message && e.message.includes('이미 존재')) console.log('  store:', QA_STORE_ID, '(기존)');
      else throw e;
    }

    // 3) 세트 생성 (userid 종속)
    try {
      await request('POST', '/api/sets', { setid: QA_SET_ID, userid: QA_USER_ID });
      console.log('  set:', QA_SET_ID);
    } catch (e) {
      if (e.message && e.message.includes('이미 존재')) console.log('  set:', QA_SET_ID, '(기존)');
      else throw e;
    }

    // 4) 매장에 세트 연결 (setids)
    await request('PUT', `/api/store/${QA_STORE_ID}/setids`, { setids: [QA_SET_ID] });
    console.log('  store setids:', QA_SET_ID);

    // 5) 세트 설정 저장 (문구 포함, 1:1 페이로드)
    await request('PUT', `/api/sets/${QA_SET_ID}`, {
      phrases: QA_PHRASES,
      serial: { ports: [] },
    });
    console.log('  set config: phrases', QA_PHRASES.length, '개');

    console.log('QA 필백 완료:', QA_USER_ID, '->', QA_STORE_ID, '->', QA_SET_ID);
  } catch (err) {
    console.error('QA 시드 실패:', err.message);
    process.exit(1);
  }
}

main();
