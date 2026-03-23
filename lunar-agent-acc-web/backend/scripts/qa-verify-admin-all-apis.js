/**
 * lnms-admin/src/lib/api.ts 가 호출하는 백엔드 API 전부 검증
 *
 * 매핑:
 *   getUsers              → GET  /api/users
 *   createUser            → POST /api/users
 *   deleteUser            → DELETE /api/users/:userid
 *   getStores             → GET  /api/store, /api/store?userid=
 *   createStore           → POST /api/store
 *   deleteStore           → DELETE /api/store/:storeid
 *   getStore              → GET  /api/store/:storeid
 *   updateStoreSetids     → PUT  /api/store/:storeid/setids
 *   getSets               → GET  /api/sets, /api/sets?userid=
 *   createSet             → POST /api/sets
 *   deleteSet             → DELETE /api/sets/:setid
 *   getSetConfig          → GET  /api/sets/:setid/config
 *   saveSetConfig         → PUT  /api/sets/:setid
 *   broadcast             → POST /api/broadcast
 * (추가) GET /api/health — 서버 가동 확인
 *
 * 사용: node scripts/qa-verify-admin-all-apis.js [BASE_URL]
 * 환경변수: LNSMS_QA_BASE (BASE_URL 인자가 없을 때)
 */
const BASE = process.argv[2] || process.env.LNSMS_QA_BASE || 'http://localhost:60000';

const ts = Date.now();
const QA_USER = `qa-adm-u-${ts}`;
const QA_PW = 'qa-pw-x';
const QA_STORE = `qa-adm-st-${ts}`;
const QA_SET = `qa-adm-set-${ts}`;

