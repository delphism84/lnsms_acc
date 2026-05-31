#!/usr/bin/env node
/**
 * Remove QA smoke-test rows left in store DB (qa-cat-*, Cat qa-*, Menu qa-*, dev-qa-*).
 * Usage: node scripts/cleanup-qa-store-data.js
 */
const API_BASE = (process.env.API_BASE || 'http://127.0.0.1:40000').replace(/\/$/, '');
const USERID = process.env.STORE_USERID || 'necall';
const STORE_ID = process.env.STORE_ID || 'guest';
const PASSWORD = process.env.LOCAL_GUEST_PASSWORD || 'guest';

const QA_NAME = /^(qa-cat-|Cat qa-|Menu qa-|dev-qa-|qa-)/i;

async function login() {
  const res = await fetch(`${API_BASE}/api/host/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid: USERID, storeId: STORE_ID, password: PASSWORD }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || res.statusText);
  return data.accessToken || data.token;
}

async function main() {
  const token = await login();
  const base = `${API_BASE}/api/store/${encodeURIComponent(USERID)}/${encodeURIComponent(STORE_ID)}`;
  const headers = { Authorization: `Bearer ${token}` };

  const [cats, menus, eqids] = await Promise.all([
    fetch(`${base}/categories`, { headers }).then((r) => r.json()),
    fetch(`${base}/menus`, { headers }).then((r) => r.json()),
    fetch(`${base}/eqids`, { headers }).then((r) => r.json()),
  ]);

  let deleted = { categories: 0, menus: 0, eqids: 0 };

  for (const menu of menus) {
    if (!QA_NAME.test(menu.name || '')) continue;
    const res = await fetch(`${base}/menus/${menu._id}`, { method: 'DELETE', headers });
    if (res.ok) deleted.menus++;
  }

  for (const cat of cats) {
    if (!QA_NAME.test(cat.name || '')) continue;
    const res = await fetch(`${base}/categories/${cat._id}`, { method: 'DELETE', headers });
    if (res.ok) deleted.categories++;
  }

  for (const eq of eqids) {
    const id = eq.eqid || eq.deviceId || '';
    if (!QA_NAME.test(id)) continue;
    const res = await fetch(`${base}/eqids/${eq._id}`, { method: 'DELETE', headers });
    if (res.ok) deleted.eqids++;
  }

  console.log('Cleanup complete:', deleted);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
