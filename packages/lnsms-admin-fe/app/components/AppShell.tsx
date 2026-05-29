'use client';

import { usePathname } from 'next/navigation';
import NavBar from './NavBar';
import Sidebar from './Sidebar';
import UploadQueue from './UploadQueue';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const hideSidebar = pathname === '/login' || pathname.startsWith('/platform');

  return (
    <>
      <NavBar />
      <div className="pt-16 min-h-screen bg-gray-900 flex">
        {!hideSidebar ? <Sidebar /> : null}
        <main className="flex-1 min-w-0 min-h-0 overflow-y-auto">{children}</main>
      </div>
      <UploadQueue />
    </>
  );
}
