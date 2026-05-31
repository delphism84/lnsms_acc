'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hostAuth } from '@/src/lib/hostAuth';
import { storeSiteSetting } from '@/src/lib/storeScopePaths';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStore, faLock, faSignInAlt, faUser } from '@fortawesome/free-solid-svg-icons';

export default function StoreLoginPage() {
  const router = useRouter();
  const [userid, setUserid] = useState('');
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hostAuth.isAuthenticated()) return;
    const key = hostAuth.getStoreKey();
    if (key) {
      const [u, s] = key.split('.');
      if (u && s) router.replace(storeSiteSetting(u, s));
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const u = userid.trim();
      const s = storeId.trim();
      await hostAuth.login(u, s, password);
      router.push(storeSiteSetting(u, s));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="bg-gray-800 rounded-lg shadow-lg p-8 border border-gray-700">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">LNSMS</h1>
            <p className="text-gray-400">매장 로그인</p>
          </div>

          {error && (
            <div className="bg-red-800 text-white p-3 rounded-md mb-6 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="userid" className="block text-sm font-medium text-gray-300 mb-2">
                userid (업체)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faUser} className="text-gray-400" />
                </div>
                <input
                  id="userid"
                  type="text"
                  value={userid}
                  onChange={(e) => setUserid(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="업체 ID"
                />
              </div>
            </div>

            <div>
              <label htmlFor="storeId" className="block text-sm font-medium text-gray-300 mb-2">
                storeId (매장)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faStore} className="text-gray-400" />
                </div>
                <input
                  id="storeId"
                  type="text"
                  value={storeId}
                  onChange={(e) => setStoreId(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="매장 ID"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                비밀번호
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon icon={faLock} className="text-gray-400" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="비밀번호"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>로그인 중...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSignInAlt} />
                  <span>로그인</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
