export type SiteMode = 'platform' | 'store' | 'local';

const PLATFORM_HOSTS = new Set(['admin.necall.com']);
const STORE_HOSTS = new Set(['necall.com', 'www.necall.com']);
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', 'necall.guest', '[::1]']);

export function normalizeHost(host: string): string {
  return host.split(':')[0].toLowerCase();
}

export function getSiteModeFromHost(host: string): SiteMode {
  const h = normalizeHost(host);
  if (LOCAL_HOSTS.has(h)) return 'local';
  if (STORE_HOSTS.has(h)) return 'store';
  if (PLATFORM_HOSTS.has(h)) return 'platform';
  const def = (process.env.NEXT_PUBLIC_DEFAULT_SITE_MODE || 'platform').trim();
  if (def === 'store') return 'store';
  if (def === 'local') return 'local';
  return 'platform';
}

export function isStoreSiteHost(host: string): boolean {
  return getSiteModeFromHost(host) === 'store';
}

export function isPlatformSiteHost(host: string): boolean {
  return getSiteModeFromHost(host) === 'platform';
}

export function isLocalHostSiteHost(host: string): boolean {
  return getSiteModeFromHost(host) === 'local';
}

export function shouldUseSameOriginApi(host: string): boolean {
  const mode = getSiteModeFromHost(host);
  return mode === 'store' || mode === 'local';
}

export function platformSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_PLATFORM_ORIGIN || 'https://admin.necall.com').replace(/\/$/, '');
}

export function storeSiteOrigin(): string {
  return (process.env.NEXT_PUBLIC_STORE_ORIGIN || 'https://necall.com').replace(/\/$/, '');
}

/** Client-only helpers */
export function getClientSiteMode(): SiteMode {
  if (typeof window === 'undefined') return 'platform';
  return getSiteModeFromHost(window.location.hostname);
}

export function isStoreSite(): boolean {
  return getClientSiteMode() === 'store';
}

export function isLocalHostSite(): boolean {
  return getClientSiteMode() === 'local';
}

export function isPlatformSite(): boolean {
  return getClientSiteMode() === 'platform';
}
