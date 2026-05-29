import * as tus from 'tus-js-client';
import { openDB } from 'idb';
import { eqidApi, menuApi } from '@/src/lib/api';
import { createStoreApi } from '@/src/lib/storeApiScoped';

export type UploadPurpose = 'eqidResource' | 'menuResource';

export type UploadStatus =
  | 'queued'
  | 'uploading'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'postprocess_failed'
  | 'needs_file_reselect'
  | 'cancelled';

export type UploadTask = {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: UploadStatus;
  progress: number; // 0..1
  bytesUploaded: number;
  bytesTotal: number;
  speedBps?: number;
  error?: string;

  filename: string;
  mimeType: string;
  fileType: 'image' | 'video';
  size: number;

  purpose: UploadPurpose;
  // 목적지 정보는 callback에서 사용
  payload: Record<string, any>;

  // resumable
  uploadUrl?: string;
  tusUploadId?: string;
  fingerprint?: string;
  // File System Access API 핸들 (가능하면 저장)
  fileHandle?: FileSystemFileHandle;
};

type Subscriber = (tasks: UploadTask[]) => void;

const DB_NAME = 'lnsms_admin_uploads';
const DB_VERSION = 1;
const STORE_TASKS = 'tasks';
const STORE_URLS = 'tusUrls';

async function db() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_TASKS)) {
        db.createObjectStore(STORE_TASKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_URLS)) {
        db.createObjectStore(STORE_URLS, { keyPath: 'fingerprint' });
      }
    },
  });
}

function now() {
  return Date.now();
}

function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;
}

function inferFileType(mime: string) {
  return mime.startsWith('image/') ? 'image' : 'video';
}

function canPersistFileHandle() {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

function safeError(e: unknown) {
  return e instanceof Error ? e.message : String(e);
}

function endpointBase() {
  // 동일 오리진(/api...)을 기본으로 사용. (nginx가 /api 를 백엔드로 프록시)
  return '/api/upload/tus';
}

function getTusIdFromUrl(url?: string) {
  if (!url) return undefined;
  try {
    const u = new URL(url, window.location.origin);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1];
  } catch {
    const parts = String(url).split('/').filter(Boolean);
    return parts[parts.length - 1];
  }
}

async function saveTask(t: UploadTask) {
  const d = await db();
  await d.put(STORE_TASKS, t);
}

async function deleteTask(id: string) {
  const d = await db();
  await d.delete(STORE_TASKS, id);
}

async function loadAllTasks(): Promise<UploadTask[]> {
  const d = await db();
  return (await d.getAll(STORE_TASKS)) as UploadTask[];
}

// tus-js-client UrlStorage (fingerprint -> PreviousUpload[])
// - 새로고침 후 이어올리기(Resume) 용도로 사용
const urlStorage: tus.UrlStorage = {
  async findAllUploads() {
    const d = await db();
    const all = (await d.getAll(STORE_URLS)) as any[];
    const out: tus.PreviousUpload[] = [];
    for (const row of all || []) {
      const uploads: tus.PreviousUpload[] = Array.isArray(row.uploads) ? row.uploads : [];
      out.push(...uploads);
    }
    return out;
  },
  async findUploadsByFingerprint(fingerprint: string) {
    const d = await db();
    const row = (await d.get(STORE_URLS, fingerprint)) as any;
    const uploads: tus.PreviousUpload[] = Array.isArray(row?.uploads) ? row.uploads : [];
    return uploads;
  },
  async addUpload(fingerprint: string, upload: tus.PreviousUpload) {
    const d = await db();
    const row = (await d.get(STORE_URLS, fingerprint)) as any;
    const uploads: tus.PreviousUpload[] = Array.isArray(row?.uploads) ? row.uploads : [];
    const urlStorageKey = upload.urlStorageKey || uuid();
    const next: tus.PreviousUpload = { ...upload, urlStorageKey };
    uploads.push(next);
    await d.put(STORE_URLS, { fingerprint, uploads, updatedAt: now() });
    return urlStorageKey;
  },
  async removeUpload(urlStorageKey: string) {
    const d = await db();
    const allKeys = (await d.getAllKeys(STORE_URLS)) as string[];
    for (const fp of allKeys || []) {
      const row = (await d.get(STORE_URLS, fp)) as any;
      const uploads: tus.PreviousUpload[] = Array.isArray(row?.uploads) ? row.uploads : [];
      const next = uploads.filter((u) => u.urlStorageKey !== urlStorageKey);
      if (next.length !== uploads.length) {
        await d.put(STORE_URLS, { fingerprint: fp, uploads: next, updatedAt: now() });
        return;
      }
    }
  },
};

export class UploadManager {
  private tasks: UploadTask[] = [];
  private subs = new Set<Subscriber>();
  private running = new Map<string, tus.Upload>();
  private initialized = false;

  subscribe(fn: Subscriber) {
    this.subs.add(fn);
    fn(this.tasks);
    return () => {
      this.subs.delete(fn);
    };
  }

  getTasks() {
    return this.tasks;
  }

  private emit() {
    for (const s of this.subs) s(this.tasks);
  }

