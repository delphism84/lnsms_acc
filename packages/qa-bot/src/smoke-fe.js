const cfg = require('./config');
const { fetchOk } = require('./http');

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    return { name, ok: true, ms: Date.now() - started };
  } catch (err) {
    return { name, ok: false, ms: Date.now() - started, error: err.message || String(err) };
  }
}

async function runFeSmoke() {
  const results = [];

  results.push(
    await check('fe.health-proxy', async () => {
      const res = await fetchOk(`${cfg.feUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  results.push(
    await check('fe.host.setting', async () => {
      const path = `/s/${cfg.guestUserid}/${cfg.guestStoreId}/setting`;
      const res = await fetchOk(`${cfg.feUrl}${path}`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    })
  );

  results.push(
    await check('fe.login', async () => {
      const res = await fetchOk(`${cfg.feUrl}/login`);
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    })
  );

  results.push(
    await check('fe.host.login-api', async () => {
      const res = await fetchOk(`${cfg.feUrl}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid: cfg.guestUserid,
          storeId: cfg.guestStoreId,
          password: cfg.guestPassword,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    })
  );

  return results;
}

module.exports = { runFeSmoke };
