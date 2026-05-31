'use client';

import '@/app/styles/store-backup-settings.css';
import '@/app/styles/store-backup-theme.css';

export type StoreBackupTab = 'store' | 'sync' | 'device' | 'category' | 'menu';

const TABS: { id: StoreBackupTab; label: string }[] = [
  { id: 'store', label: '매장 정보' },
  { id: 'sync', label: '서버 동기화' },
  { id: 'device', label: '기기 관리' },
  { id: 'category', label: '카테고리' },
  { id: 'menu', label: '메뉴' },
];

type Props = {
  activeTab: StoreBackupTab;
  onTabChange: (tab: StoreBackupTab) => void;
  showPlatformBack?: boolean;
  platformBackHref?: string;
  children: (tab: StoreBackupTab) => React.ReactNode;
};

export default function StoreBackupShell({
  activeTab,
  onTabChange,
  showPlatformBack = false,
  platformBackHref,
  children,
}: Props) {
  return (
    <div className="settings-view store-backup-theme">
      <div className="settings-header">
        {showPlatformBack && platformBackHref ? (
          <a className="back-button" href={platformBackHref} title="매장 목록">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        ) : (
          <span className="back-button" style={{ visibility: 'hidden' }} aria-hidden />
        )}
        <h1>매장 설정</h1>
        <div className="header-actions" />
      </div>

      <div className="settings-content">
        <div className="settings-tabs settings-tabs-main">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`settings-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {children(activeTab)}
      </div>
    </div>
  );
}
