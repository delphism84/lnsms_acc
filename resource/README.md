# resource 폴더

이 폴더의 파일을 교체해서 **빌드 결과(아이콘/타이틀/이미지)** 를 바꾸기 위한 리소스 폴더입니다.

## 파일 규격

- `app.json`
  - `title`: 프로그램 제목
  - `notificationTitle`: 알림 화면 타이틀(프론트에서 사용)
- `appicon.ico`
  - 프로그램 아이콘(WinForms 트레이/창 아이콘에서 우선 사용)
- `appicon.png` (512x512)
  - 필요 시 프론트/기타에서 사용
- (선택) `acc.png`
  - 알림 화면의 좌측 이미지(`/acc.png`)를 교체하려면 이 파일을 추가하세요.
- (선택) `images/`
  - 문구별 이미지 용도. 예: `resource/images/a.png` → 프론트에서 `/images/a.png`로 사용

## 배포 규칙

- 빌드 시 `resource/`는 exe 출력 폴더 아래 `resource/`로 복사됩니다.
- `resource/app.json`은 exe 출력 폴더 루트에도 `app.json`으로 복사되어, 프로그램이 런타임에 읽습니다.

