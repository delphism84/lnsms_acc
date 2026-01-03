# 알림창 디자인 컨트롤 가이드

알림창의 디자인을 변경하기 위한 컨트롤 구조와 속성 가이드입니다.

## 전체 컨테이너

**컨트롤명**: `.notification-view`  
**파일**: `frontend/src/styles/NotificationView.css`

### 현재 속성
- `width`: 900px
- `height`: 500px
- `background-color`: #1f2023
- `display`: flex
- `flex-direction`: column
- `position`: relative
- `overflow`: hidden

---

## 1. 상단 타이틀 영역

**컨트롤명**: `.notification-header`  
**파일**: `frontend/src/components/NotificationView.tsx` (JSX), `frontend/src/styles/NotificationView.css` (CSS)

### 텍스트
- **내용**: "장애인 도움 요청"
- **컨트롤명**: `.notification-title`
- **위치**: `frontend/src/components/NotificationView.tsx` (line 72)

### CSS 속성 (`.notification-header`)
- `height`: 120px
- `display`: flex
- `align-items`: center
- `justify-content`: center
- `background`: linear-gradient(135deg, #007AFF 0%, #0051D5 100%)
- `position`: relative

### CSS 속성 (`.notification-title`)
- `font-size`: 80px
- `font-weight`: 700
- `color`: #FFFFFF
- `margin`: 0
- `text-shadow`: 0 0 20px rgba(0, 122, 255, 0.8), 0 0 40px rgba(0, 122, 255, 0.6), 0 0 60px rgba(0, 122, 255, 0.4)
- `animation`: glow-pulse 5s ease-in-out infinite

### 애니메이션 (`.notification-title`)
- **이름**: `glow-pulse`
- **지속시간**: 5초
- **타이밍**: ease-in-out
- **반복**: 무한
- **효과**: 텍스트 그림자 강도 변화 (glow 효과)

---

## 2. 중앙 콘텐츠 영역

**컨트롤명**: `.notification-content-area`  
**파일**: `frontend/src/components/NotificationView.tsx` (JSX), `frontend/src/styles/NotificationView.css` (CSS)

### CSS 속성
- `flex`: 1 (남은 공간 모두 사용)
- `display`: flex
- `align-items`: center
- `padding`: 40px
- `gap`: 40px (좌우 요소 간 간격)

---

## 2-1. 좌측 이미지 영역

**컨트롤명**: `.notification-image-container`  
**파일**: `frontend/src/components/NotificationView.tsx` (line 75-77), `frontend/src/styles/NotificationView.css`

### 이미지
- **파일**: `/acc.png` (public 폴더)
- **컨트롤명**: `.notification-image`
- **alt 텍스트**: "장애인"

### CSS 속성 (`.notification-image-container`)
- `flex-shrink`: 0 (축소되지 않음)
- `width`: 200px
- `height`: 200px
- `display`: flex
- `align-items`: center
- `justify-content`: center

### CSS 속성 (`.notification-image`)
- `width`: 100%
- `height`: 100%
- `object-fit`: contain (비율 유지하며 맞춤)

---

## 2-2. 우측 텍스트 영역

**컨트롤명**: `.notification-text-container`  
**파일**: `frontend/src/components/NotificationView.tsx` (line 80-87), `frontend/src/styles/NotificationView.css`

### 텍스트
- **컨트롤명**: `.notification-message-text`
- **동적 내용**: `notification?.message || '도움이 필요합니다'`
- **동적 색상**: `notification?.color || '#FFFFFF'`

### CSS 속성 (`.notification-text-container`)
- `flex`: 1 (남은 공간 모두 사용)
- `display`: flex
- `align-items`: center
- `justify-content`: center
- `height`: 100%
- `padding`: 20px

### CSS 속성 (`.notification-message-text`)
- `color`: #FFFFFF (기본값, 동적으로 변경 가능)
- `font-weight`: 600
- `text-align`: center
- `word-break`: keep-all
- `overflow-wrap`: break-word
- `text-shadow`: 0 0 2px rgba(255, 255, 255, 0.8), 0 0 4px rgba(255, 255, 255, 0.6)
- `animation`: text-glow 2s ease-in-out infinite
- `font-size`: clamp(24px, 5vw, 60px) (자동 글자 크기 조정)
- `line-height`: 1.2

### 애니메이션 (`.notification-message-text`)
- **이름**: `text-glow`
- **지속시간**: 2초
- **타이밍**: ease-in-out
- **반복**: 무한
- **효과**: 텍스트 그림자 강도 변화 (2px glow 효과)

---

## 3. 하단 버튼 영역

**컨트롤명**: `.notification-bottom-controls`  
**파일**: `frontend/src/components/NotificationView.tsx` (line 90-115), `frontend/src/styles/NotificationView.css`

### CSS 속성
- `position`: absolute
- `bottom`: 20px
- `left`: 50%
- `transform`: translateX(-50%) (중앙 정렬)
- `display`: flex
- `align-items`: center
- `gap`: 12px (버튼 간 간격)

---

## 3-1. 확인 버튼

**컨트롤명**: `.notification-confirm-button`  
**파일**: `frontend/src/components/NotificationView.tsx` (line 92-96), `frontend/src/styles/NotificationView.css`

### 텍스트
- **내용**: "확인"

### CSS 속성
- `padding`: 12px 32px
- `font-size`: 18px
- `font-weight`: 600
- `color`: #FFFFFF
- `background-color`: #007AFF
- `border`: none
- `border-radius`: 8px
- `cursor`: pointer
- `transition`: background-color 0.2s

### 호버 효과
- `background-color`: #0051D5

### 활성 효과
- `background-color`: #0040A8

---

## 3-2. 설정 아이콘 버튼

**컨트롤명**: `.notification-settings-icon`  
**파일**: `frontend/src/components/NotificationView.tsx` (line 97-115), `frontend/src/styles/NotificationView.css`

### 아이콘
- **타입**: SVG (인라인)
- **크기**: 32x32px
- **내용**: 설정(톱니바퀴) 아이콘

### CSS 속성 (`.notification-settings-icon`)
- `width`: 32px
- `height`: 32px
- `padding`: 0
- `background-color`: transparent
- `border`: none
- `cursor`: pointer
- `color`: #007AFF
- `display`: flex
- `align-items`: center
- `justify-content`: center
- `transition`: opacity 0.2s

### 호버 효과
- `opacity`: 0.7

### 활성 효과
- `opacity`: 0.5

### CSS 속성 (`.notification-settings-icon svg`)
- `width`: 32px
- `height`: 32px

---

## 애니메이션 정의

### glow-pulse (상단 타이틀용)
```css
@keyframes glow-pulse {
  0%, 100% {
    text-shadow: 0 0 20px rgba(0, 122, 255, 0.8),
                 0 0 40px rgba(0, 122, 255, 0.6),
                 0 0 60px rgba(0, 122, 255, 0.4);
  }
  50% {
    text-shadow: 0 0 30px rgba(0, 122, 255, 1),
                 0 0 60px rgba(0, 122, 255, 0.8),
                 0 0 90px rgba(0, 122, 255, 0.6);
  }
}
```

### text-glow (메시지 텍스트용)
```css
@keyframes text-glow {
  0%, 100% {
    text-shadow: 0 0 2px rgba(255, 255, 255, 0.8),
                 0 0 4px rgba(255, 255, 255, 0.6);
  }
  50% {
    text-shadow: 0 0 4px rgba(255, 255, 255, 1),
                 0 0 8px rgba(255, 255, 255, 0.8),
                 0 0 12px rgba(255, 255, 255, 0.6);
  }
}
```

---

## 수정 방법

### 1. 크기 변경
- 전체 크기: `.notification-view`의 `width`, `height` 수정
- 상단 타이틀 높이: `.notification-header`의 `height` 수정
- 이미지 크기: `.notification-image-container`의 `width`, `height` 수정

### 2. 색상 변경
- 배경색: `.notification-view`의 `background-color` 수정
- 타이틀 배경: `.notification-header`의 `background` (그라데이션) 수정
- 타이틀 텍스트 색상: `.notification-title`의 `color` 수정
- 메시지 텍스트 색상: `.notification-message-text`의 `color` 수정 (또는 동적 색상 사용)
- 버튼 색상: `.notification-confirm-button`의 `background-color` 수정

### 3. 폰트 변경
- 타이틀 폰트 크기: `.notification-title`의 `font-size` 수정
- 메시지 폰트 크기: `.notification-message-text`의 `font-size` 수정 (clamp 값 조정)
- 폰트 굵기: `font-weight` 속성 수정

### 4. 레이아웃 변경
- 패딩/마진: 각 컨테이너의 `padding`, `margin` 수정
- 간격: `gap` 속성 수정
- 정렬: `align-items`, `justify-content` 수정

### 5. 애니메이션 변경
- 애니메이션 속도: `animation` 속성의 시간 값 수정
- 애니메이션 효과: `@keyframes` 정의 수정
- 애니메이션 제거: `animation` 속성을 `none`으로 설정

### 6. 이미지 변경
- 이미지 파일 교체: `frontend/public/acc.png` 파일 교체
- 이미지 경로 변경: `NotificationView.tsx`의 `src="/acc.png"` 수정

---

## 파일 위치

- **컴포넌트**: `frontend/src/components/NotificationView.tsx`
- **스타일**: `frontend/src/styles/NotificationView.css`
- **이미지**: `frontend/public/acc.png`
- **전체 크기 설정**: `CareReceiverAgent.Host/Form1.Designer.cs` (line 33: `ClientSize = new System.Drawing.Size(805, 463)`)

---

## 참고사항

- 전체 창 크기는 `Form1.Designer.cs`에서도 설정됩니다 (현재: 805x463)
- 메시지 텍스트 색상은 동적으로 변경 가능합니다 (`notification?.color`)
- 폰트 크기는 `clamp()` 함수로 반응형으로 설정되어 있습니다
- 모든 애니메이션은 CSS로 구현되어 있어 성능이 좋습니다