  private upsert(task: UploadTask) {
    const idx = this.tasks.findIndex((t) => t.id === task.id);
    if (idx >= 0) this.tasks[idx] = task;
    else this.tasks.unshift(task);
    this.emit();
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;
    const loaded = await loadAllTasks();
    // 최신순
    loaded.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    this.tasks = loaded;
    this.emit();

    // 복원/자동 재개
    for (const t of this.tasks) {
      if (t.status === 'uploading' || t.status === 'queued' || t.status === 'paused' || t.status === 'needs_file_reselect') {
        // 새로고침 후 자동 재개 시도
        void this.tryResume(t.id);
      }
    }
  }

  async enqueueFromInput(files: FileList, opts: { purpose: UploadPurpose; payload: Record<string, any> }) {
    const arr = Array.from(files);
    for (const f of arr) {
      await this.enqueueFile(f, opts);
    }
  }

  async pickFilesAndEnqueue(opts: { purpose: UploadPurpose; payload: Record<string, any>; multiple?: boolean }) {
    if (!canPersistFileHandle()) throw new Error('브라우저가 File System Access API를 지원하지 않습니다.');
    // @ts-expect-error
    const handles: FileSystemFileHandle[] = await window.showOpenFilePicker({ multiple: !!opts.multiple });
    for (const handle of handles) {
      const file = await handle.getFile();
      const id = await this.enqueueFile(file, opts);
      const t = this.tasks.find((x) => x.id === id);
      if (t) {
        const updated: UploadTask = { ...t, fileHandle: handle, updatedAt: now() };
        this.upsert(updated);
        await saveTask(updated);
      }
    }
  }

  async enqueueFile(file: File, opts: { purpose: UploadPurpose; payload: Record<string, any> }) {
    const task: UploadTask = {
      id: uuid(),
      createdAt: now(),
      updatedAt: now(),
      status: 'queued',
      progress: 0,
      bytesUploaded: 0,
      bytesTotal: file.size,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      fileType: inferFileType(file.type || ''),
      size: file.size,
      purpose: opts.purpose,
      payload: opts.payload,
    };

    // 가능하면 핸들 저장(재선택 없이 복원용)
    if (canPersistFileHandle()) {
      // 사용자가 input으로 선택한 파일에서 handle 얻는 표준 API가 없어,
      // File System Access API로 선택하도록 UI를 별도로 제공해야 합니다.
      // 여기서는 placeholder로 상태만 유지하고, 복원 시 reselect가 필요하도록 둡니다.
      // (실제 handle 저장은 pickFileAndEnqueue 사용)
    }

    this.upsert(task);
    await saveTask(task);
    void this.start(task.id, file);
    return task.id;
  }

  async pickFileAndEnqueue(opts: { purpose: UploadPurpose; payload: Record<string, any> }) {
    if (!canPersistFileHandle()) throw new Error('브라우저가 File System Access API를 지원하지 않습니다.');
    // @ts-expect-error: showOpenFilePicker is not in TS lib by default
    const [handle] = await window.showOpenFilePicker({ multiple: false });
    const file = await handle.getFile();
    const id = await this.enqueueFile(file, opts);
    // task에 handle 저장
    const t = this.tasks.find((x) => x.id === id);
    if (t) {
      const updated: UploadTask = { ...t, fileHandle: handle, updatedAt: now() };
      this.upsert(updated);
      await saveTask(updated);
    }
    return id;
  }

  pause(id: string) {
    const u = this.running.get(id);
    if (u) {
      u.abort(true); // keep state for resuming
      this.running.delete(id);
    }
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    const updated: UploadTask = { ...t, status: 'paused', updatedAt: now() };
    this.upsert(updated);
    void saveTask(updated);
  }

  cancel(id: string) {
    const u = this.running.get(id);
    if (u) {
      u.abort(false);
      this.running.delete(id);
    }
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    const updated: UploadTask = { ...t, status: 'cancelled', updatedAt: now() };
    this.upsert(updated);
    void saveTask(updated);
  }

  async remove(id: string) {
    this.cancel(id);
    this.tasks = this.tasks.filter((t) => t.id !== id);
    this.emit();
    await deleteTask(id);
  }

  async tryResume(id: string) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;

    // 파일 핸들이 있으면 자동 재개, 없으면 상태만 유지
    if (t.fileHandle) {
      try {
        const file = await t.fileHandle.getFile();
        await this.start(id, file);
        return;
      } catch (e) {
        const updated: UploadTask = { ...t, status: 'needs_file_reselect', error: '파일 접근 권한이 없습니다. 다시 선택해주세요.', updatedAt: now() };
        this.upsert(updated);
        await saveTask(updated);
        return;
      }
    }

