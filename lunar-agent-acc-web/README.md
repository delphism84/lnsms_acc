# 장애인 도움요청 시스템 - Web 버전

웹 기술 기반으로 재설계된 장애인 도움요청 시스템입니다. ASP.NET Core Web API 백엔드와 React + Tailwind CSS 프론트엔드를 사용하며, WinForms + WebView2로 윈도우 애플리케이션으로 패키징됩니다.

## 주요 기능

- 실시간 알림 시스템 (SignalR)
- 문구 관리 (CRUD)
- 시리얼 포트 통신
- 트레이 아이콘 지원
- 자동 포트 충돌 해결
- iOS 쿠퍼티노 스타일 UI

## 기술 스택

### 백엔드
- **.NET**: 9.0
- **프레임워크**: ASP.NET Core Web API (Minimal API)
- **실시간 통신**: SignalR
- **시리얼 포트**: System.IO.Ports

### 프론트엔드
- **빌드 도구**: Vite
- **프레임워크**: React + TypeScript
- **스타일링**: Tailwind CSS
- **디자인**: iOS 쿠퍼티노 스타일

### 호스트 애플리케이션
- **플랫폼**: WinForms
- **웹뷰**: Microsoft WebView2
- **.NET**: 9.0

## 프로젝트 구조

```
lunar-agent-acc-web/
├── CareReceiverAgent.Host/         # 통합 호스트 앱 (백엔드 + WinForms)
│   ├── Controllers/                 # API 컨트롤러
│   │   ├── PhrasesController.cs    # 문구 관리 API
│   │   ├── SerialPortController.cs # 시리얼 포트 API
│   │   └── SettingsController.cs   # 설정 API
│   ├── Services/                     # 비즈니스 로직
│   │   ├── JsonDatabaseService.cs   # JSON 데이터베이스
│   │   ├── SerialPortService.cs    # 시리얼 포트 통신
│   │   ├── NotificationService.cs  # 알림 처리
│   │   ├── PortService.cs          # 포트 관리
│   │   └── SerialPortBackgroundService.cs # 백그라운드 서비스
│   ├── Hubs/                        # SignalR Hub
│   │   └── NotificationHub.cs     # 실시간 알림 Hub
│   ├── Models/                      # 데이터 모델
│   │   └── PhraseModel.cs          # 문구 모델
│   ├── Form1.cs                    # 메인 폼 (WebView2 포함)
│   ├── Form1.Designer.cs
│   ├── Program.cs                   # 진입점 (웹서버 + WinForms 통합)
│   └── CareReceiverAgent.Host.csproj
│
├── frontend/                        # React + Vite 프론트엔드
│   ├── src/
│   │   ├── components/             # React 컴포넌트
│   │   │   ├── NotificationView.tsx    # 알림창
│   │   │   ├── SettingsView.tsx        # 설정창
│   │   │   ├── PhraseModal.tsx         # 문구 모달
│   │   │   └── SerialPortModal.tsx     # 시리얼 포트 모달
│   │   ├── services/               # API 서비스
│   │   │   ├── api.ts              # API 기본 설정
│   │   │   └── phrases.ts          # 문구 API
│   │   ├── styles/                 # CSS 스타일
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── public/                     # 정적 파일
│   │   ├── acc.png                 # 장애인 이미지
│   │   └── alert.png               # 알림 배경 이미지
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── assets/                          # 리소스 파일
│   ├── acc.png                      # 장애인 이미지
│   ├── alert.png                    # 알림 배경 이미지
│   └── icons8_loudspeaker.ico       # 아이콘
│
├── build-and-run.bat               # 전체 빌드 및 실행 스크립트
├── kill-processes.bat              # 프로세스 종료 스크립트
└── README.md                        # 프로젝트 문서
```

## 빠른 시작

### 디버깅용 빌드 및 실행

```bash
# 전체 빌드 후 실행 (기존 프로세스 자동 종료)
build-and-run.bat
```

