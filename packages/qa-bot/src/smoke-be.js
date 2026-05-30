const cfg = require('./config');
const { fetchOk, readJsonSafe } = require('./http');
const WebSocket = require('ws');

async function wsHelloCheck(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${cfg.beUrl.replace(/^http/, 'ws')}/ws`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('ws timeout'));
    }, 8000);

    ws.on('error', () => {
      clearTimeout(timer);
      reject(new Error('ws connect failed'));
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ v: 1, tag: 'REQ.hello', msg: { token } }));
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(String(data));
        if (parsed.tag === 'REP.hello') {
          clearTimeout(timer);
          ws.close();
          resolve(parsed);
          return;
        }
        if (parsed.tag?.startsWith('ERR.')) {
          clearTimeout(timer);
          ws.close();
          reject(new Error(parsed.msg?.message || parsed.tag));
        }
      } catch (e) {
        clearTimeout(timer);
        ws.close();
        reject(e);
      }
    });
  });
}

async function wsBellIngest(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${cfg.beUrl.replace(/^http/, 'ws')}/ws`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('ws bell timeout'));
    }, 8000);
    let helloDone = false;

    ws.on('error', () => {
      clearTimeout(timer);
      reject(new Error('ws connect failed'));
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ v: 1, tag: 'REQ.hello', msg: { token } }));
    });

    ws.on('message', (data) => {
      try {
        const parsed = JSON.parse(String(data));
        if (parsed.tag === 'REP.hello' && !helloDone) {
          helloDone = true;
          ws.send(
            JSON.stringify({
              v: 1,
              tag: 'REQ.ingest',
              trid: `qa-${Date.now()}`,
              msg: {
                eventId: `qa-event-${Date.now()}`,
                eqId: 'eq-qa-1',
                userid: cfg.guestUserid,
                storeId: cfg.guestStoreId,
              },
            })
          );
          return;
        }
        if (parsed.tag === 'REP.ingest') {
          clearTimeout(timer);
          ws.close();
          if (!parsed.msg?.accepted) throw new Error('ingest not accepted');
          resolve(parsed);
          return;
        }
        if (parsed.tag?.startsWith('ERR.')) {
          clearTimeout(timer);
          ws.close();
          reject(new Error(parsed.msg?.message || parsed.tag));
        }
      } catch (e) {
        clearTimeout(timer);
        ws.close();
        reject(e);
      }
    });
  });
}

async function tusUploadComplete(token) {
  const body = Buffer.from(`qa-tus-${Date.now()}`);
  const b64 = (s) => Buffer.from(s).toString('base64');
  const base = `${cfg.beUrl}/api/store/${cfg.guestUserid}/${cfg.guestStoreId}/upload/tus`;
  const create = await fetch(base, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Upload-Length': String(body.length),
      'Upload-Metadata': `filename ${b64('qa-test.txt')},mimetype ${b64('text/plain')},userid ${b64(cfg.guestUserid)},storeId ${b64(cfg.guestStoreId)}`,
      'Tus-Resumable': '1.0.0',
    },
  });
  if (!create.ok && create.status !== 201) throw new Error(`tus create HTTP ${create.status}`);
  const location = create.headers.get('location');
  if (!location) throw new Error('no location header');
  const uploadUrl = location.startsWith('http')
    ? location
    : location.startsWith('//')
      ? `http:${location}`
      : `${cfg.beUrl}${location.startsWith('/') ? location : `/${location}`}`;

  const patch = await fetch(uploadUrl, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': '0',
      'Tus-Resumable': '1.0.0',
    },
    body,
  });
  if (!patch.ok) throw new Error(`tus patch HTTP ${patch.status}`);

  const uploadId = uploadUrl.split('/').filter(Boolean).pop();
  const result = await fetchOk(
    `${cfg.beUrl}/api/store/${cfg.guestUserid}/${cfg.guestStoreId}/upload/tus/${uploadId}/result`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!result.ok) throw new Error(`result HTTP ${result.status}`);
  const meta = await readJsonSafe(result);
  if (!meta?.url || !meta?.filename) throw new Error('result missing url/filename');
  return meta;
}