let pass = 0;
let fail = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    pass += 1;
    console.log(`  [OK] ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.error(`  [FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
  return cond;
}

async function request(method, path, body = null) {
  const url = `${BASE}${path}`;
  const opt = { method, headers: { 'Content-Type': 'application/json' } };
  if (body != null) opt.body = JSON.stringify(body);
  const res = await fetch(url, opt);
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { res, data, text };
}

async function main() {
  console.log('QA: admin 전체 API (lnms-admin/src/lib/api.ts)', BASE);
  console.log(`  리소스 접두: user=${QA_USER}, store=${QA_STORE}, set=${QA_SET}\n`);

  // --- Health (운영 확인용, admin 직접 호출은 아님) ---
  {
    const { res, data } = await request('GET', '/api/health');
    assert('GET /api/health', res.ok && data?.ok === true, `db=${data?.db}`);
    if (!res.ok) {
      console.error('\n백엔드가 안 떠 있거나 BASE_URL이 잘못됐습니다. backend/.env 의 PORT 와 맞추세요.\n');
      process.exit(1);
    }
  }

  // --- POST /api/users (createUser) ---
  {
    const { res, data } = await request('POST', '/api/users', { userid: QA_USER, userpw: QA_PW });
    assert('POST /api/users', res.status === 201 || (res.status === 400 && String(data?.message || '').includes('이미')), JSON.stringify(data));
  }

  // --- GET /api/users (getUsers) ---
  {
    const { res, data } = await request('GET', '/api/users');
    const list = Array.isArray(data) ? data : [];
    assert('GET /api/users', res.ok && list.some((u) => u.userid === QA_USER), `count=${list.length}`);
  }

  // --- POST /api/store (createStore) ---
  {
    const { res, data } = await request('POST', '/api/store', { storeid: QA_STORE, userid: QA_USER });
    assert('POST /api/store', res.status === 201 || (res.status === 400 && String(data?.message || '').includes('이미')), String(res.status));
  }

  // --- GET /api/store (getStores 전체) ---
  {
    const { res, data } = await request('GET', '/api/store');
    const list = Array.isArray(data) ? data : [];
    assert('GET /api/store', res.ok && list.some((s) => s.storeid === QA_STORE), `count=${list.length}`);
  }

  // --- GET /api/store?userid= (getStores 필터) ---
  {
    const { res, data } = await request('GET', `/api/store?userid=${encodeURIComponent(QA_USER)}`);
    const list = Array.isArray(data) ? data : [];
    assert(
      'GET /api/store?userid=',
      res.ok && list.every((s) => !s.userid || s.userid === QA_USER) && list.some((s) => s.storeid === QA_STORE),
      `count=${list.length}`
    );
  }

  // --- POST /api/sets (createSet) ---
  {
    const { res, data } = await request('POST', '/api/sets', { setid: QA_SET, userid: QA_USER });
    assert('POST /api/sets', res.status === 201 || (res.status === 400 && String(data?.message || '').includes('이미')), String(res.status));
  }

  // --- GET /api/sets (getSets 전체) ---
  {
    const { res, data } = await request('GET', '/api/sets');
    const list = Array.isArray(data) ? data : [];
    assert('GET /api/sets', res.ok && list.some((s) => s.setid === QA_SET), `count=${list.length}`);
  }

  // --- GET /api/sets?userid= (getSets 필터) ---
  {
    const { res, data } = await request('GET', `/api/sets?userid=${encodeURIComponent(QA_USER)}`);
    const list = Array.isArray(data) ? data : [];
    assert(
      'GET /api/sets?userid=',
      res.ok && list.every((s) => !s.userid || s.userid === QA_USER) && list.some((s) => s.setid === QA_SET),
      `count=${list.length}`
    );
  }

  // --- GET /api/sets/:setid/config (getSetConfig) ---
  {
    const { res, data } = await request('GET', `/api/sets/${encodeURIComponent(QA_SET)}/config`);
    assert(
      'GET /api/sets/:setid/config',
      res.ok && data?.setid === QA_SET && Array.isArray(data?.phrases) && data?.serial?.ports !== undefined,
      `phrases=${data?.phrases?.length}`
    );
  }

  // --- PUT /api/sets/:setid (saveSetConfig) ---
  const samplePhrases = [
    {
      uid: 'adm-qa-1',
      text: '검증',
      isEnabled: true,
      color: '#111111',
      bellCodes: ['qa.bc'],
      autoCloseEnabled: false,
      autoCloseSeconds: 10,
      image: null,
    },
  ];
  const sampleSerial = { ports: [{ id: 'p1', portName: 'COM1', baudRate: 9600, autoConnect: true }] };
  {
    const { res, data } = await request('PUT', `/api/sets/${encodeURIComponent(QA_SET)}`, {
      phrases: samplePhrases,
      serial: sampleSerial,
    });
    assert('PUT /api/sets/:setid', res.ok && (data?.success === true || data?.setid === QA_SET), JSON.stringify(data));
  }

  // --- GET /api/store/:storeid (getStore) ---
  {
    const { res, data } = await request('GET', `/api/store/${encodeURIComponent(QA_STORE)}`);
    assert('GET /api/store/:storeid (연결 전)', res.ok && data?.storeid === QA_STORE, `setids=${(data?.setids || []).length}`);
  }

  // --- PUT /api/store/:storeid/setids (updateStoreSetids) ---
  {
    const { res, data } = await request('PUT', `/api/store/${encodeURIComponent(QA_STORE)}/setids`, {
      setids: [QA_SET],
    });
    assert('PUT /api/store/:storeid/setids', res.ok && data?.success === true && Array.isArray(data?.setids), JSON.stringify(data?.setids));
  }

  {
    const { res, data } = await request('GET', `/api/store/${encodeURIComponent(QA_STORE)}`);
    const ids = data?.setids || [];
    assert('GET /api/store/:storeid (setids 반영)', res.ok && ids.includes(QA_SET), ids.join(','));
  }

  // --- POST /api/broadcast (broadcast) — Agent 없어도 200 success 가능 ---
  {
    const { res, data } = await request('POST', '/api/broadcast', { bellCode: 'qa.verify.bc' });
    assert(
      'POST /api/broadcast',
      res.ok && data?.success === true && data?.bellCode === 'qa.verify.bc',
      `sent=${data?.sent} ok=${data?.ok} fail=${data?.fail}`
    );
  }

  // --- DELETE /api/sets/:setid (deleteSet) ---
  {
    const { res } = await request('DELETE', `/api/sets/${encodeURIComponent(QA_SET)}`);
    assert('DELETE /api/sets/:setid', res.status === 204 || res.ok, String(res.status));
  }

  // --- DELETE /api/store/:storeid (deleteStore) ---
  {
    const { res } = await request('DELETE', `/api/store/${encodeURIComponent(QA_STORE)}`);
    assert('DELETE /api/store/:storeid', res.status === 204 || res.ok, String(res.status));
  }

  // --- DELETE /api/users/:userid (deleteUser) ---
  {
    const { res } = await request('DELETE', `/api/users/${encodeURIComponent(QA_USER)}`);
    assert('DELETE /api/users/:userid', res.status === 204 || res.ok, String(res.status));
  }

  // --- 확인: 유저 삭제됨 ---
  {
    const { res, data } = await request('GET', '/api/users');
    const list = Array.isArray(data) ? data : [];
    assert('GET /api/users (삭제 후)', res.ok && !list.some((u) => u.userid === QA_USER), `still=${list.some((u) => u.userid === QA_USER)}`);
  }

  console.log('');
  console.log(`결과: ${pass} OK, ${fail} FAIL`);
  if (fail > 0) process.exit(1);
  console.log('admin NEXT_PUBLIC_LNSMS_API 가 위 BASE 와 같아야 UI에서도 동일하게 동작합니다.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