이 스크립트는 다음을 수행합니다:
1. 기존 프로세스 종료 (Host)
2. 프론트엔드 빌드
3. 프론트엔드 빌드 결과물을 Host wwwroot로 복사
4. 호스트 프로젝트 빌드 (백엔드 포함)
5. 호스트 애플리케이션 실행 (웹서버 자동 시작)

### 프로세스 종료

```bash
# 실행 중인 프로세스만 정확히 종료
kill-processes.bat
```

## 수동 빌드 및 실행

### 1. 프론트엔드 개발

```bash
cd frontend
npm install
npm run dev
```

프론트엔드는 개발 서버에서 실행되며, 백엔드 API와 통신합니다.

### 3. 프론트엔드 빌드

```bash
cd frontend
npm run build
```

빌드 결과물은 `frontend/dist/` 폴더에 생성됩니다.

### 2. 호스트 애플리케이션 빌드 및 실행

```bash
cd CareReceiverAgent.Host
dotnet build
dotnet run
```

호스트 애플리케이션은 내장된 웹서버를 자동으로 시작하고 WebView2로 프론트엔드를 로드합니다. 웹서버는 자동으로 사용 가능한 포트를 찾아 실행됩니다 (기본값: 58000).

## 배포

### Self-Contained 빌드

```bash
# 호스트 애플리케이션 (백엔드 포함)
cd CareReceiverAgent.Host
dotnet publish -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true
```

빌드 결과물은 `CareReceiverAgent.Host/bin/Release/net9.0-windows/win-x64/publish/` 폴더에 생성됩니다.

### InnoSetup 패키징

1. 프론트엔드 빌드 (`npm run build`)
2. 프론트엔드 빌드 결과물을 `CareReceiverAgent.Host/wwwroot/` 폴더에 복사
3. 호스트 애플리케이션 빌드 (`dotnet publish`)
4. InnoSetup으로 설치 패키지 생성

## API 엔드포인트

### 문구 관리
- `GET /api/phrases` - 문구 목록 조회
- `POST /api/phrases` - 문구 생성
- `PUT /api/phrases/{id}` - 문구 수정
- `DELETE /api/phrases/{id}` - 문구 삭제

### 시리얼 포트
- `GET /api/serialport/status` - 연결 상태 조회
- `GET /api/serialport/ports` - 사용 가능한 포트 목록
- `POST /api/serialport/connect` - 시리얼 포트 연결
- `POST /api/serialport/disconnect` - 시리얼 포트 연결 해제
- `GET /api/serialport/settings` - 시리얼 포트 설정 조회

### SignalR Hub
- `/notificationHub` - 실시간 알림 Hub
  - `ReceiveNotification` - 알림 수신 이벤트

## 데이터 저장

모든 데이터는 `data/` 폴더에 JSON 파일로 저장됩니다:
- `phrases.json` - 문구 데이터
- `serial_settings.json` - 시리얼 포트 설정

## 개발 환경 설정

### 필수 요구사항
- .NET 9.0 SDK
- Node.js 18+ 및 npm
- Visual Studio 2022 또는 Visual Studio Code

### 권장 확장 프로그램 (VS Code)
- C# Dev Kit
- ESLint
- Tailwind CSS IntelliSense

## 문제 해결

### 프로세스가 종료되지 않는 경우

`kill-processes.bat`를 실행하여 수동으로 종료할 수 있습니다.

### 백엔드가 시작되지 않는 경우

포트 58000이 이미 사용 중인지 확인하세요:
```bash
netstat -ano | findstr :58000
```

### 프론트엔드 빌드 실패

`node_modules` 폴더를 삭제하고 다시 설치:
```bash
cd frontend
rmdir /s /q node_modules
npm install
```

## 라이선스

이 프로젝트는 기존 lunar-agent-acc-v2 프로젝트를 웹 기반으로 재설계한 버전입니다.
