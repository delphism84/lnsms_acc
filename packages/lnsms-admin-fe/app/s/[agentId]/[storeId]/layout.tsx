'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { platformPath } from '@/src/lib/storeScopePaths';

export default function StoreSiteLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const agentId = String(params.agentId || '');
  const storeId = String(params.storeId || '');

  return (
    <div className="min-h-full flex flex-col">
      <div className="shrink-0 border-b border-gray-800 bg-gray-950/80 px-4 py-2 flex items-center justify-between gap-4 text-sm">
        <span className="text-gray-300">
          Store site · <span className="text-white">{agentId}</span> / <span className="text-white">{storeId}</span>
        </span>
        <Link href={platformPath()} className="text-blue-300 hover:text-blue-200">
          ← Platform
        </Link>
      </div>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
