'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/src/lib/auth';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSignOutAlt, faUser } from '@fortawesome/free-solid-svg-icons';

export default function NavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // 클라이언트에서만 마운트됨을 표시
    setMounted(true);
    // 사용자 정보 로드
    setUser(auth.getCurrentUser());
  }, []);

  useEffect(() => {
    // 실시간 시간 업데이트
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // 경로 변경 시 사용자 정보 업데이트
    if (mounted) {
      setUser(auth.getCurrentUser());
    }
  }, [pathname, mounted]);

  const handleLogout = () => {
    auth.logout();
    router.push('/login');
  };

  const formatTime = (date: Date) => {
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  // 로그인 페이지에서는 네비게이션 바를 표시하지 않음
  if (pathname === '/login') {
    return null;
  }

  // 마운트되지 않았으면 서버와 클라이언트 렌더링을 일치시키기 위해 빈 상태 반환
  if (!mounted) {
    return (
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-md border-b border-gray-700">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
                LNSMS Admin
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* 클라이언트에서 로드될 때까지 빈 공간 유지 */}
            </div>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-800/90 backdrop-blur-md border-b border-gray-700">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-bold text-white hover:text-gray-300 transition-colors">
              LNSMS Admin
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {user && (
              <>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <FontAwesomeIcon icon={faUser} />
                  <span>{user.username}</span>
                  {user.role === 'superadmin' && (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded">최고관리자</span>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {formatTime(currentTime)}
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-300 hover:text-white transition-colors flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faSignOutAlt} />
                  <span>로그아웃</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

