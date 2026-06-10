네, 충분히 가능합니다.
요즘은 웹사이트 FE(프론트엔드) + 크롬 브라우저만으로도 꽤 수준 높은 음성통화 앱을 만들 수 있습니다. 핵심은 브라우저의 WebRTC + getUserMedia API를 사용하는 거예요.

보통 구조는 이렇게 갑니다:

마이크 접근 → getUserMedia
실시간 음성 송수신 → WebRTC
연결 중계/시그널링 → WebSocket 서버
UI → React/Vue/Next.js 같은 FE

예를 들면:

const stream = await navigator.mediaDevices.getUserMedia({
  audio: true
})

이걸 호출하면 크롬이 사용자에게:

“이 사이트가 마이크 사용을 허용할까요?”

를 띄우고, 허용하면 실시간 음성 데이터를 받을 수 있습니다.

크롬 기반이면 가능한 수준

크롬은 WebRTC 지원이 아주 강해서 아래 대부분 가능합니다.

가능한 것들
1:1 음성통화
그룹 보이스채팅
push-to-talk
음성 mute/unmute
echo cancellation
noise suppression
AGC(자동 볼륨 조절)
실시간 음성 스트리밍
화면공유 + 음성
AI STT 연결 (Whisper 등)
실시간 번역/자막
실제 품질도 꽤 좋습니다

디스코드, 구글미트, 슬랙 허들 같은 서비스도 결국 브라우저/WebRTC 기술을 많이 활용합니다.

특히 크롬은:

Opus codec
echo cancellation
jitter buffer
packet loss recovery

같은 게 잘 되어 있어서 일반 통화 수준은 충분히 나옵니다.

하지만 제한도 있습니다
1. 브라우저 권한 필요

사용자가 마이크 허용해야 함.

2. HTTPS 필수

로컬 localhost 제외하면 HTTPS 아니면 마이크 접근 막힙니다.