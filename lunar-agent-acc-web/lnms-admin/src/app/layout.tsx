import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LNSMS Admin',
  description: '에이전트 설정 관리',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
