import { shouldUseSameOriginApi } from './siteMode';

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    if (shouldUseSameOriginApi(hostname)) {
      return `${protocol}//${hostname}`.replace(/\/$/, '');
    }
    if (protocol === 'https:') return `${protocol}//${hostname}`.replace(/\/$/, '');
    return `${protocol}//${hostname}:40000`.replace(/\/$/, '');
  }

  const explicit = (process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (explicit) {
    try {
      const u = new URL(explicit);
      if (u.protocol === 'https:' && u.port === '40000') {
        u.port = '';
        return u.toString().replace(/\/$/, '');
      }
    } catch {
      // ignore
    }
    return explicit.replace(/\/$/, '');
  }
  return '';
}

/** @deprecated use getApiUrl() — kept for modules that read at import time on server */
export const API_URL = getApiUrl();
