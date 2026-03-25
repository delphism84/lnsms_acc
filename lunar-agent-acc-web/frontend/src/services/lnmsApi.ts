/**
 * Node LNSMS 백엔드 API - 세트 설정 다운로드/업로드
 *
 * - 로컬 에이전트: 기본은 자체 구동 BE(`http://localhost:60000`). WinForms가 `window.__LNSMS_API__`로 주입(app.json `LnsmsApiBase`).
 * - 운영(클라우드): WebView에서 `admin.necall.com` 직접 fetch 시 CORS로 실패하므로,
 *   에이전트 로컬 API `.../api/lnsms-remote/*` 로 프록시한다(C# → `LnsmsRemoteUploadBase`).
 */
import { getApiBaseUrl } from './api';

const LNSMS_LOCAL_DEFAULT = 'http://localhost:60000';

function getLnmsBase(): string {
  if (typeof window !== 'undefined') {
    const injected = (window as unknown as { __LNSMS_API__?: string }).__LNSMS_API__;
    if (injected) return injected;
  }
  const fromVite = import.meta.env.VITE_LNSMS_API;
  if (fromVite) return fromVite;
  return LNSMS_LOCAL_DEFAULT;
}

/** 브라우저/WebView: 로컬 에이전트가 원격(admin)으로 프록시하는 베이스 URL */
async function getLnmsRemoteProxyBase(): Promise<string> {
  const api = await getApiBaseUrl();
  return `${api.replace(/\/$/, '')}/api/lnsms-remote`;
}

export interface SetItem {
  setid: string;
  userid?: string;
  updatedAt?: string;
}

/** setid 설정 페이로드 (DB·로컬 1:1, setid.md 2.1) */
export interface SetConfig {
  setid: string;
  phrases: unknown[];
  serial: { ports: unknown[] };
  remoteControl?: { buttons: unknown[] };
}

export interface StoreInfo {
  storeid: string;
  userid?: string;
  setids: string[];
}

export async function lnmsLogin(userid: string, userpw: string, opts?: { useRemote?: boolean }): Promise<{ success: boolean; userid?: string }> {
  const base = opts?.useRemote === false ? getLnmsBase() : await getLnmsRemoteProxyBase();
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userid, userpw }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { success: false };
  return { success: !!data.success, userid: data.userid };
}

/** 유저 종속 세트 목록. `useRemote`: 업로드 모달에서만 운영 서버 세트 목록 조회 */
export async function lnmsListSets(userid?: string, opts?: { useRemote?: boolean }): Promise<SetItem[]> {
  const base = opts?.useRemote ? await getLnmsRemoteProxyBase() : getLnmsBase();
  const url = userid ? `${base}/sets?userid=${encodeURIComponent(userid)}` : `${base}/sets`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('세트 목록 조회 실패');
  const data = await res.json();
  return Array.isArray(data) ? data : data.sets || [];
}

/** 매장 정보 (세트ID 내려받기용: setids 포함) */
export async function lnmsGetStore(storeid: string): Promise<StoreInfo> {
  const base = await getLnmsRemoteProxyBase();
  const res = await fetch(`${base}/store/${encodeURIComponent(storeid)}`);
  if (!res.ok) throw new Error('매장 조회 실패');
  return res.json();
}

/** 유저 소속 매장 목록 (로그인 후 매장 선택용) */
export async function lnmsGetStores(userid: string): Promise<StoreInfo[]> {
  const base = await getLnmsRemoteProxyBase();
  const res = await fetch(`${base}/store?userid=${encodeURIComponent(userid)}`);
  if (!res.ok) throw new Error('매장 목록 조회 실패');
  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

export async function lnmsGetSetConfig(setid: string, userid?: string): Promise<SetConfig> {
  const base = await getLnmsRemoteProxyBase();
  const url = userid
    ? `${base}/sets/${encodeURIComponent(setid)}/config?userid=${encodeURIComponent(userid)}`
    : `${base}/sets/${encodeURIComponent(setid)}/config`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('세트 설정 조회 실패');
  return res.json();
}

/** 운영 서버로 세트 설정 저장(업로드) */
export async function lnmsSaveSetConfig(
  setid: string,
  config: { phrases: unknown[]; serial: { ports: unknown[] }; remoteControl?: { buttons: unknown[] } },
  userid?: string
): Promise<void> {
  const base = await getLnmsRemoteProxyBase();
  const res = await fetch(`${base}/sets/${encodeURIComponent(setid)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userid ? { ...config, userid } : config),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '세트 저장 실패');
  }
}

/** 운영 서버에 신규 세트 생성(업로드) */
export async function lnmsCreateSet(setid: string, userid: string): Promise<void> {
  const base = await getLnmsRemoteProxyBase();
  const res = await fetch(`${base}/sets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ setid, userid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '세트 생성 실패');
  }
}

/** 서버로 브로드캐스팅: 모든 매장(등록된 Agent)에 RX 전파. setid.md */
export async function lnmsBroadcast(bellCode: string): Promise<void> {
  const res = await fetch(`${getLnmsBase()}/api/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bellCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '브로드캐스트 실패');
  }
}

/** Agent 콜백 등록: 서버가 브로드캐스트 시 이 URL로 RX 시뮬레이션 요청 전송 */
export async function lnmsRegisterAgent(callbackUrl: string, setid?: string, storeid?: string): Promise<void> {
  const res = await fetch(`${getLnmsBase()}/api/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callbackUrl, setid, storeid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || '등록 실패');
  }
}
