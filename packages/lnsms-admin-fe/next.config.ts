import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    // 운영에서 /api/* 가 FE(Next)로 떨어지면 HTML(404/로그인)이 반환되어 JSON 파싱이 깨집니다.
    // 따라서 /api, /uploads 를 백엔드로 프록시합니다.
    // - 우선순위: API_PROXY_TARGET > NEXT_PUBLIC_API_URL > (prod 기본) > (dev(docker) 기본)
    //   - 운영: 보통 Nginx가 /api,/uploads 를 백엔드로 프록시해야 합니다.
    //   - 로컬 docker: FE 컨테이너에서 localhost:40000은 "자기 자신"이므로 lnsms-be 서비스로 프록시합니다.
    const defaultTarget =
      process.env.NODE_ENV === "production" ? "https://lnsms.lunarsystem.co.kr" : "http://lnsms-be:3000";
    const target = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_URL || defaultTarget;
    return [
      { source: "/api/:path*", destination: `${target}/api/:path*` },
      { source: "/uploads/:path*", destination: `${target}/uploads/:path*` },
      { source: "/health", destination: `${target}/health` },
    ];
  },
};

export default nextConfig;
