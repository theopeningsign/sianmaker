# DEV_NOTES — AI 간판 시안 시스템 개발 노트

> 대화 압축/초기화 시에도 개발 맥락을 유지하기 위한 기록.
> 코드 변경 완료 시마다 자동 갱신됨.

---

## 프로젝트 기본 정보
- **프로젝트명:** AI-Powered Signboard Design & Layout System
- **메인 파일:** `canvas-editor.html`
- **기술 스택:** Fabric.js 5.3.1 (프론트), 향후 Flux Pro API + RMBG API (백엔드)
- **BM:** 시안 1회 생성 1,000원 / 원가 ~100원 (LLM 2원 + Flux Pro 100원 + 누끼 10원)

---

## 2026-05-28 | v1.0 — Fabric.js 핵심 프로토타입

- **변경 파일:** `canvas-editor.html` (신규 생성)
- **배경:** Step 4 (웹 캔버스 편집) 구현 시작. AI가 생성한 투명 PNG 간판을 건물 사진 위에 얹고 자유 편집하는 UI가 목표.
- **주요 기능:**
  - 건물 사진 업로드 → 캔버스 배경(고정 레이어)으로 배치
  - 간판 PNG 수동 업로드 → `fabric.Image`로 캔버스에 얹기
  - 마우스로 이동 / 크기 조절 / 회전
  - Drop Shadow 토글 (그림자로 이질감 최소화)
  - 배경 레이어 잠금 토글
  - `←↑↓→` 키보드 미세이동 (Shift = 10px)
  - `Delete/Backspace` 삭제
  - **[견적 요청]** 클릭 시 `left, top, scaleX, scaleY, angle` JSON 출력 (DB 저장용 시방서 데이터)
- **캔버스 크기:** 860 × 540px
- **참고:** `addSignFromURL(url)` 함수를 백엔드 AI 생성 완료 콜백에 연결하면 자동 연동 가능

---

## 2026-05-28 | v2.0 — 다중 간판 레이어 편집기

- **변경 파일:** `canvas-editor.html` (전면 재작성)
- **배경:** 고객이 전면간판 + 돌출간판 등 여러 종류를 한 번에 시안 요청할 수 있음. 단일 간판 구조로는 한계.
- **핵심 변경 — 레이어 패널 추가 (우측 사이드바):**
  - 간판 추가 시 패널에 색상 구분 카드 자동 생성
  - 패널에서 캔버스 선택 연동 (양방향 동기화)
  - 각 레이어 독립 제어:
    - 👁 표시/숨김 토글 (`fabric.visible`)
    - 🔒 잠금 토글 (`selectable`, `evented`)
    - ↑↓ Z-order 조절 (`bringForward` / `sendBackwards`)
    - ⧉ 복제 (`fabricObj.clone()`) — `Ctrl+D` 단축키
    - 🗑 삭제 — `Delete/Backspace` 단축키
  - `signs[]` 배열로 메타데이터 관리, `syncZOrder()`로 canvas Z-order와 동기화
- **신규 기능 — 불투명도 슬라이더:**
  - 선택된 간판만 개별 opacity 조절 (info bar 우측)
- **JSON 출력 확장:**
  - `zIndex`, `opacity`, `visible`, `locked` 필드 추가
- **캔버스 크기:** 660 × 413px (사이드바 공간 확보)

---

## 2026-05-28 | v2.1 — 레이아웃 버그 수정 (사이드바 미표시)

- **변경 파일:** `canvas-editor.html`
- **버그 원인:**
  Fabric.js는 `new fabric.Canvas()` 호출 시 내부적으로 wrapper `<div>`를 `style="width: 654px"` 고정 inline으로 생성함.
  캔버스 영역을 `flex: 1 1 0`으로 설정했는데, 이 wrapper가 flex shrink를 막아 프리뷰 창 너비를 초과 → 사이드바가 밀려나거나 보이지 않는 현상 발생.
- **수정 내용:**
  - 전체 레이아웃을 flex 자동 배분 → **명시적 고정 너비**로 전환
  - `.workspace { width: 760px }` 고정
  - `.canvas-area { width: 555px; flex-shrink: 0 }` 고정
  - `.layer-panel { width: 185px; flex-shrink: 0 }` 고정
  - 캔버스 내부 크기도 555 × 347px로 조정 (영역에 딱 맞춤)
- **결과:** 어떤 프리뷰 환경에서도 캔버스 + 사이드바가 나란히 정상 표시

---

## 2026-05-28 | v3.0 — 반응형 캔버스 + 사진 비율 유지 + 크롭 기능

- **변경 파일:** `canvas-editor.html` (전면 재작성)
- **버그 원인 (사이드바 계속 안 보임):**
  v2.1에서 고정 픽셀 너비(760px)를 줬는데도, Fabric.js가 생성하는 `.canvas-container` wrapper div가 `width: Npx` inline style을 강제로 달고 나와 flex 레이아웃을 여전히 밀어냄. 근본 해결을 위해 **cssOnly 반응형 방식**으로 완전 교체.
