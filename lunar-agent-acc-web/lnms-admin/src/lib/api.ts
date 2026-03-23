/** 운영 BE: admin.necall.com (로컬은 .env.local 로 localhost 지정) */
const API = process.env.NEXT_PUBLIC_LNSMS_API || 'https://admin.necall.com';

/** setid.md 규격 문구 */
export interface PhraseItem {
  uid: string;
  text: string;
  isEnabled: boolean;
  color: string;
  bellCodes: string[];
  autoCloseEnabled?: boolean;
  autoCloseSeconds?: number;
  image?: string | null;
  imageUrl?: string | null;
  makerId?: string | null;
  modelId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** setid.md 규격 시리얼 포트 한 항목 */
export interface SerialPortEntry {
  id: string;
  portName: string;
  baudRate: number;
  autoConnect: boolean;
  secureEnabled?: boolean;
  deviceSerialNumber?: string;
}

/** setid 설정 페이로드 (DB·로컬 1:1, setid.md 2.1) */
export interface SetConfig {
  setid?: string;
  phrases: PhraseItem[];
  serial: { ports: SerialPortEntry[] };
}

export async function getUsers() {
  const res = await fetch(`${API}/api/users`);
  if (!res.ok) throw new Error('Users fetch failed');
  return res.json();
}

export async function getStores(userid?: string) {
  const url = userid ? `${API}/api/store?userid=${encodeURIComponent(userid)}` : `${API}/api/store`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Stores fetch failed');
  return res.json();
}

/** 세트 목록. userid 있으면 해당 유저 종속 세트만 */
export async function getSets(userid?: string) {
  const url = userid ? `${API}/api/sets?userid=${encodeURIComponent(userid)}` : `${API}/api/sets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Sets fetch failed');
  return res.json();
}

export async function getSetConfig(setid: string) {
  const res = await fetch(`${API}/api/sets/${encodeURIComponent(setid)}/config`);
  if (!res.ok) throw new Error('Set config fetch failed');
  return res.json();
}

export async function saveSetConfig(setid: string, config: SetConfig | { phrases: unknown[]; serial: { ports: unknown[] } }) {
  const res = await fetch(`${API}/api/sets/${encodeURIComponent(setid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Save failed');
  }
}

/** 세트 생성 (userid 종속) */
export async function createSet(setid: string, userid: string) {
  const res = await fetch(`${API}/api/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setid, userid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Create failed');
  }
}

export async function deleteSet(setid: string) {
  const res = await fetch(`${API}/api/sets/${encodeURIComponent(setid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
}

export async function createUser(userid: string, userpw: string) {
  const res = await fetch(`${API}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, userpw }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Create user failed');
  }
}

export async function deleteUser(userid: string) {
  const res = await fetch(`${API}/api/users/${encodeURIComponent(userid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete user failed');
}

export async function createStore(storeid: string, userid?: string) {
  const res = await fetch(`${API}/api/store`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeid, userid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Create store failed');
  }
}

export async function deleteStore(storeid: string) {
  const res = await fetch(`${API}/api/store/${encodeURIComponent(storeid)}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete store failed');
}

/** 단일 매장 조회 (세트ID 내려받기용, setids 포함) */
export async function getStore(storeid: string) {
  const res = await fetch(`${API}/api/store/${encodeURIComponent(storeid)}`);
  if (!res.ok) throw new Error('Store fetch failed');
  return res.json();
}

/** 매장에 연결된 세트ID 목록 갱신 */
export async function updateStoreSetids(storeid: string, setids: string[]) {
  const res = await fetch(`${API}/api/store/${encodeURIComponent(storeid)}/setids`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setids }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Update setids failed');
  }
}

/** 서버 브로드캐스트: bellCode로 모든 등록 Agent에 RX 전파 */
export async function broadcast(bellCode: string) {
  const res = await fetch(`${API}/api/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bellCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || 'Broadcast failed');
  }
}
