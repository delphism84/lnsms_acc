import { auth } from './auth';
import { hostAuth } from './hostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID } from './storeScopePaths';

export type StoreChangedEvent = {
  entity: string;
  action: string;
  id?: string;
};

export type StoreWsHandlers = {
  onChanged?: (evt: StoreChangedEvent) => void;
  onUploadDone?: (payload: Record<string, unknown>) => void;
};

function wsBaseUrl(): string {
  const explicit = (process.env.NEXT_PUBLIC_WS_URL || '').trim();
  if (explicit) return explicit.replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const { hostname } = window.location;
    if (window.location.protocol === 'https:') return `${proto}//${hostname}/ws`;
    return `${proto}//${hostname}:40000/ws`;
  }
  return 'ws://127.0.0.1:40000/ws';
}

export function isLocalHostStore(userid: string, storeId: string) {
  return userid === LOCAL_USERID && storeId === LOCAL_STORE_ID;
}

function wsToken(): string | null {
  return hostAuth.getAccessToken() || auth.getToken();
}

class StoreWsClient {
  private ws: WebSocket | null = null;
  private scopeKey: string | null = null;
  private handlers = new Set<StoreWsHandlers>();
  private refCount = 0;
  private reconnectMs = 2000;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closedByUser = false;

  subscribe(userid: string, storeId: string, handlers: StoreWsHandlers) {
    if (isLocalHostStore(userid, storeId)) {
      return () => {};
    }

    this.handlers.add(handlers);
    this.refCount += 1;
    void this.ensureConnected(userid, storeId);

    return () => {
      this.handlers.delete(handlers);
      this.refCount = Math.max(0, this.refCount - 1);
      if (this.refCount === 0) this.disconnect();
    };
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private scheduleReconnect(userid: string, storeId: string) {
    if (this.closedByUser || this.refCount === 0) return;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      void this.ensureConnected(userid, storeId);
    }, this.reconnectMs);
  }

  private disconnect() {
    this.closedByUser = true;
    this.clearReconnect();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.scopeKey = null;
    this.closedByUser = false;
  }

  private async ensureConnected(userid: string, storeId: string) {
    const token = wsToken();
    if (!token || this.refCount === 0) return;

    const key = `${userid}.${storeId}`;
    if (this.ws && this.scopeKey === key && this.ws.readyState === WebSocket.OPEN) return;

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.scopeKey = key;
    const topic = `lnsms.store.${userid}.${storeId}.>`;

    try {
      const ws = new WebSocket(`${wsBaseUrl()}`);
      this.ws = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ v: 1, tag: 'REQ.hello', msg: { token } }));
      };

      ws.onmessage = (ev) => {
        let parsed: { tag?: string; msg?: Record<string, unknown> };
        try {
          parsed = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        const tag = String(parsed.tag || '');
        const msg = parsed.msg || {};

        if (tag === 'REP.hello') {
          ws.send(JSON.stringify({ v: 1, tag: 'REQ.listen', msg: { topics: [topic] } }));
          return;
        }

        if (tag === 'EVT.changed') {
          const evt: StoreChangedEvent = {
            entity: String(msg.entity || ''),
            action: String(msg.action || ''),
            id: msg.id != null ? String(msg.id) : undefined,
          };
          for (const h of this.handlers) h.onChanged?.(evt);
          return;
        }

        if (tag === 'EVT.upload.done') {
          for (const h of this.handlers) h.onUploadDone?.(msg);
        }
      };

      ws.onclose = () => {
        if (this.ws === ws) this.ws = null;
        this.scheduleReconnect(userid, storeId);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      this.scheduleReconnect(userid, storeId);
    }
  }
}

export const storeWsClient = new StoreWsClient();
