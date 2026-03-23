# 오프라인 가능 + UI 태그/ID 기반 개발 추천 (QA·AI 친화)

.NET BE 웹서버 + 하이브리드 웹 UI 기준으로, **오프라인 지원**과 **태그/ID로 UI 작성·검수하기 좋은** 언어/라이브러리 정리.

---

## 1. 현재 스택 유지 시 (React + Vite) — 추천

이미 **React + TypeScript + Vite**를 쓰고 있으므로, 여기에 **오프라인(PWA)** + **테스트/QA용 속성 규칙**만 붙이는 것이 가장 현실적입니다.

| 항목 | 권장 |
|------|------|
| **오프라인** | **PWA**: `vite-plugin-pwa`로 Service Worker 등록 → 빌드된 정적 자산 + API 응답 캐시 전략으로 오프라인 동작 |
| **태그/ID** | 모든 인터랙션 요소에 **`data-testid="화면명-요소역할"`** (예: `data-testid="settings-serial-open"`, `data-testid="notification-confirm-all"`) 일관 부여. 필요 시 `id`도 동일 규칙으로 부여 |
| **시맨틱** | 버튼/폼/리스트에 `role`, `aria-label`, `aria-describedby` 사용 → 스크린리더 + QA 봇 셀렉터로 활용 |

**QA 봇 / AI 검수 시**: `document.querySelector('[data-testid="notification-confirm-all"]')` 같은 방식으로 안정적으로 요소 지정 가능.

---

## 2. 오프라인 가능한 개발 언어/라이브러리 요약

| 언어/라이브러리 | 오프라인 | UI 태그/ID·QA 친화 | .NET BE와 궁합 | 비고 |
|-----------------|----------|--------------------|----------------|------|
| **React + PWA** | ✅ (SW) | ✅ `data-testid` 등 규칙만 지키면 됨 | ✅ API만 호출 | **현재 스택 유지 시 최선** |
| **Vue 3 + PWA** | ✅ (SW) | ✅ 동일하게 `data-testid`/`id` 규칙 적용 | ✅ 동일 | React 대안, 템플릿 기반이라 ID 부여가 직관적 |
| **Svelte + PWA** | ✅ (SW) | ✅ 컴파일 결과가 단순 HTML, id/testid 제어 용이 | ✅ 동일 | 번들 작고, 출력 DOM이 예측 가능해 QA 스크립트 작성 쉬움 |
| **Blazor WebAssembly** | ✅ (WASM 캐시) | ⚠️ 가능하나 `id`/`data-*`를 컴포넌트마다 직접 넣어줘야 함 | ✅✅ 동일 스택 | C# 한 언어 선호 시 고려 |
| **Alpine.js + 정적 HTML** | ✅ (그냥 로컬 파일) | ✅✅ 태그/id를 직접 다 쓰므로 AI·QA가 가장 단순 | ✅ BE가 HTML 서빙만 하면 됨 | 복잡한 SPA 불필요할 때 |
| **Vanilla TS + PWA** | ✅ (SW) | ✅✅ DOM 완전 직접 제어 | ✅ 동일 | 의존성 최소, 태그/id 완전 자유 |

---

## 3. “UI 태그/ID 있어서 AI 작성·QA 봇 검수하기 좋은” 것만 따로

- **태그/ID가 가장 명확한 쪽**: **Alpine.js + HTML**, **Vanilla TS**, **Svelte**.  
  - 마크업에 `id`, `data-testid`, `role`을 직접 쓰므로, AI가 “이 버튼은 이 id”라고 쓰고, QA 봇이 `getElementById` / `querySelector('[data-testid="..."]')` 로 검수하기 좋음.
- **React/Vue**는 **규칙을 정하면** 동일하게 좋음:  
  - 예: “모든 버튼·폼 컨트롤·리스트 아이템에 `data-testid` 부여”, “한 화면당 접두어 통일” (예: `settings-*`, `notification-*`).

---

## 4. 정리 추천

- **지금처럼 .NET BE + 웹 UI 하이브리드 유지**하고, **오프라인 + QA/AI 친화**만 강화하려면:  
  → **React 유지 + PWA 도입 + `data-testid`/`id`/시맨틱 규칙**을 문서화해 적용.
- **프레임워크를 바꿔도 된다면**:  
  - **Svelte**: 작은 번들, 단순한 DOM 출력 → QA 봇/자동화에 유리.  
  - **Blazor WebAssembly**: BE와 같은 .NET 생태계, 오프라인(WASM) 가능하지만 “태그/ID”는 팀에서 규칙을 잡아줘야 함.
- **가장 단순한 “태그/ID + 오프라인”**을 원하면: **정적 HTML + Alpine.js (또는 Vanilla TS) + PWA**로 가면 AI가 마크업 쓰고 QA 봇이 셀렉터로 검수하기 가장 직관적.

원하시면 `data-testid` 네이밍 규칙 예시(설정/알림/문구 관리 등 화면별)나, `vite-plugin-pwa` 설정 스니펫도 정리해 드리겠습니다.
