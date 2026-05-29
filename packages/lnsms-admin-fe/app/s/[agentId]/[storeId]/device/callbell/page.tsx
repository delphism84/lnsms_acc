'use client';

import { Suspense } from 'react';
import StoreDeviceBackLink from '../StoreDeviceBackLink';

function Content() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white">콜벨</h1>
      <p className="mt-2 text-gray-400 text-sm">화면 구성은 추후 연결 예정입니다.</p>
      <div className="mt-4">
        <StoreDeviceBackLink />
      </div>
    </div>
  );
}

export default function StoreDeviceCallBellPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">로딩 중...</div>}>
      <Content />
    </Suspense>
  );
}
