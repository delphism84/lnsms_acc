# LNSMS Admin

에이전트 설정·사용자·매장·세트 관리용 Next.js 관리 화면 (NextAdmin 스타일).

- **유저/매장 관리**: 좌측 트리 (userid → storeid → setid), 세트 ID 추가/삭제
- **우측**: 세트 선택 시 상단 앱바(세트 ID, 저장/삭제) + 탭 (문구관리, RF모듈관리(COM·TCP), 설정관리)
- API 베이스 URL: 환경변수 **`NEXT_PUBLIC_LNSMS_API`** (미설정 시 기본 **`https://admin.necall.com`**)

## 환경 변수 (필수)

백엔드(`backend/.env`)의 **`PORT`와 프로토콜·호스트·포트가 일치**해야 브라우저에서 API가 동작합니다.

1. 프로젝트 루트에서 `.env.local.example`을 복사해 **`.env.local`** 생성:

```bash
cp .env.local.example .env.local
```

2. `.env.local` 내용 예:

```env
NEXT_PUBLIC_LNSMS_API=http://localhost:60000
```

- 서버 공인 IP로 Admin에 접속할 때는 `http://공인IP:60000` 형태로 백엔드 주소를 넣습니다.
- `next build` / `next start` 전에 설정해야 빌드에 반영됩니다.

## 실행

```bash
npm install
npm run dev
```

- 개발 서버: `0.0.0.0:60001` (`package.json`의 `dev` 스크립트)
- 프로덕션: `npm run build` 후 `npm start` → 동일하게 `0.0.0.0:60001`

백엔드(Node LNSMS API)가 **같은 머신**에서 먼저 떠 있어야 합니다.