- **핵심 변경 — 반응형 캔버스 (cssOnly):**
  - 논리 캔버스(CW/CH)는 고정 유지, CSS 표시 크기만 컨테이너에 맞게 동적 조정
  - `canvas.setDimensions({ width: w+'px', height: h+'px' }, { cssOnly: true })`
  - Fabric.js가 `getBoundingClientRect()`로 CSS 스케일 비율을 자동 보정 → 마우스 이벤트 좌표 정확
  - `.canvas-wrap { flex: 1 1 0; min-width: 0 }` + `.layer-panel { width: 185px; flex-shrink: 0 }` → 사이드바 완전 분리
- **신규 기능 — 건물 사진 비율 유지 (contain):**
  - 기존: `Math.max(scale)` = cover (이미지 잘림)
  - 변경: 사진 업로드 시 캔버스 논리 크기를 사진 비율에 맞게 자동 리사이즈 (max 640×520)
  - `Math.min(scale)` = contain → 사진 전체가 캔버스에 다 보임
  - 원본 HTMLImageElement를 `bgOrigEl`로 보관 (크롭 시 고화질 소스로 활용)
- **신규 기능 — 영역 선택(크롭):**
  - `✂️ 영역 선택` 버튼 → 크롭 모드 진입
  - 파란 점선 사각형(Fabric Rect) 으로 영역 조절
  - `✓ 이 영역으로 확정` → temp canvas에서 원본 픽셀로 크롭 추출
  - 크롭된 이미지로 배경 교체 + 캔버스 크기 크롭 비율에 재조정
  - `Escape` 또는 `✗ 취소`로 크롭 모드 종료
  - 크롭 모드 중 간판 추가/선택 비활성화
- **캔버스 크기:** 동적 (사진 비율 기반, 기본 600×375)

---

## 2026-05-28 | v3.1 — 흰배경 투명처리 + 파일 확장자 전체 허용 + 자동 새로고침

- **변경 파일:** `canvas-editor.html`
- **신규 기능 — 흰배경 투명처리 (레이어별 독립):**
  - 레이어 패널 각 아이템 하단에 `⬜ 흰배경 투명처리` 체크박스 추가
  - 체크 시: `Canvas.getContext('2d').getImageData()`로 픽셀 순회 → R,G,B 모두 ≥ 240인 픽셀 투명처리 (점진적 alpha 적용으로 에지 부드럽게)
  - 체크 해제 시: `sign.origURL`에 보존해둔 원본 이미지로 복원
  - Fabric.js Image 교체 시 `left/top/scaleX/scaleY/angle/opacity` 완전 보존
  - sign state에 `whiteRemoved`, `origURL` 필드 추가
- **수정 — 파일 확장자:**
  - 간판 이미지 업로드: `image/png,image/webp` → `image/*` (jpg, gif, bmp, svg 등 전체 허용)
  - 건물 사진: 기존부터 `image/*` (변경 없음)
- **수정 — 프리뷰 자동 새로고침:**
  - live-server WebSocket이 preview 패널 iframe에서 미작동 확인
  - `<head>`에 폴링 스크립트 삽입: 800ms마다 `Last-Modified` 헤더 체크 → 변경 시 `location.reload()`
  - localhost/127.0.0.1 환경에서만 작동 (프로덕션 영향 없음)

## 2026-05-28 | v3.2 — 흰배경 투명처리 버그 수정

- **변경 파일:** `canvas-editor.html`
- **버그 원인 1 — `getElement()` 방식 문제:**
  `obj.getElement()`로 가져온 HTMLImageElement는 Fabric.js 내부에서 처리된 상태여서 `getImageData()` 호출 시 SecurityError 발생 가능 → 함수 전체가 무음으로 실패
- **버그 원인 2 — 수식 오류:**
  `* 0.05` 계수 때문에 흰색 픽셀이 완전 투명(0)이 아닌 5% opacity(13/255)로 처리 → 시각적으로 거의 안 보이지만 완전 제거 안 됨
- **수정 내용:**
  - `removeWhiteBg(srcURL)`: `obj.getElement()` 대신 `sign.origURL`(data URL)로 새 `Image()` 직접 생성 → CORS 문제 원천 차단
  - 수식 → **단순 binary**: `R,G,B 모두 ≥ 235 → alpha=0` (완전 투명)
  - `try-catch` 추가: 실패 시 콘솔 에러 + 체크박스 자동 복원
  - `doWhiteBg` async/await 로 전환 (Promise 기반 removeWhiteBg 와 맞춤)
  - threshold 240 → 235 (JPEG 압축 아티팩트 고려)

## 다음 개발 예정
- [ ] Step 1 — 간판 종류/옵션 입력 UI 폼
- [ ] Step 2 — 백엔드 프롬프트 확장 API (`/api/generate`) 연동
- [ ] Step 3 — Flux Pro + RMBG API 파이프라인
- [ ] Step 4 확장 — `addSignFromURL(url)`에 AI 생성 결과 자동 연결
- [ ] 캔버스 스냅샷 저장 (toDataURL) + Supabase JSON 저장
- [ ] 모바일 터치 지원 (Pinch-zoom, 두 손가락 회전)
