'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { Store } from '@/src/lib/types';
import { platformApi } from '@/src/lib/platformApi';
import { createStoreApi } from '@/src/lib/storeApiScoped';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { storeSiteBase, storeSiteSetting } from '@/src/lib/storeScopePaths';
import {
  faSitemap,
  faUserTie,
  faStore,
  faTv,
  faMicrochip,
  faBell,
  faChevronDown,
  faChevronRight,
  faWrench,
  faGear,
  faKey,
  faEllipsis,
  faTrash,
} from '@fortawesome/free-solid-svg-icons';

type AgentNode = { agentId: string };
type StoreNode = Pick<Store, '_id' | 'name' | 'agentid' | 'userid' | 'agentId' | 'storeId'>;
type ApiAgent = { agentId?: string; agentid?: string };

type DeviceCategory = 'localserver' | 'did' | 'kds' | 'callbell' | 'etc';
type StoreDeviceNode = { _id: string; deviceId?: string; eqid?: string; category?: DeviceCategory };

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export default function Sidebar() {
  const pathname = usePathname();

  const isLogin = pathname === '/login';
  const [open, setOpen] = useState<Record<string, boolean>>({
    agents: true,
  });

  const [agents, setAgents] = useState<AgentNode[]>([]);
  const [storesByAgent, setStoresByAgent] = useState<Record<string, StoreNode[]>>({});
  const [devicesByStore, setDevicesByStore] = useState<Record<string, StoreDeviceNode[]>>({});
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [loadingStores, setLoadingStores] = useState<Record<string, boolean>>({});
  const [loadingDevices, setLoadingDevices] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  // ===== Agent edit modal =====
  const defaultAgentForm = useMemo(
    () => ({
      name: '',
      description: '',
      manager: { name: '', phone: '', email: '' },
      contact: {
        phoneMain: '',
        phoneAlt: '',
        fax: '',
        emailMain: '',
        emailAlt: '',
        website: '',
        kakaoChannel: '',
        instagram: '',
        facebook: '',
        naverPlace: '',
        naverBlog: '',
        youtube: '',
      },
      location: {
        address1: '',
        address2: '',
        postalCode: '',
        city: '',
        region: '',
        country: 'KR',
        floor: '',
        unit: '',
        directions: '',
        parkingInfo: '',
        mapUrl: '',
        imageUrl: '',
        lat: null as number | null,
        lng: null as number | null,
      },
      business: {
        legalName: '',
        brandName: '',
        ceoName: '',
        bizNo: '',
        bizType: '',
        bizItem: '',
        openingDate: '',
      },
      operations: {
        timezone: 'Asia/Seoul',
        hoursText: '',
        breakTimeText: '',
        lastOrderText: '',
        holidayText: '',
      },
      services: {
        supportHoursText: '',
        supportChannelText: '',
      },
      billing: {
        taxEmail: '',
        invoiceName: '',
        invoicePhone: '',
        invoiceAddress1: '',
        invoiceAddress2: '',
        bankName: '',
        bankAccount: '',
        bankHolder: '',
        vatIncluded: true,
        serviceChargePct: 0,
        currency: 'KRW',
      },
      branding: {
        logoUrl: '',
        coverImageUrl: '',
        interiorImageUrls: [] as string[],
        themeColor: '',
        notice: '',
      },
      integration: {
        memo: '',
      },
      status: {
        active: true,
        suspended: false,
        suspendReason: '',
      },
      tags: [] as string[],
      memoInternal: '',
    }),
    []
  );

  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showAgentPasswordModal, setShowAgentPasswordModal] = useState(false);
  const [agentEditingId, setAgentEditingId] = useState<string | null>(null);
  const [agentForm, setAgentForm] = useState(defaultAgentForm);
  const [agentPw, setAgentPw] = useState('');
  const [agentModalLoading, setAgentModalLoading] = useState(false);
  const [agentModalSaving, setAgentModalSaving] = useState(false);
  const [agentModalError, setAgentModalError] = useState<string | null>(null);

  const openAgentEditor = async (agentId: string) => {
    setAgentEditingId(agentId);
    setAgentForm({ ...defaultAgentForm, name: agentId, description: `업체 ${agentId}` });
    setShowAgentModal(true);
    setAgentModalError(null);
    setAgentModalLoading(false);
  };

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowAgentModal(false);
  };

  const handleAgentPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowAgentPasswordModal(false);
    setAgentPw('');
  };

  const fetchAgents = async () => {
    setLoadingAgents(true);
    setError(null);
    try {
      const data = (await platformApi.listAgents()) as ApiAgent[];
      const normalized = (data || [])
        .map((a) => ({ agentId: a.agentId || a.agentid }))
        .filter((a): a is AgentNode => !!a.agentId);
      normalized.sort((a: any, b: any) => String(a.agentId).localeCompare(String(b.agentId)));
      setAgents(normalized);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '에이전트 목록을 불러올 수 없습니다.';
      setError(msg);
    } finally {
      setLoadingAgents(false);
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    const ok = window.confirm(
      `업체 "${agentId}" 의 모든 매장을 삭제할까요?`
    );
    if (!ok) return;
    try {
      setError(null);
      const stores = await platformApi.listStoresByUser(agentId);
      for (const s of stores) await platformApi.deleteStore(s._id);
      setStoresByAgent({});
      setDevicesByStore({});
      await fetchAgents();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '삭제에 실패했습니다.');
    }
  };

  const handleDeleteStore = async (agentId: string, store: StoreNode) => {
    const sid = String(store.storeId || store.userid || '').trim();
    const ok = window.confirm(
      `매장 "${sid}" 를 삭제할까요?\n\n주의: 해당 매장의 카테고리/메뉴/장치(EQID)까지 모두 삭제됩니다.`
    );
    if (!ok) return;
    try {
      setError(null);
      await platformApi.deleteStore(store._id);
      setStoresByAgent((s) => ({
        ...s,
        [agentId]: (s[agentId] || []).filter((x) => x._id !== store._id),
      }));
      setDevicesByStore((s) => {
        const next = { ...s };
        delete next[store._id];
        return next;
      });
      setOpen((o) => {
        const next: Record<string, boolean> = { ...o };
        delete next[`store:${store._id}`];
        // 카테고리 열림 상태도 정리
        delete next[`storeCat:${store._id}:localserver`];
        delete next[`storeCat:${store._id}:did`];
        delete next[`storeCat:${store._id}:kds`];
        delete next[`storeCat:${store._id}:callbell`];
        delete next[`storeCat:${store._id}:etc`];
        return next;
      });
    } catch (e: any) {
      setError(e?.message || 'Store 삭제에 실패했습니다.');
    }
  };

  const handleDeleteDevice = async (agentId: string, storeId: string, storeRef: string, deviceId: string, eqidId: string) => {
    const ok = window.confirm(`장치 "${deviceId}" 를 삭제할까요?`);
    if (!ok) return;
    try {
      setError(null);
      await createStoreApi(agentId, storeId).deleteEqid(eqidId);
      setDevicesByStore((s) => ({
        ...s,
        [storeRef]: (s[storeRef] || []).filter((d) => d._id !== eqidId),
      }));
    } catch (e: any) {
      setError(e?.message || 'EQID 삭제에 실패했습니다.');
    }
  };

  const handleDeleteDeviceCategory = async (
    agentId: string,
    storeId: string,
    storeRef: string,
    category: DeviceCategory,
    label: string,
    count: number
  ) => {
    const ok = window.confirm(`"${label}" 카테고리의 장치 ${count}개를 모두 삭제할까요?`);
    if (!ok) return;
    try {
      setError(null);
      await createStoreApi(agentId, storeId).deleteEqidsByCategory(category);
      setDevicesByStore((s) => ({
        ...s,
        [storeRef]: (s[storeRef] || []).filter((d) => (d.category || 'etc') !== category),
      }));
    } catch (e: any) {
      setError(e?.message || '카테고리 장치 삭제에 실패했습니다.');
    }
  };

  useEffect(() => {
    if (isLogin) return;
    void fetchAgents();
  }, [isLogin]);

  const ensureStoresLoaded = async (agentId: string) => {
    if (storesByAgent[agentId]) return;
    try {
      setLoadingStores((s) => ({ ...s, [agentId]: true }));
      const stores = (await platformApi.listStoresByAgent(agentId)) as StoreNode[];
      setStoresByAgent((s) => ({ ...s, [agentId]: stores }));
    } finally {
      setLoadingStores((s) => ({ ...s, [agentId]: false }));
    }
  };

  const ensureDevicesLoaded = async (storeRef: string, agentId: string, storeId: string) => {
    if (devicesByStore[storeRef]) return;
    try {
      setLoadingDevices((s) => ({ ...s, [storeRef]: true }));
      const ds = (await createStoreApi(agentId, storeId).listEqids()) as StoreDeviceNode[];
      setDevicesByStore((s) => ({ ...s, [storeRef]: ds as StoreDeviceNode[] }));
    } finally {
      setLoadingDevices((s) => ({ ...s, [storeRef]: false }));
    }
  };

  if (isLogin) return null;

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  // ===== Tree UI helpers =====
  // depth: 1=agent, 2=store, 3=category-under-store, 4=device-under-category
  const Row = ({
    depth,
    icon,
    label,
    right,
    onClick,
    href,
    active,
    subtle,
    title,
    baseIndentPx,
  }: {
    depth: 1 | 2 | 3 | 4;
    icon: IconDefinition;
    label: React.ReactNode;
    right?: React.ReactNode;
    onClick?: () => void;
    href?: string;
    active?: boolean;
    subtle?: boolean;
    title?: string;
    baseIndentPx?: number;
  }) => {
    const base = cls(
      'group w-full flex items-center justify-between gap-2 text-left',
      // row box border / outline 제거 + 어두운 배경으로 row 구분
      // 폰트: 기본 9pt, 헤더(에이전트 depth=1)만 10pt
      depth === 1 ? 'text-[10pt]' : 'text-[9pt]',
      'px-2 py-2 transition-colors',
      'focus:outline-none focus-visible:outline-none focus-visible:ring-0',
      subtle ? 'bg-gray-950/15' : 'bg-gray-950/30',
      'hover:bg-gray-900/45 focus-visible:bg-gray-900/55',
      active && 'bg-blue-600/20 text-blue-100'
    );

    const showConnector = (baseIndentPx || 0) > 0 || depth > 1;
    const content = (
      <>
        <span className="flex items-center gap-2 min-w-0">
          {showConnector ? <span aria-hidden className="shrink-0 w-3 h-px bg-gray-800/60" /> : null}
          <span
            className={cls(
              'shrink-0',
              depth === 1 ? 'text-gray-100' : depth === 2 ? 'text-gray-300' : depth === 3 ? 'text-gray-600' : 'text-gray-700'
            )}
          >
            <FontAwesomeIcon icon={icon} />
          </span>
          <span className={cls('truncate', depth === 1 ? 'text-gray-100' : depth === 2 ? 'text-gray-100/90' : 'text-gray-200/80')}>
            {label}
          </span>
        </span>
        {right ? <span className="shrink-0 text-gray-400 group-hover:text-gray-200">{right}</span> : null}
      </>
    );

    const wrapStyle: React.CSSProperties = {
      // 인덴트가 커서 가로 잘림 → 절반으로 축소
      paddingLeft: (baseIndentPx || 0) + (depth === 1 ? 0 : depth === 2 ? 7 : depth === 3 ? 14 : 21),
    };

    if (href) {
      return (
        <div style={wrapStyle}>
          <Link href={href} className={base} title={title}>
            {content}
          </Link>
        </div>
      );
    }

    return (
      <div style={wrapStyle}>
        <button type="button" onClick={onClick} className={base} title={title}>
          {content}
        </button>
      </div>
    );
  };

  const SectionLabel = ({
    depth,
    icon,
    label,
    right,
    baseIndentPx,
  }: {
    depth: 2 | 3;
    icon: IconDefinition;
    label: React.ReactNode;
    right?: React.ReactNode;
    baseIndentPx?: number;
  }) => {
    const showConnector = (baseIndentPx || 0) > 0 || depth > 2;
    return (
      <div style={{ paddingLeft: (baseIndentPx || 0) + (depth === 2 ? 7 : 14) }}>
        <div className="flex items-center justify-between gap-2 px-2 pt-2 pb-1">
          <div className="flex items-center gap-2 text-[10pt] font-semibold tracking-wide text-gray-400">
            {showConnector ? <span aria-hidden className="shrink-0 w-3 h-px bg-gray-800/50" /> : null}
            <span className="text-gray-500">
              <FontAwesomeIcon icon={icon} />
            </span>
            <span>{label}</span>
          </div>
          {right ? <div className="text-[10pt] text-gray-400">{right}</div> : null}
        </div>
      </div>
    );
  };

  return (
    <>
      <aside className="w-72 shrink-0 border-r border-gray-900 bg-gray-950/40">
        <div className="p-4">
          <nav className="space-y-3">
          <div>
            <button
              type="button"
              onClick={() => setOpen((s) => ({ ...s, agents: !s.agents }))}
              className="w-full flex items-center justify-between gap-2 bg-gray-950/75 px-3 py-2 text-left text-[10pt] font-semibold text-gray-100 hover:bg-gray-950/90 focus:outline-none focus-visible:outline-none focus-visible:ring-0"
            >
              <span className="flex items-center gap-2">
                <span className="text-gray-300">
                  <FontAwesomeIcon icon={faSitemap} />
                </span>
                <span>에이전트</span>
              </span>
              <span className="text-gray-400">
                <FontAwesomeIcon icon={open.agents ? faChevronDown : faChevronRight} />
              </span>
            </button>

            {open.agents && (
              <div className="mt-2 space-y-2 pl-[6px]">

                {error && <div className="px-3 py-2 text-xs text-red-300">{error}</div>}
                {loadingAgents && <div className="px-3 py-2 text-xs text-gray-400">로딩 중...</div>}

                {!loadingAgents &&
                  agents.map((a) => {
                    const agentId = a.agentId;
                    const agentOpenKey = `agent:${agentId}`;
                    const agentOpen = !!open[agentOpenKey];
                    const stores = storesByAgent[agentId] || [];
                    return (
                      <div key={agentId} className="space-y-1">
                        <div className="divide-y divide-gray-900/45">
                          <Row
                            depth={1}
                            icon={faUserTie}
                            label={agentId}
                            title={agentId}
                            baseIndentPx={6}
                            onClick={async () => {
                              setOpen((s) => ({ ...s, [agentOpenKey]: !s[agentOpenKey] }));
                              if (!agentOpen) {
                                await ensureStoresLoaded(agentId);
                              }
                            }}
                            right={
                              <span className="inline-flex items-center gap-2">
                                <span
                                  role="button"
                                  tabIndex={0}
                                  title="에이전트 삭제"
                                  className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-900/50 text-gray-400 hover:text-red-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDeleteAgent(agentId);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void handleDeleteAgent(agentId);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faTrash} />
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  title="에이전트 설정"
                                  className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-900/50 text-gray-400 hover:text-gray-200"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void openAgentEditor(agentId);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      void openAgentEditor(agentId);
                                    }
                                  }}
                                >
                                  <FontAwesomeIcon icon={faGear} />
                                </span>
                                <FontAwesomeIcon icon={agentOpen ? faChevronDown : faChevronRight} />
                              </span>
                            }
                          />
                        </div>

                        {agentOpen && (
                          <div className="ml-[6px] pl-[6px] space-y-1">
                            <SectionLabel
                              depth={2}
                              icon={faStore}
                              baseIndentPx={6}
                              label={
                                <span className="flex items-center gap-2">
                                  <span>매장</span>
                                  <span className="text-gray-600 font-normal">({stores.length})</span>
                                </span>
                              }
                              right={<Link href="/platform" className="text-blue-300 hover:text-blue-200" title="Platform 매장 관리">관리</Link>}
                            />

                            {/* 매장 하위 인덴트 */}
                            <div className="ml-[6px] pl-[6px]">
                              {loadingStores[agentId] && <div className="px-3 py-2 text-xs text-gray-400">로딩 중...</div>}
                              {!loadingStores[agentId] && stores.length === 0 && (
                                <div className="px-3 py-2 text-xs text-gray-500">등록된 매장이 없습니다.</div>
                              )}

                              <div className="space-y-2">
                                {!loadingStores[agentId] &&
                                  stores.map((s) => {
                                    const sid = s.storeId || s.userid;
                                    const storeOpenKey = `store:${s._id}`;
                                    const storeOpen = !!open[storeOpenKey];
                                    const storeSettingHref = storeSiteSetting(agentId, String(sid));
                                    const storeSiteBasePath = storeSiteBase(agentId, String(sid));
                                    const qs = `agentid=${encodeURIComponent(agentId)}&userid=${encodeURIComponent(String(sid))}&storeRef=${encodeURIComponent(s._id)}`;
                                    return (
                                      <div key={s._id} className="space-y-1">
                                        <div className="space-y-[1px] bg-gray-900/25 p-[1px]">
                                          <Row
                                            depth={2}
                                            icon={faStore}
                                            baseIndentPx={6}
                                            label={
                                              <span className="flex items-center gap-2 min-w-0">
                                                <span className="truncate">{sid}</span>
                                                {s.name ? <span className="text-xs text-gray-500 truncate">· {s.name}</span> : null}
                                              </span>
                                            }
                                            title={`${sid}${s.name ? ` · ${s.name}` : ''}`}
                                            onClick={async () => {
                                              setOpen((o) => ({ ...o, [storeOpenKey]: !o[storeOpenKey] }));
                                              if (!storeOpen) {
                                                await ensureDevicesLoaded(s._id, agentId, String(sid));
                                              }
                                            }}
                                            right={
                                              <span className="inline-flex items-center gap-2">
                                                <span
                                                  role="button"
                                                  tabIndex={0}
                                                  title="매장 삭제"
                                                  className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-900/50 text-gray-400 hover:text-red-200"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    void handleDeleteStore(agentId, s);
                                                  }}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                      e.preventDefault();
                                                      e.stopPropagation();
                                                      void handleDeleteStore(agentId, s);
                                                    }
                                                  }}
                                                >
                                                  <FontAwesomeIcon icon={faTrash} />
                                                </span>
                                                <FontAwesomeIcon icon={storeOpen ? faChevronDown : faChevronRight} />
                                              </span>
                                            }
                                          />
                                        </div>

                                        {storeOpen && (
                                          <div className="ml-[6px] pl-[6px] space-y-1">
                                            <div className="space-y-[1px] bg-gray-900/20 p-[1px]">
                                              <Row
                                                depth={3}
                                                icon={faStore}
                                                href={storeSettingHref}
                                                title="Store 관리"
                                                subtle
                                                baseIndentPx={6}
                                                label="Store관리"
                                              />
                                            </div>

                                            {/* 5개 카테고리 노드 + 하위 Device */}
                                            <div className="space-y-1 pt-1">
                                              {(() => {
                                                const all = devicesByStore[s._id] || [];
                                                const allowed: DeviceCategory[] = ['localserver', 'did', 'kds', 'callbell', 'etc'];
                                                const groups: Record<DeviceCategory, StoreDeviceNode[]> = {
                                                  localserver: [],
                                                  did: [],
                                                  kds: [],
                                                  callbell: [],
                                                  etc: [],
                                                };
                                                for (const d of all) {
                                                  const raw = (d as any).category as DeviceCategory | undefined;
                                                  const cat: DeviceCategory = allowed.includes(raw as any) ? (raw as any) : 'etc';
                                                  groups[cat].push(d);
                                                }
                                                for (const k of allowed) {
                                                  groups[k].sort((a, b) => String(a.deviceId || a.eqid || '').localeCompare(String(b.deviceId || b.eqid || '')));
                                                }

                                                const catMeta: Array<{
                                                  key: DeviceCategory;
                                                  label: string;
                                                  icon: IconDefinition;
                                                  href: string;
                                                }> = [
                                                  {
                                                    key: 'localserver',
                                                    label: '로컬서버PC',
                                                    icon: faWrench,
                                                    href: `${storeSiteBasePath}/device/localserver?${qs}`,
                                                  },
                                                  {
                                                    key: 'did',
                                                    label: 'DID',
                                                    icon: faTv,
                                                    href: `${storeSiteBasePath}/device/did?${qs}`,
                                                  },
                                                  {
                                                    key: 'kds',
                                                    label: 'KDS',
                                                    icon: faMicrochip,
                                                    href: `${storeSiteBasePath}/device/kds?${qs}`,
                                                  },
                                                  {
                                                    key: 'callbell',
                                                    label: '호출벨',
                                                    icon: faBell,
                                                    href: `${storeSiteBasePath}/device/callbell?${qs}`,
                                                  },
                                                  {
                                                    key: 'etc',
                                                    label: '기타',
                                                    icon: faEllipsis,
                                                    href: `${storeSiteBasePath}/device/etc?${qs}`,
                                                  },
                                                ];

                                                return catMeta.map((m) => {
                                                  const openKey = `storeCat:${s._id}:${m.key}`;
                                                  const catOpen = !!open[openKey];
                                                  const count = groups[m.key].length;
                                                  const rightLink = (
                                                    <Link
                                                      href={m.href}
                                                      className="text-blue-300 hover:text-blue-200 text-[9pt]"
                                                      onClick={(e) => e.stopPropagation()}
                                                    >
                                                      열기
                                                    </Link>
                                                  );
                                                  return (
                                                    <div key={m.key} className="space-y-1">
                                                      <Row
                                                        depth={3}
                                                        icon={m.icon}
                                                        baseIndentPx={6}
                                                        subtle
                                                        label={
                                                          <span className="flex items-center gap-2 min-w-0">
                                                            <span className="truncate">{m.label}</span>
                                                            <span className="text-xs text-gray-600 font-normal">({count})</span>
                                                          </span>
                                                        }
                                                        title={m.label}
                                                        onClick={() => setOpen((o) => ({ ...o, [openKey]: !o[openKey] }))}
                                                        right={
                                                          <span className="inline-flex items-center gap-2">
                                                            <span
                                                              role="button"
                                                              tabIndex={0}
                                                              title={`${m.label} 전체 삭제`}
                                                              className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-900/50 text-gray-400 hover:text-red-200"
                                                              onClick={(e) => {
                                                                e.stopPropagation();
                                                                void handleDeleteDeviceCategory(agentId, String(sid), s._id, m.key, m.label, count);
                                                              }}
                                                              onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                  e.preventDefault();
                                                                  e.stopPropagation();
                                                                  void handleDeleteDeviceCategory(agentId, String(sid), s._id, m.key, m.label, count);
                                                                }
                                                              }}
                                                            >
                                                              <FontAwesomeIcon icon={faTrash} />
                                                            </span>
                                                            {rightLink}
                                                            <FontAwesomeIcon icon={catOpen ? faChevronDown : faChevronRight} />
                                                          </span>
                                                        }
                                                      />
                                                      {catOpen && (
                                                        <div className="space-y-[1px] bg-gray-900/10 p-[1px]">
                                                          {loadingDevices[s._id] && (
                                                            <div className="px-3 py-2 text-xs text-gray-400">로딩 중...</div>
                                                          )}
                                                          {!loadingDevices[s._id] && groups[m.key].length === 0 && (
                                                            <div className="px-3 py-2 text-xs text-gray-500">등록된 장치가 없습니다.</div>
                                                          )}
                                                          {!loadingDevices[s._id] &&
                                                            groups[m.key].map((d) => {
                                                              const did = d.deviceId || d.eqid || '';
                                                              const href = `${m.href}&deviceId=${encodeURIComponent(String(did))}`;
                                                              return (
                                                                <Row
                                                                  key={d._id}
                                                                  depth={4}
                                                                  icon={faMicrochip}
                                                                  baseIndentPx={6}
                                                                  subtle
                                                                  href={href}
                                                                  title={did}
                                                                  label={<span className="truncate">{did}</span>}
                                                                  right={
                                                                    <span
                                                                      role="button"
                                                                      tabIndex={0}
                                                                      title="장치 삭제"
                                                                      className="inline-flex items-center justify-center w-6 h-6 rounded hover:bg-gray-900/50 text-gray-400 hover:text-red-200"
                                                                      onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        void handleDeleteDevice(agentId, String(sid), s._id, String(did), d._id);
                                                                      }}
                                                                      onKeyDown={(e) => {
                                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                                          e.preventDefault();
                                                                          e.stopPropagation();
                                                                          void handleDeleteDevice(agentId, String(sid), s._id, String(did), d._id);
                                                                        }
                                                                      }}
                                                                    >
                                                                      <FontAwesomeIcon icon={faTrash} />
                                                                    </span>
                                                                  }
                                                                />
                                                              );
                                                            })}
                                                        </div>
                                                      )}
                                                    </div>
                                                  );
                                                });
                                              })()}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          </nav>
        </div>
      </aside>

      {/* 에이전트 수정 모달 */}
      {showAgentModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-6"
          onClick={() => setShowAgentModal(false)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-[95vw] sm:w-full max-w-4xl border border-gray-700 max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700 flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-white">에이전트 정보 수정</div>
                <div className="text-xs text-gray-400">Agent ID: {agentEditingId}</div>
              </div>
              <button
                type="button"
                className="px-3 py-2 text-gray-300 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors text-sm inline-flex items-center gap-2"
                onClick={() => {
                  setAgentModalError(null);
                  setAgentPw('');
                  setShowAgentPasswordModal(true);
                }}
              >
                <FontAwesomeIcon icon={faKey} />
                <span>비번 수정</span>
              </button>
            </div>

            <form onSubmit={handleAgentSubmit} className="flex-1 min-h-0 overflow-y-auto app-scrollbar px-4 sm:px-6 py-4 text-sm">
              {agentModalLoading && <div className="text-gray-400 mb-4">로딩 중...</div>}

              {/* 기본 */}
              <div className="mb-6">
                <div className="text-sm font-semibold text-gray-200 mb-3">기본</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">에이전트명</label>
                    <input
                      type="text"
                      value={agentForm.name}
                      onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="표시명(선택)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">태그(쉼표로 구분)</label>
                    <input
                      type="text"
                      value={(agentForm.tags || []).join(', ')}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          tags: e.target.value
                            .split(',')
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="예: 프랜차이즈, 테스트"
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">설명</label>
                  <textarea
                    value={agentForm.description}
                    onChange={(e) => setAgentForm({ ...agentForm, description: e.target.value })}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4" open>
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">담당자</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이름</label>
                    <input
                      type="text"
                      value={agentForm.manager.name}
                      onChange={(e) => setAgentForm({ ...agentForm, manager: { ...agentForm.manager, name: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">연락처</label>
                    <input
                      type="text"
                      value={agentForm.manager.phone}
                      onChange={(e) => setAgentForm({ ...agentForm, manager: { ...agentForm.manager, phone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이메일</label>
                    <input
                      type="email"
                      value={agentForm.manager.email}
                      onChange={(e) => setAgentForm({ ...agentForm, manager: { ...agentForm.manager, email: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">연락처/채널</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ['대표전화', 'phoneMain'],
                      ['보조전화', 'phoneAlt'],
                      ['팩스', 'fax'],
                      ['대표이메일', 'emailMain'],
                      ['보조이메일', 'emailAlt'],
                      ['웹사이트', 'website'],
                      ['카카오 채널', 'kakaoChannel'],
                      ['인스타그램', 'instagram'],
                      ['페이스북', 'facebook'],
                      ['네이버플레이스', 'naverPlace'],
                      ['네이버블로그', 'naverBlog'],
                      ['유튜브', 'youtube'],
                    ] as const
                  ).map(([label, key]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                      <input
                        type="text"
                        value={(agentForm.contact as any)[key] as string}
                        onChange={(e) => setAgentForm({ ...agentForm, contact: { ...agentForm.contact, [key]: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">위치(본사/사무실)</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">주소</label>
                    <input
                      type="text"
                      value={agentForm.location.address1}
                      onChange={(e) => setAgentForm({ ...agentForm, location: { ...agentForm.location, address1: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">상세주소</label>
                    <input
                      type="text"
                      value={agentForm.location.address2}
                      onChange={(e) => setAgentForm({ ...agentForm, location: { ...agentForm.location, address2: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">지도 URL</label>
                    <input
                      type="text"
                      value={agentForm.location.mapUrl}
                      onChange={(e) => setAgentForm({ ...agentForm, location: { ...agentForm.location, mapUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">이미지 URL</label>
                    <input
                      type="text"
                      value={agentForm.location.imageUrl}
                      onChange={(e) => setAgentForm({ ...agentForm, location: { ...agentForm.location, imageUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3 md:col-span-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">위도(lat)</label>
                      <input
                        type="number"
                        value={agentForm.location.lat ?? ''}
                        onChange={(e) =>
                          setAgentForm({
                            ...agentForm,
                            location: { ...agentForm.location, lat: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">경도(lng)</label>
                      <input
                        type="number"
                        value={agentForm.location.lng ?? ''}
                        onChange={(e) =>
                          setAgentForm({
                            ...agentForm,
                            location: { ...agentForm.location, lng: e.target.value === '' ? null : Number(e.target.value) },
                          })
                        }
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">운영/지원</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">타임존</label>
                    <input
                      type="text"
                      value={agentForm.operations.timezone}
                      onChange={(e) => setAgentForm({ ...agentForm, operations: { ...agentForm.operations, timezone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div />
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">운영시간(자유서술)</label>
                    <textarea
                      value={agentForm.operations.hoursText}
                      onChange={(e) => setAgentForm({ ...agentForm, operations: { ...agentForm.operations, hoursText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">지원 채널(자유서술)</label>
                    <textarea
                      value={agentForm.services.supportChannelText}
                      onChange={(e) => setAgentForm({ ...agentForm, services: { ...agentForm.services, supportChannelText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="예: 카카오/전화/이메일"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">지원 시간(자유서술)</label>
                    <textarea
                      value={agentForm.services.supportHoursText}
                      onChange={(e) => setAgentForm({ ...agentForm, services: { ...agentForm.services, supportHoursText: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                      placeholder="예: 평일 09:00-18:00"
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">브랜딩/노출</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">로고 URL</label>
                    <input
                      type="text"
                      value={agentForm.branding.logoUrl}
                      onChange={(e) => setAgentForm({ ...agentForm, branding: { ...agentForm.branding, logoUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">커버 이미지 URL</label>
                    <input
                      type="text"
                      value={agentForm.branding.coverImageUrl}
                      onChange={(e) => setAgentForm({ ...agentForm, branding: { ...agentForm.branding, coverImageUrl: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">이미지 URL들(줄바꿈)</label>
                    <textarea
                      value={(agentForm.branding.interiorImageUrls || []).join('\n')}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          branding: {
                            ...agentForm.branding,
                            interiorImageUrls: e.target.value
                              .split('\n')
                              .map((x) => x.trim())
                              .filter(Boolean),
                          },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">테마 컬러</label>
                    <input
                      type="text"
                      value={agentForm.branding.themeColor}
                      onChange={(e) => setAgentForm({ ...agentForm, branding: { ...agentForm.branding, themeColor: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">공지(노출 가능)</label>
                    <textarea
                      value={agentForm.branding.notice}
                      onChange={(e) => setAgentForm({ ...agentForm, branding: { ...agentForm.branding, notice: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">사업자/정산</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ['상호(법인/사업자명)', ['business', 'legalName']],
                      ['브랜드/간판명', ['business', 'brandName']],
                      ['대표자명', ['business', 'ceoName']],
                      ['사업자등록번호', ['business', 'bizNo']],
                      ['업태', ['business', 'bizType']],
                      ['종목', ['business', 'bizItem']],
                      ['개업일(YYYY-MM-DD)', ['business', 'openingDate']],
                    ] as const
                  ).map(([label, [, key]]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
                      <input
                        type="text"
                        value={(agentForm.business as any)[key] as string}
                        onChange={(e) => setAgentForm({ ...agentForm, business: { ...agentForm.business, [key]: e.target.value } })}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">세금계산서 이메일</label>
                    <input
                      type="email"
                      value={agentForm.billing.taxEmail}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, taxEmail: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 담당자명</label>
                    <input
                      type="text"
                      value={agentForm.billing.invoiceName}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, invoiceName: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 연락처</label>
                    <input
                      type="text"
                      value={agentForm.billing.invoicePhone}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, invoicePhone: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">은행</label>
                    <input
                      type="text"
                      value={agentForm.billing.bankName}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, bankName: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">계좌번호</label>
                    <input
                      type="text"
                      value={agentForm.billing.bankAccount}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, bankAccount: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">예금주</label>
                    <input
                      type="text"
                      value={agentForm.billing.bankHolder}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, bankHolder: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 주소</label>
                    <input
                      type="text"
                      value={agentForm.billing.invoiceAddress1}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, invoiceAddress1: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">청구 상세주소</label>
                    <input
                      type="text"
                      value={agentForm.billing.invoiceAddress2}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, invoiceAddress2: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-200 md:col-span-3">
                    <input
                      type="checkbox"
                      checked={!!agentForm.billing.vatIncluded}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, vatIncluded: e.target.checked } })}
                    />
                    <span>부가세 포함</span>
                  </label>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">서비스차지(%)</label>
                    <input
                      type="number"
                      value={agentForm.billing.serviceChargePct}
                      onChange={(e) =>
                        setAgentForm({
                          ...agentForm,
                          billing: { ...agentForm.billing, serviceChargePct: Number(e.target.value || 0) },
                        })
                      }
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">통화</label>
                    <input
                      type="text"
                      value={agentForm.billing.currency}
                      onChange={(e) => setAgentForm({ ...agentForm, billing: { ...agentForm.billing, currency: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </details>

              <details className="mb-4 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">연동/내부 메모</summary>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">연동 메모</label>
                    <textarea
                      value={agentForm.integration.memo}
                      onChange={(e) => setAgentForm({ ...agentForm, integration: { ...agentForm.integration, memo: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={2}
                    />
                  </div>
                </div>
              </details>

              <details className="mb-2 rounded-md border border-gray-700 bg-gray-900/20 p-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-200">상태/내부 메모</summary>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!agentForm.status.active}
                      onChange={(e) => setAgentForm({ ...agentForm, status: { ...agentForm.status, active: e.target.checked } })}
                    />
                    <span>활성</span>
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-200">
                    <input
                      type="checkbox"
                      checked={!!agentForm.status.suspended}
                      onChange={(e) => setAgentForm({ ...agentForm, status: { ...agentForm.status, suspended: e.target.checked } })}
                    />
                    <span>정지</span>
                  </label>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">정지 사유</label>
                    <input
                      type="text"
                      value={agentForm.status.suspendReason}
                      onChange={(e) => setAgentForm({ ...agentForm, status: { ...agentForm.status, suspendReason: e.target.value } })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">내부 메모</label>
                    <textarea
                      value={agentForm.memoInternal}
                      onChange={(e) => setAgentForm({ ...agentForm, memoInternal: e.target.value })}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </details>

              {agentModalError && <div className="bg-red-800 text-white p-3 rounded-md mt-4">{agentModalError}</div>}

              <div className="sticky bottom-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-gray-800 border-t border-gray-700 flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  onClick={() => setShowAgentModal(false)}
                >
                  닫기
                </button>
                <button
                  type="submit"
                  disabled={agentModalSaving}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-60"
                >
                  {agentModalSaving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 에이전트 비밀번호 변경 모달 */}
      {showAgentPasswordModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-[70] flex items-start sm:items-center justify-center overflow-y-auto p-2 sm:p-6"
          onClick={() => setShowAgentPasswordModal(false)}
        >
          <div
            className="bg-gray-800 rounded-lg shadow-xl w-[95vw] sm:w-full max-w-md border border-gray-700 max-h-[92vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-700">
              <div className="text-lg font-semibold text-white">에이전트 비밀번호 변경</div>
              <div className="text-xs text-gray-400">Agent ID: {agentEditingId}</div>
            </div>
            <form onSubmit={handleAgentPasswordSubmit} className="px-4 sm:px-6 py-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">새 비밀번호</label>
              <input
                type="password"
                value={agentPw}
                onChange={(e) => setAgentPw(e.target.value)}
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  onClick={() => setShowAgentPasswordModal(false)}
                >
                  취소
                </button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                  변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

