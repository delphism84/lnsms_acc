'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import HostNavBar from './HostNavBar';
import Sidebar from './Sidebar';
import UploadQueue from './UploadQueue';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isHostSite = pathname.startsWith('/s/');
  const isLogin = pathname === '/login';
  const hideSidebar = isLogin || pathname.startsWith('/platform') || isHostSite;

  if (isLogin) {
    return <>{children}</>;
  }

  return (
    <>
      {isHostSite ? <HostNavBar /> : <NavBar />}
      <div
        className={`min-h-screen flex ${
          isHostSite ? 'host-site-shell pt-[52px]' : 'bg-gray-900 pt-16'
        }`}
      >
        {!hideSidebar ? <Sidebar /> : null}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</main>
      </div>
      <UploadQueue />
    </>
  );
}
