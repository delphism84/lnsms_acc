# Lunar Agent Acc - Node.js Backend

문구(phrases)·시리얼 설정(serial_settings)을 MongoDB에 저장하는 REST API 서버입니다.  
DB명: **lnsms**

## 요구사항

- Node.js 18+
- MongoDB (연결 정보는 `.env` 사용)

## 설정

1. `.env` 파일 생성 (또는 `.env.example` 복사 후 수정)

```env
MONGO_URI=mongodb://user:password@host:port/admin?serverSelectionTimeoutMS=7000&connectTimeoutMS=30000&maxIdleTimeMS=600000
DB_NAME=lnsms
PORT=60000
HOST=0.0.0.0
```

- **`PORT`**: HTTP 서버 포트. `lnms-admin`의 `NEXT_PUBLIC_LNSMS_API`에 **동일한 호스트:포트**로 맞춥니다.
- **`HOST`**: 생략 시 `0.0.0.0`(모든 인터페이스). 로컬만 듣게 하려면 `127.0.0.1`.
- 로컬 개발에서 58001 등 다른 포트를 쓰면 Admin `.env.local`의 `NEXT_PUBLIC_LNSMS_API`도 같이 바꿉니다.

### Cursor / 서버에서 처음 세팅할 때

1. 저장소 클론 후 `backend` 폴더에서 `.env.example`을 복사해 `.env`로 저장합니다.
2. `MONGO_URI`에 실제 MongoDB 주소를 넣습니다. (비밀번호는 커밋 금지)
3. `npm install` → `npm start` (또는 `npm run dev`)

4. 패키지 설치 및 실행

```bash
npm install
npm start
```

개발 시 파일 변경 자동 재시작:

```bash
npm run dev
```

## API

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/health | 서버·DB 상태 |
| GET | /api/phrases | 문구 목록 |
| POST | /api/phrases | 문구 생성 |
| PUT | /api/phrases/:uid | 문구 수정 |
| DELETE | /api/phrases/:uid | 문구 삭제 |
| GET | /api/serialport/settings | 시리얼 설정 조회 |
| POST | /api/serialport/settings | 시리얼 설정 저장 |
| POST | /api/serialport/settings/save-only | 설정만 저장 |
| GET | /api/serialport/ports | 사용 가능 포트 (서버에는 COM 없음 → []) |
| GET | /api/serialport/status | 연결 상태 (항상 false) |

시리얼 연결/해제·자동검색 등은 .NET 호스트 전용이며, 이 서버에서는 설정 읽기·쓰기만 지원합니다.

## MongoDB 문서 구조

- **phrases** 컬렉션: `{ _id: "db", phrases: [ { uid, text, isEnabled, color, bellCodes, ... } ] }`
- **serial_settings** 컬렉션: `{ _id: "serial", portName, baudRate, autoConnect, ... }`

## 보안

`.env`에는 비밀번호가 포함되므로 **절대 버전 관리에 올리지 마세요.**  
`.gitignore`에 `.env`가 포함되어 있습니다.
