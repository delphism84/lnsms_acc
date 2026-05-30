'use client';

import { useEffect, useState } from 'react';
import { remoteHostAuth, isOnlineMode } from '@/src/lib/remoteHostAuth';
import { LOCAL_STORE_ID, LOCAL_USERID } from '@/src/lib/storeScopePaths';

type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function RemoteLoginModal({ open, onClose, onSuccess }: Props) {
  const [userid, setUserid] = useState('');
  const [storeId, setStoreId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    const session = remoteHostAuth.getSession();
    if (session) {
      setUserid(session.userid);
      setStoreId(session.storeId);
    }
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await remoteHostAuth.login(userid.trim(), storeId.trim(), password);
      onSuccess();
      onClose();
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-lg border border-gray-700 bg-gray-900 p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-white mb-1">원격 매장 로그인</h2>
        <p className="text-sm text-gray-400 mb-4">
          sync용 원격 인증입니다. 로컬 데이터는 <span className="text-gray-200">{LOCAL_USERID}.{LOCAL_STORE_ID}</span> 그대로
          유지됩니다.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm text-gray-300 mb-1">userid (업체)</label>
            <input
              value={userid}
              onChange={(e) => setUserid(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">storeId (매장)</label>
            <input
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-300 mb-1">password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              required
            />
          </div>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-4 py-2 text-sm text-gray-300 hover:text-white"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? '로그인 중…' : '로그인'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
