import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">LNSMS Admin</h1>
        <p className="mt-2 text-slate-600">에이전트 설정·사용자·매장·세트 관리</p>
        <Link
          href="/manage"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-3 font-medium text-white hover:bg-primary-700"
        >
          유저/매장 관리
        </Link>
      </div>
    </div>
  );
}