    // 폴백: 같은 파일을 다시 선택하게 해서 resume (사용자가 UI에서 제공)
    const updated: UploadTask = { ...t, status: 'needs_file_reselect', updatedAt: now() };
    this.upsert(updated);
    await saveTask(updated);
  }

  async reselectAndResume(id: string) {
    if (!canPersistFileHandle()) throw new Error('브라우저가 File System Access API를 지원하지 않습니다.');
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    // @ts-expect-error
    const [handle] = await window.showOpenFilePicker({ multiple: false });
    const file = await handle.getFile();
    const updated: UploadTask = { ...t, fileHandle: handle, filename: file.name, size: file.size, bytesTotal: file.size, updatedAt: now() };
    this.upsert(updated);
    await saveTask(updated);
    await this.start(id, file);
  }

  private async start(id: string, file: File) {
    const t = this.tasks.find((x) => x.id === id);
    if (!t) return;
    if (this.running.has(id)) return;

    const updated0: UploadTask = { ...t, status: 'uploading', error: undefined, updatedAt: now() };
    this.upsert(updated0);
    await saveTask(updated0);

    let lastBytes = 0;
    let lastTs = now();

    const upload = new tus.Upload(file, {
      endpoint: endpointBase(),
      chunkSize: 8 * 1024 * 1024, // 8MB
      retryDelays: [0, 1000, 3000, 5000, 10000],
      metadata: {
        filename: file.name,
        mimetype: file.type || 'application/octet-stream',
      },
      urlStorage,
      onError: async (error) => {
        this.running.delete(id);
        const cur = this.tasks.find((x) => x.id === id);
        if (!cur) return;
        const next: UploadTask = { ...cur, status: 'failed', error: safeError(error), updatedAt: now() };
        this.upsert(next);
        await saveTask(next);
      },
      onProgress: async (bytesUploaded, bytesTotal) => {
        const cur = this.tasks.find((x) => x.id === id);
        if (!cur) return;
        const ts = now();
        const dt = Math.max(1, ts - lastTs);
        const db = bytesUploaded - lastBytes;
        const speedBps = (db * 1000) / dt;
        lastBytes = bytesUploaded;
        lastTs = ts;

        const next: UploadTask = {
          ...cur,
          status: 'uploading',
          bytesUploaded,
          bytesTotal,
          progress: bytesTotal ? bytesUploaded / bytesTotal : 0,
          speedBps,
          updatedAt: now(),
        };
        this.upsert(next);
        await saveTask(next);
      },
      onSuccess: async () => {
        this.running.delete(id);
        const cur = this.tasks.find((x) => x.id === id);
        if (!cur) return;

        const uploadUrl = upload.url || cur.uploadUrl;
        const tusUploadId = getTusIdFromUrl(uploadUrl);
        const next1: UploadTask = { ...cur, uploadUrl, tusUploadId, status: 'completed', progress: 1, bytesUploaded: cur.bytesTotal, updatedAt: now() };
        this.upsert(next1);
        await saveTask(next1);

        try {
          if (!tusUploadId) throw new Error('업로드 ID를 확인할 수 없습니다.');
          const res = await fetch(`/api/upload/tus/${encodeURIComponent(tusUploadId)}/result`);
          if (!res.ok) {
            const msg = await res.text();
            throw new Error(msg || '업로드 결과 조회 실패');
          }
          const uploaded = await res.json();
          await this.postProcess(next1, uploaded);
        } catch (e) {
          const cur2 = this.tasks.find((x) => x.id === id);
          if (!cur2) return;
          const next2: UploadTask = { ...cur2, status: 'postprocess_failed', error: safeError(e), updatedAt: now() };
          this.upsert(next2);
          await saveTask(next2);
        }
      },
    });

    // resume 가능한 업로드가 있으면 이어올리기
    const prev = await upload.findPreviousUploads();
    if (prev && prev.length) {
      upload.resumeFromPreviousUpload(prev[0]);
    }

    this.running.set(id, upload);
    upload.start();
  }

  private async postProcess(task: UploadTask, uploaded: { type: 'image' | 'video'; url: string; filename: string; size: number }) {
    const { agentId, storeId } = task.payload || {};
    const scoped =
      agentId && storeId ? createStoreApi(String(agentId), String(storeId)) : null;

    if (task.purpose === 'eqidResource') {
      const { eqidId, order, displayTime } = task.payload || {};
      if (!eqidId) throw new Error('eqidId 누락');
      const resource = {
        type: uploaded.type,
        url: uploaded.url,
        filename: uploaded.filename,
        size: uploaded.size,
        order: typeof order === 'number' ? order : 0,
        enabled: true,
        displayTime: typeof displayTime === 'number' ? displayTime : 5000,
        fadeInOut: false,
      };
      if (scoped) {
        await scoped.addEqidResource(eqidId, resource);
      } else {
        await eqidApi.addResource(eqidId, resource);
      }
      return;
    }
    if (task.purpose === 'menuResource') {
      const { menuId, order } = task.payload || {};
      if (!menuId) throw new Error('menuId 누락');
      const resource = {
        type: uploaded.type,
        url: uploaded.url,
        filename: uploaded.filename,
        size: uploaded.size,
        order: typeof order === 'number' ? order : 0,
      };
      if (scoped) {
        await scoped.addMenuResource(menuId, resource);
      } else {
        await menuApi.addResource(menuId, resource);
      }
      return;
    }
    throw new Error('unknown purpose');
  }
}

export const uploadManager = new UploadManager();

