/**
 * QA 봇: Admin이 쓰는 API(매장 setids, 세트 설정 저장) 검증
 * 사용: node scripts/qa-verify-admin-api.js [BASE_URL]
 * 기본: http://localhost:60000  (백엔드 .env의 PORT와 맞출 것)
 */
const BASE = process.argv[2] || process.env.LNSMS_QA_BASE || 'http://localhost:60000';

let pass = 0;
let fail = 0;

function ok(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  [OK] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.error(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function request(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { _raw: text };
  }
  return { res, data };
}

async function main() {
  console.log('QA 검증: Admin API (setids + set config)', BASE);
  console.log('');

  // Health
  try {
    const { res, data } = await request('GET', '/api/health');
    ok('GET /api/health', res.ok && data.ok === true, `db=${data.db}`);
  } catch (e) {
    ok('GET /api/health', false, e.message);
    console.error('\n백엔드를 먼저 띄우고, BASE_URL이 backend .env의 PORT와 같은지 확인하세요.');
    console.error('예: node scripts/qa-verify-admin-api.js http://localhost:58001\n');
    process.exit(1);
  }

  const QA_USER = 'qa-bot-user';
  const QA_PW = 'qa-bot-pw';
  const QA_STORE = 'qa-bot-store';
  const QA_SET = 'qa-bot-set';

  // 유저
  let r = await request('POST', '/api/users', { userid: QA_USER, userpw: QA_PW });
  if (!r.res.ok && !(String(r.data.message || '').includes('이미 존재'))) {
    ok('POST /api/users (seed)', false, JSON.stringify(r.data));
  } else {
    ok('POST /api/users (seed)', true);
  }

  // 매장
  r = await request('POST', '/api/store', { storeid: QA_STORE, userid: QA_USER });
  if (!r.res.ok && !(String(r.data.message || '').includes('이미 존재'))) {
    ok('POST /api/store (seed)', false, JSON.stringify(r.data));
  } else {
    ok('POST /api/store (seed)', true);
  }

  // 세트
  r = await request('POST', '/api/sets', { setid: QA_SET, userid: QA_USER });
  if (!r.res.ok && !(String(r.data.message || '').includes('이미 존재'))) {
    ok('POST /api/sets (seed)', false, JSON.stringify(r.data));
  } else {
    ok('POST /api/sets (seed)', true);
  }

  // 핵심: 매장 setids 저장 (Admin updateStoreSetids 와 동일)
  r = await request('PUT', `/api/store/${encodeURIComponent(QA_STORE)}/setids`, {
    setids: [QA_SET, 'extra-set-ref'],
  });
  ok(
    'PUT /api/store/:storeid/setids',
    r.res.ok && r.data.success === true && Array.isArray(r.data.setids),
    JSON.stringify(r.data.setids || r.data)
  );

  r = await request('GET', `/api/store/${encodeURIComponent(QA_STORE)}`);
  const setids = r.data.setids || [];
  ok(
    'GET /api/store/:storeid → setids 반영',
    r.res.ok && setids.includes(QA_SET) && setids.includes('extra-set-ref'),
    setids.join(',')
  );

  // 세트 설정 저장 (Admin saveSetConfig 와 동일)
  const phrases = [
    {
      uid: 'qa-uid-1',
      text: 'QA',
      isEnabled: true,
      color: '#000000',
      bellCodes: ['t.1'],
      autoCloseEnabled: false,
      autoCloseSeconds: 10,
      image: null,
    },
  ];
  r = await request('PUT', `/api/sets/${encodeURIComponent(QA_SET)}`, {
    phrases,
    serial: { ports: [{ id: 'p1', portName: 'COM9', baudRate: 9600, autoConnect: false }] },
  });
  ok('PUT /api/sets/:setid (config)', r.res.ok && (r.data.success === true || r.data.setid), JSON.stringify(r.data));

  r = await request('GET', `/api/sets/${encodeURIComponent(QA_SET)}/config`);
  const loaded = r.data;
  ok(
    'GET /api/sets/:setid/config',
    r.res.ok && loaded.setid === QA_SET && Array.isArray(loaded.phrases) && loaded.phrases.length >= 1,
    `phrases=${loaded.phrases?.length}`
  );

  console.log('');
  console.log(`결과: ${pass} OK, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
  console.log('Admin의 NEXT_PUBLIC_LNSMS_API 가 위 BASE와 같아야 매장 세트 연결·저장이 동작합니다.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
