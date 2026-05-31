#!/usr/bin/env node
/**
 * Store FE ↔ BE CRUD smoke test (Node fetch, same paths as lnsms-admin-fe).
 * Usage:
 *   node scripts/test-store-fe-api.js
 *   API_BASE=http://127.0.0.1:40000 node scripts/test-store-fe-api.js
 *   API_BASE=http://127.0.0.1:63001 node scripts/test-store-fe-api.js  # via Next proxy
 */
const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:40000').replace(/\/$/, '');
const USERID = process.env.STORE_USERID || 'necall';
const STORE_ID = process.env.STORE_ID || 'guest';
const PASSWORD = process.env.LOCAL_GUEST_PASSWORD || 'guest';
const PLATFORM_USER = process.env.PLATFORM_USER || 'admin';
const PLATFORM_PASSWORD = process.env.PLATFORM_PASSWORD || 'admin';

const results = [];

function pass(name, detail = '') {
  results.push({ name, ok: true, detail });
  console.log(`✅ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, err) {
  const msg = err instanceof Error ? err.message : String(err);
  results.push({ name, ok: false, detail: msg });
  console.error(`❌ ${name} — ${msg}`);
}

async function readJson(res) {
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    const msg =
      body?.message || body?.error || `${res.status} ${res.statusText}` + (body?._raw ? `: ${body._raw}` : '');
    throw new Error(msg);
  }
  return body;
}

async function api(path, init = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(init.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  return readJson(res);
}

async function hostLogin() {
  const data = await api('/api/host/auth/login', {
    method: 'POST',
    body: JSON.stringify({ userid: USERID, storeId: STORE_ID, password: PASSWORD }),
  });
  const token = data.accessToken || data.token;
  if (!token) throw new Error('login response missing accessToken');
  return token;
}

async function main() {
  console.log(`\nStore FE API test → ${API_BASE} (${USERID}.${STORE_ID})\n`);

  let token;
  try {
    await api('/health');
    pass('GET /health');
  } catch (e) {
    fail('GET /health', e);
    throw e;
  }

  try {
    token = await hostLogin();
    pass('POST /api/host/auth/login');
  } catch (e) {
    fail('POST /api/host/auth/login', e);
    process.exit(1);
  }

  try {
    await api('/api/host/auth/verify', { method: 'GET' }, token);
    pass('GET /api/host/auth/verify');
  } catch (e) {
    fail('GET /api/host/auth/verify', e);
  }

  const storeBase = `/api/store/${encodeURIComponent(USERID)}/${encodeURIComponent(STORE_ID)}`;
  let originalName;
  let categoryId;
  let menuId;
  let eqidId;
  const tag = `qa-${Date.now()}`;

  try {
    const ctx = await api(`${storeBase}/context`, { method: 'GET' }, token);
    originalName = ctx?.store?.name || ctx?.name;
    pass('GET store context', originalName || '(no name)');
  } catch (e) {
    fail('GET store context', e);
  }

  try {
    const updated = await api(
      `${storeBase}/context`,
      {
        method: 'PUT',
        body: JSON.stringify({ name: `${originalName || 'Guest'} [${tag}]`, description: `QA ${tag}` }),
      },
      token
    );
    pass('PUT store context', updated?.name || updated?.store?.name);
  } catch (e) {
    fail('PUT store context', e);
  }

  try {
    const cat = await api(
      `${storeBase}/categories`,
      { method: 'POST', body: JSON.stringify({ name: `Cat ${tag}`, description: 'qa', order: 99 }) },
      token
    );
    categoryId = cat._id;
    pass('POST category', categoryId);
  } catch (e) {
    fail('POST category', e);
  }

  if (categoryId) {
    try {
      await api(
        `${storeBase}/categories/${categoryId}`,
        { method: 'PUT', body: JSON.stringify({ name: `Cat ${tag} updated`, order: 100 }) },
        token
      );
      pass('PUT category');
    } catch (e) {
      fail('PUT category', e);
    }
  }

  if (categoryId) {
    try {
      const menu = await api(
        `${storeBase}/menus`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: `Menu ${tag}`,
            description: 'qa menu',
            price: 1200,
            order: 1,
            categoryId,
          }),
        },
        token
      );
      menuId = menu._id;
      pass('POST menu', menuId);
    } catch (e) {
      fail('POST menu', e);
    }
  }

  if (menuId) {
    try {
      await api(
        `${storeBase}/menus/${menuId}`,
        { method: 'PUT', body: JSON.stringify({ price: 1500 }) },
        token
      );
      pass('PUT menu');
    } catch (e) {
      fail('PUT menu', e);
    }
  }

  try {
    const eq = await api(
      `${storeBase}/eqids`,
      { method: 'POST', body: JSON.stringify({ eqid: `dev-${tag}`, displayTime: 3000, enabled: true }) },
      token
    );
    eqidId = eq._id;
    pass('POST eqid', eqidId);
  } catch (e) {
    fail('POST eqid', e);
  }

  if (eqidId) {
    try {
      await api(`${storeBase}/eqids/${eqidId}`, { method: 'PUT', body: JSON.stringify({ enabled: false }) }, token);
      pass('PUT eqid');
    } catch (e) {
      fail('PUT eqid', e);
    }
  }

  try {
    const [cats, menus, eqids] = await Promise.all([
      api(`${storeBase}/categories`, { method: 'GET' }, token),
      api(`${storeBase}/menus`, { method: 'GET' }, token),
      api(`${storeBase}/eqids`, { method: 'GET' }, token),
    ]);
    pass('GET lists', `categories=${cats.length}, menus=${menus.length}, eqids=${eqids.length}`);
  } catch (e) {
    fail('GET lists', e);
  }

  // cleanup
  if (menuId) {
    try {
      await api(`${storeBase}/menus/${menuId}`, { method: 'DELETE' }, token);
      pass('DELETE menu');
    } catch (e) {
      fail('DELETE menu', e);
    }
  }
  if (categoryId) {
    try {
      await api(`${storeBase}/categories/${categoryId}`, { method: 'DELETE' }, token);
      pass('DELETE category');
    } catch (e) {
      fail('DELETE category', e);
    }
  }
  if (eqidId) {
    try {
      await api(`${storeBase}/eqids/${eqidId}`, { method: 'DELETE' }, token);
      pass('DELETE eqid');
    } catch (e) {
      fail('DELETE eqid', e);
    }
  }

  if (originalName !== undefined) {
    try {
      await api(`${storeBase}/context`, { method: 'PUT', body: JSON.stringify({ name: originalName }) }, token);
      pass('PUT store context (restore name)');
    } catch (e) {
      fail('PUT store context (restore name)', e);
    }
  }

  // Platform admin token (same paths FE uses on localhost:63001/platform)
  try {
    const plat = await api('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: PLATFORM_USER, password: PLATFORM_PASSWORD }),
    });
    const platformToken = plat.accessToken || plat.token;
    if (!platformToken) throw new Error('platform login missing token');
    pass('POST /api/admin/auth/login (platform)');

    const ctx = await api(`${storeBase}/context`, { method: 'GET' }, platformToken);
    pass('GET store context (platform token)', ctx?.store?.name || ctx?.name || 'ok');

    const tag2 = `plat-${Date.now()}`;
    const cat = await api(
      `${storeBase}/categories`,
      { method: 'POST', body: JSON.stringify({ name: `Cat ${tag2}`, order: 0 }) },
      platformToken
    );
    await api(`${storeBase}/categories/${cat._id}`, { method: 'DELETE' }, platformToken);
    pass('Platform category CRUD');
  } catch (e) {
    fail('Platform store API', e);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n--- ${results.length - failed.length}/${results.length} passed ---\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