async function wsUploadDone(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${cfg.beUrl.replace(/^http/, 'ws')}/ws`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('ws upload.done timeout'));
    }, 12000);
    let helloDone = false;
    const topic = `lnsms.store.${cfg.guestUserid}.${cfg.guestStoreId}.upload`;

    ws.on('error', () => {
      clearTimeout(timer);
      reject(new Error('ws connect failed'));
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ v: 1, tag: 'REQ.hello', msg: { token } }));
    });

    ws.on('message', (data) => {
      void (async () => {
        try {
          const parsed = JSON.parse(String(data));
          if (parsed.tag === 'REP.hello' && !helloDone) {
            helloDone = true;
            ws.send(JSON.stringify({ v: 1, tag: 'REQ.listen', msg: { topics: [topic] } }));
            await tusUploadComplete(token);
            return;
          }
          if (parsed.tag === 'EVT.upload.done') {
            clearTimeout(timer);
            ws.close();
            if (!parsed.msg?.url) throw new Error('upload.done missing url');
            resolve(parsed);
          }
          if (parsed.tag?.startsWith('ERR.')) {
            clearTimeout(timer);
            ws.close();
            reject(new Error(parsed.msg?.message || parsed.tag));
          }
        } catch (e) {
          clearTimeout(timer);
          ws.close();
          reject(e);
        }
      })();
    });
  });
}

async function wsChangedOnCategory(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${cfg.beUrl.replace(/^http/, 'ws')}/ws`);
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('ws changed timeout'));
    }, 12000);
    let helloDone = false;
    let categoryId = null;
    const topic = `lnsms.store.${cfg.guestUserid}.${cfg.guestStoreId}.>`;

    ws.on('error', () => {
      clearTimeout(timer);
      reject(new Error('ws connect failed'));
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({ v: 1, tag: 'REQ.hello', msg: { token } }));
    });

    ws.on('message', (data) => {
      void (async () => {
        try {
          const parsed = JSON.parse(String(data));
          if (parsed.tag === 'REP.hello' && !helloDone) {
            helloDone = true;
            ws.send(JSON.stringify({ v: 1, tag: 'REQ.listen', msg: { topics: [topic] } }));
            return;
          }
          if (parsed.tag === 'REP.listen') {
            const res = await fetchOk(
              `${cfg.beUrl}/api/store/${cfg.guestUserid}/${cfg.guestStoreId}/categories`,
              {
                method: 'POST',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ name: `qa-cat-${Date.now()}`, order: 0 }),
              }
            );
            if (!res.ok) throw new Error(`create category HTTP ${res.status}`);
            const body = await readJsonSafe(res);
            categoryId = body?._id;
            return;
          }
          if (parsed.tag === 'EVT.changed' && parsed.msg?.entity === 'categories') {
            clearTimeout(timer);
            ws.close();
            if (categoryId) {
              await fetchOk(
                `${cfg.beUrl}/api/store/${cfg.guestUserid}/${cfg.guestStoreId}/categories/${categoryId}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
              ).catch(() => {});
            }
            resolve(parsed);
          }
          if (parsed.tag?.startsWith('ERR.')) {
            clearTimeout(timer);
            ws.close();
            reject(new Error(parsed.msg?.message || parsed.tag));
          }
        } catch (e) {
          clearTimeout(timer);
          ws.close();
          reject(e);
        }
      })();
    });
  });
}

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    return { name, ok: true, ms: Date.now() - started };
  } catch (err) {
    return { name, ok: false, ms: Date.now() - started, error: err.message || String(err) };
  }
}

async function runBeSmoke() {
  const results = [];
  let hostToken = null;
  let adminToken = null;

  results.push(
    await check('be.health', async () => {
      const res = await fetchOk(`${cfg.beUrl}/health`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      if (body?.status !== 'ok') throw new Error('status != ok');
    })
  );

  results.push(
    await check('be.host.login', async () => {
      const res = await fetchOk(`${cfg.beUrl}/api/host/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userid: cfg.guestUserid,
          storeId: cfg.guestStoreId,
          password: cfg.guestPassword,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      hostToken = body?.accessToken || body?.token;
      if (!hostToken) throw new Error('no accessToken');
    })
  );

  results.push(
    await check('be.ws.hello', async () => {
      if (!hostToken) throw new Error('no host token');
      const rep = await wsHelloCheck(hostToken);
      if (rep.msg?.aud !== 'host') throw new Error('aud != host');
    })
  );

  results.push(
    await check('be.ws.bell.ingest', async () => {
      if (!hostToken) throw new Error('no host token');
      await wsBellIngest(hostToken);
    })
  );

  results.push(
    await check('be.store.context', async () => {
      if (!hostToken) throw new Error('no host token');
      const uid = cfg.guestUserid;
      const sid = cfg.guestStoreId;
      const res = await fetchOk(`${cfg.beUrl}/api/store/${uid}/${sid}/context`, {
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      if (body?.userid !== uid || body?.storeId !== sid) throw new Error('StoreKey mismatch');
    })
  );

  results.push(
    await check('be.tus.upload', async () => {
      if (!hostToken) throw new Error('no host token');
      await tusUploadComplete(hostToken);
    })
  );

  results.push(
    await check('be.ws.upload.done', async () => {
      if (!hostToken) throw new Error('no host token');
      await wsUploadDone(hostToken);
    })
  );

  results.push(
    await check('be.ws.changed', async () => {
      if (!hostToken) throw new Error('no host token');
      await wsChangedOnCategory(hostToken);
    })
  );

  results.push(
    await check('be.host.sync.export', async () => {
      if (!hostToken) throw new Error('no host token');
      const uid = cfg.guestUserid;
      const sid = cfg.guestStoreId;
      const res = await fetchOk(`${cfg.beUrl}/api/host/${uid}/${sid}/sync/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hostToken}`,
        },
        body: '{}',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      if (!body?.collections) throw new Error('missing collections');
      const sets = body.collections.set_configs || body.collections.setConfigs;
      if (!Array.isArray(sets)) throw new Error('missing set_configs');
      const hasDefault = sets.some((s) => s?.setid === 'default');
      if (!hasDefault) throw new Error('set_configs missing default');
    })
  );

  results.push(
    await check('be.admin.login', async () => {
      const res = await fetchOk(`${cfg.beUrl}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cfg.adminUser, password: cfg.adminPassword }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      adminToken = body?.accessToken || body?.token;
      if (!adminToken) throw new Error('no accessToken');
    })
  );

  results.push(
    await check('be.platform.stores.auth', async () => {
      if (!adminToken) throw new Error('no admin token');
      const res = await fetchOk(`${cfg.beUrl}/api/platform/stores`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await readJsonSafe(res);
      if (!Array.isArray(body)) throw new Error('expected array');
    })
  );

  results.push(
    await check('be.platform.stores.unauth', async () => {
      const res = await fetchOk(`${cfg.beUrl}/api/platform/stores`);
      if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
    })
  );

  return results;
}

module.exports = { runBeSmoke };
