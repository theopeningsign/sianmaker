# DEV_NOTES — AI 간판 시안 시스템 개발 노트

> 대화 압축/초기화 시에도 개발 맥락을 유지하기 위한 기록.
> 코드 변경 완료 시마다 자동 갱신됨.

---

## 2026-05-29 | 아키텍처 방향 전환 논의 (잠정) + 데모

- **변경 파일:** `demo-sign.html` (신규), `.claude/launch.json` (프리뷰 포트 3031로 변경 — 사장님 3000번 서버와 충돌 방지)
- **배경:** "LoRA 회의론" 검토 중 한글 간판 생성 전략 재설계.
- **핵심 결정 (잠정, 추후 재논의 — 상세는 플랜파일 `witty-forging-graham.md`):**
  - 로컬 LoRA 학습 취소. 한글 글자는 AI로 안 만들고 **폰트로 직접 렌더**(깨짐 0%).
  - 아키텍처: **절차적 렌더(WebGL) + AI 사진 마감 패스(ControlNet 구조잠금)**.
  - AI는 글자가 아니라 사진 마감·건물 합성에만 사용.
  - 거대 영문 프롬프트 라이브러리 → **렌더 파라미터 프리셋(JSON)** 으로 대체. 결제후 LLM 확장 거의 불필요.
- **demo-sign.html:** CSS로 "대박치킨" 채널(야간 발광)/네온/금속(주간) 렌더. 한글 폰트(Black Han Sans/Jua/Do Hyeon) 그대로 사용해 깨짐 없음 확인. 네온 품질 우수. 단 절차적만으론 "사진"보단 "그림" 느낌 — AI 마감 패스로 격차 메우는 게 1순위 검증 과제.
- **추가 논의 결론 (플랜파일 상세):**
  - **5종 간판 적용 가능성:** 표준 케이스 다 가능(구조+폰트+AI마감). 단 "기타/조형물", 임의 복잡로고, 복잡 그래픽 디자인은 제외/별도. 카테고리별 전용 3D 템플릿 필요 → 전면부터 단계적 빌드.
  - **텍스트+일러스트 통합 채널** (대박🐔치킨): 그림이 벡터면 글자와 동일 파이프라인 → 재질 일치(절차적 강점). 업종별 클립아트 라이브러리(v1) + 단순로고 벡터화.
  - **유저 투 모드:** 제작모드(정한 사람, 절차적+AI마감) vs 탐색모드(모르는 사람, AI 풀생성). **MVP=제작모드 우선** (가격비교 유입=고전환). 탐색모드 후순위 깔때기.
  - **시공방법 = 백킹 레이어 프리셋:** 글자 고정, 뒤 배경만 교체. 맨벽(쉬움)→전면프레임→프레임바→파사드(어려움). 프로토타입은 맨벽부터.
  - **다음 작업:** 전면-채널-맨벽 WebGL 절차적 렌더 프로토타입.

## 2026-05-29 | v1.1 — step2→step3 페이지 연결

- **변경 파일:** `step2-material.html`
- **변경 내용:** goNext() 내 alert 제거 및 주석 해제 → `window.location.href = 'step3-size.html'` 활성화
- **주요 기능:** step1→step2→step3 전체 흐름 연결 완료

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

## 2026-05-28 | v4.0 — 지우기(인페인팅) 모드 추가

- **변경 파일:** `canvas-editor.html`
- **배경:** 건물 사진에 기존 간판이 있을 경우, AI로 자연스럽게 지워야 새 시안 배치가 자연스러움.
  갤럭시 '지우개' 같은 브러시 기반 UI + Hugging Face LaMa 무료 API 조합.
- **핵심 구현 — 마스크 오버레이 캔버스:**
  - `<canvas id="maskCanvas">`: Fabric 캔버스 위에 absolute 포지션으로 얹음 (z-index: 10)
  - 논리 크기(CW×CH)로 내부 픽셀 설정, CSS 크기는 `syncMaskSize()`로 반응형 동기화
  - `cssToLogical(cssX, cssY)`: CSS 이벤트 좌표 → 논리 좌표 변환 (`CW / wrap.clientWidth` 스케일)
  - 브러시: `rgba(255,70,70,0.65)` 반투명 원으로 시각 피드백
  - 커스텀 커서: `#brushCursor` div (border 원형, pointer-events: none)
  - 터치 이벤트 지원 (touchstart/touchmove, passive: false)
- **마스크 → 인페인팅 파이프라인:**
  1. 배경 이미지 표시 영역(dispW×dispH)만 추출 → `bgOrigEl`을 drawImage
  2. 마스크 캔버스에서 배경 영역만 잘라냄 (dispL, dispT, dispW, dispH) → 업스케일
  3. 칠해진 픽셀(alpha > 30) → 흰색(255,255,255) = 지우기 영역
  4. 나머지 → 검정(0,0,0) = 유지 영역
  5. Hugging Face IOPaint(LaMa) Space API 호출
  6. 결과 이미지로 `loadBackground()` 교체
- **API — HuggingFace Gradio 4.x SSE Queue:**
  - Space: `https://sanster-iopaint-lama.hf.space`
  - `POST /queue/join` → SSE `/queue/data?session_hash=...` 대기
  - 큐 위치(`estimation`), 처리 시작(`process_starts`), 완료(`process_completed`) 메시지 처리
  - Gradio 3.x 폴백: `/run/predict` 직접 호출
  - 90초 타임아웃, CORS 오류 시 Space URL 안내 메시지
- **UI 상태 관리:**
  - `eraseMode`, `isDrawing`, `brushRadius` 상태 추가
  - `startEraseMode()` / `endEraseMode()`: Fabric 간판 선택 비활성화/복원
  - `🧹 지우기` 버튼 `.active` 클래스로 빨간 테두리 피드백
  - 브러시 크기 슬라이더 (5~120px)
  - `Escape` 키로 지우기 모드 종료 가능
  - 크롭 모드와 상호 배타적 (동시 진입 불가)
- **비용:** HuggingFace 무료 Space 사용 (0원). 단, 서버 슬립 시 첫 요청 ~30초 대기.

## 2026-05-28 | v4.1 — 지우기 모드 사각형 선택 도구 추가

- **변경 파일:** `canvas-editor.html`
- **변경 내용:** 지우기 모드에 사각형 범위 선택 도구 추가. 브러시는 그대로 유지.
- **주요 기능:**
  - 지우기 배너에 `🖌️ 브러시` / `⬜ 사각형` 토글 버튼 추가
  - 사각형 모드: 드래그로 직사각형 영역 지정 → mouseup 시 해당 영역 전체가 한 번에 마스크로 채워짐
  - 드래그 중 `#rectPreview` div (dashed 빨간 테두리)로 선택 영역 미리보기
  - 사각형 모드에서는 브러시 크기 슬라이더 숨김 / cursor 'crosshair' 전환
  - 브러시 모드로 돌아오면 슬라이더 복원 / cursor 'none'(커스텀 원) 복원
  - 터치(touchend) 지원
  - 지우기 모드 진입 시 항상 브러시 모드로 초기화
- **상태 추가:** `eraseRectMode`, `rectStartL`, `rectStartC`

## 2026-05-28 | v4.2 — LaMa API 다중 Space 폴백 + 에러 진단 강화

- **변경 파일:** `canvas-editor.html`
- **버그 원인:** `sanster-iopaint-lama.hf.space` URL이 존재하지 않거나 응답 없음 → 405 에러
- **수정 내용:**
  - `LAMA_SPACES` 배열로 후보 Space 3개 순서대로 시도
    1. `sanster-lama-cleaner-lama.hf.space` (Sanster/lama-cleaner-lama)
    2. `sanster-iopaint.hf.space` (Sanster/IOPaint)
    3. `sanster-iopaint-lama.hf.space` (구버전 폴백)
  - 각 Space마다: GET / → 생존확인 → Gradio 4.x queue/join → 실패시 Gradio 3.x run/predict
  - `fetchWithTimeout()`: AbortController 기반 타임아웃 (Space 핑 8초, predict 90초)
  - 실패 시 에러 메시지에 HTTP 상태코드 + 응답 body 앞 120자 포함
  - 모든 Space 실패 시 각 시도 결과 + Space 직접 접속 URL 안내
  - `extractOutput()`: 응답 형식(string / {url} / {data}) 통합 파싱
  - `waitGradio4SSE()`: SSE 대기 로직 별도 함수로 분리

## 2026-05-28 | v4.3 — 자동 새로고침 폴링 제거

- **변경 파일:** `canvas-editor.html`
- **변경 내용:** `<head>` 내 800ms 폴링 스크립트 완전 제거. 수동 새로고침으로만 변경 반영.

## 2026-05-28 | v4.4 — 인페인팅 로컬 IOPaint 전환 + 클라우드 모듈화

- **변경 파일:** `canvas-editor.html`
- **배경:** HuggingFace free Space들이 sleeping 상태라 API 불가. 로컬 IOPaint로 전환.
- **아키텍처:**
  - `INPAINT_CONFIG` 상수 하나로 로컬 ↔ 클라우드 전환
  - `LOCAL_MODE: true` → `callLocalIOPaint()` → `http://localhost:8080/api/v1/inpaint`
  - `LOCAL_MODE: false` → `callCloudInpaint()` → Replicate / Fal.ai (TODO)
- **IOPaint API:**
  - `POST /api/v1/inpaint` (multipart/form-data: image + mask)
  - 흰색 마스크 = 지우기 영역, 응답 = 결과 이미지 바이너리 (blob)
  - `URL.createObjectURL(blob)` 으로 바로 `loadBackground()` 연결
  - CORS: `iopaint start ... --cors-allowed-origins="*"` 으로 해결 (백엔드 프록시 불필요)
- **클라우드 전환 방법 (서비스 론칭 시):**
  1. `INPAINT_CONFIG.LOCAL_MODE = false`
  2. `INPAINT_CONFIG.PROVIDER = 'replicate'` 또는 `'fal'`
  3. `INPAINT_CONFIG.API_KEY = '발급받은키'`
  4. `callCloudInpaint()` 함수에 해당 API 구현 (imageDataUrl, maskDataUrl 입력 / 결과 URL 반환)
- **로컬 서버 시작 명령:**
  ```
  pip install iopaint
  iopaint start --model=lama --device=cuda --port=8080 --cors-allowed-origins="*"
  ```

## 2026-05-28 | v4.5 — IOPaint API 요청 형식 수정 (multipart → JSON)

- **변경 파일:** `canvas-editor.html`
- **버그 원인:** `multipart/form-data` + 바이너리 Blob 전송 → IOPaint가 UTF-8 텍스트로 파싱 시도 → `UnicodeDecodeError` HTTP 500
- **수정:** `FormData` 제거, `Content-Type: application/json` + base64 문자열 전송으로 변경
  - `imageDataUrl.split(',')[1]` 으로 data URL 헤더 제거 후 base64만 추출
  - IOPaint 필수 파라미터 포함: `ldmSteps`, `hdStrategy`, `hdStrategyCropMargin` 등
- **결과:** 동작 확인 ✅

## 2026-05-28 | v1.0 — step1-form.html 간판 종류 선택 (SVG 건물 일러스트)

- **변경 파일:** `step1-form.html` (신규 생성)
- **변경 내용:** 간판 종류 선택 Step 1 페이지. 텍스트 카드 대신 SVG 건물 일러스트에서 직접 클릭.
- **주요 기능:**
  - 2.5D 스타일 건물 SVG 일러스트 (정면 + 우측 사이드 + 지붕 원근감)
  - 5개 클릭 영역: 전면간판, 어닝간판, 돌출간판, 지주형간판, 실내간판
  - 호버 → 반투명 컬러 오버레이 + 툴팁 레이블 표시
  - 클릭 → `.selected` 클래스 유지 + 하단 정보 박스 슬라이드업 + 다음 버튼 등장
  - 선택값 `localStorage.setItem('signType', ...)` 저장 → Step 2 연결 준비 완료
  - 4단계 진행 스텝바 상단 표시
  - 완전 반응형 (SVG viewBox 기반)

## 2026-05-28 | v1.1 — step1-form.html 실사 이미지 + clip-path 존 오버레이

- **변경 파일:** `step1-form.html` (전면 재작성)
- **변경 내용:** SVG 일러스트 → `cafe-illustration.jpg` 실사 이미지로 전환. 이미지 위에 CSS clip-path 다각형 존 오버레이 방식 적용.
- **핵심 기술:**
  - `.building-wrap` relative 컨테이너 + `.zone` absolute 포지셔닝, 모든 좌표 `%` 단위 (반응형)
  - `clip-path: polygon()` 으로 이미지 내 실제 간판 모양에 맞춘 비직각 영역 구현
  - CSS custom property `--hc`, `--bc`, `--bc-a` 를 존별 inline style에 지정 → CSS rules에서 `var()` 참조
  - 항상 테두리+배경 표시 (`opacity: 0.55` 기본 → 호버/선택 시 `opacity: 1`)
  - 좌표 실측용 디버그 툴: `mousemove` 이벤트로 `left%/top%` 실시간 표시
  - 좌표 변환 공식: 이미지 % 좌표 → div bbox 기준 polygon % 좌표
    `div_x = (img_x - bbox_left) / bbox_width * 100`
- **존별 형태:**
  - 전면간판: 평행사변형 polygon (등각 투영 원근감)
  - 어닝간판: 6점 polygon (경사진 천막 형태)
  - 돌출간판: `border-radius: 50%` 원형
  - 지주형간판: 직사각형
  - 실내간판: 2개 소형 polygon (좌측 쇼윈도, 우측 OPEN 사인)
- **selectType(type) 통합 핸들러:** 존 클릭 / 외부 라벨 클릭 / 플로팅 라벨 클릭 모두 동일 함수 호출

## 2026-05-28 | v1.2 — step1-form.html 실내간판 플로팅 라벨 + 이미지 하단 외부 라벨

- **변경 파일:** `step1-form.html`
- **변경 내용:** 작은 실내간판 존에서 라벨 가시성 문제 해결. 이미지 하단에 전체 5종 외부 라벨 추가.
- **문제:** `clip-path`가 자식 요소도 clip → 실내간판 zone-tag 가 잘려 안 보임. 영역 자체도 3.9% 너비로 매우 좁아 텍스트 표시 불가.
- **해결:**
  - `.indoor-float-tag`: zone div의 **형제** 요소로 존 아래에 별도 배치 (clip-path 영향 없음)
  - `data-for="indoor-a/b"` 속성, 클릭 시 `selectType('실내간판')` 호출
  - `.below-labels` 행: 이미지 하단에 5종 라벨 나열, 각각 존과 동일한 색상 테마 적용
  - 외부 라벨도 클릭 시 `selectType()` 호출 → 존 선택과 완전 동기화

## 2026-05-29 | v1.7 — step1-form.html 어닝간판 라벨 위치 조정

- **변경 파일:** `step1-form.html`
- **변경 내용:** 어닝간판 zone-tag 위치 수정. 기본 중앙(50%,50%)에서 좌측 상단(28%,22%)으로 이동.
- **이유:** 라벨이 어닝 천막에 적힌 상호명("간판의 품격") 텍스트를 가리는 문제 해결.

## 2026-05-29 | v1.6 — step1-form.html 실내간판 플로팅 라벨 개선 + 호버 연동

- **변경 파일:** `step1-form.html`
- **변경 내용:** 실내간판 플로팅 라벨 텍스트 및 호버 연동
- **변경 목록:**
  - 플로팅 라벨 텍스트: `실내` → `실내간판`
  - `.zone.lit` CSS 클래스 추가 (`:hover`와 동일한 스타일)
  - `.indoor-float-tag` mouseenter/mouseleave 이벤트 → `.zone-indoor` 전체에 `.lit` 토글
  - 플로팅 라벨에 마우스 올리면 실내간판 존 2개가 동시에 하이라이트됨

## 2026-05-29 | v1.5 — step1-form.html 디버그 요소 제거 + 존 호버 시만 표시

- **변경 파일:** `step1-form.html`
- **변경 내용:** 개발용 디버그 요소 제거. 존 영역은 기본 투명, 호버/터치/선택 시만 표시.
- **제거:**
  - `coordDisplay` div (마우스 좌표 overlay) HTML에서 제거
  - `mousemove` / `mouseleave` 좌표 출력 JS 제거
- **CSS 변경:**
  - 기본: `border-color: transparent; background: transparent` (opacity 건드리지 않음 → zone-tag 항상 표시)
  - 호버: `border-color: var(--bc); background: var(--hc)` + `transition .2s`
  - 선택: 호버와 동일 (선택 유지)
  - `opacity: 0` 방식 불채택 이유: CSS opacity는 자식 요소에 상속되어 zone-tag도 같이 사라짐

## 2026-05-29 | v1.4 — step1-form.html 선택 정보박스 + 버튼 이모티콘 제거

- **변경 파일:** `step1-form.html`
- **변경 내용:** 간판 선택 시 나타나는 infoBox와 다음 버튼에서 이모티콘 완전 제거
- **변경 목록:**
  - `infoBox` 내 `.info-icon` div 요소 및 관련 CSS 제거
  - `selectType()` 에서 `infoIcon.textContent = info.icon` 라인 제거
  - 버튼 텍스트: `${info.icon} ${info.title} 선택 완료 → ` → `${info.title} 선택 완료 →` (이모티콘 제거)
  - INFO 객체의 `icon` 필드는 코드에 남겨두되 UI에 출력하지 않음

## 2026-05-28 | v1.3 — step1-form.html 라벨 이모티콘 전체 제거

- **변경 파일:** `step1-form.html`
- **변경 내용:** 모든 zone-tag, indoor-float-tag, ext-label 에서 이모티콘 제거. 텍스트만 표시.
- **변경 목록:**
  - zone-tag: `☂️ 어닝간판` → `어닝간판`, `📌 돌출간판` → `돌출간판`, `🚩 지주형간판` → `지주형간판`
  - ext-label: `🏢` `☂️` `📌` `🚩` `🪟` 모두 제거
  - (INFO 객체 내 icon 필드는 infoBox에서만 사용하므로 유지)

---

## 핵심 아키텍처 결정 — 프롬프트 시스템 (2026-05-29 확정)

고객 선택값은 단순 페이지 이동용이 아니라 **AI 이미지 생성 프롬프트를 결정하는 인덱스**로 사용됨.

### 동작 방식
- Step 1~3에서 고객이 선택한 값들을 `localStorage`에 계속 **누적 저장**
- 최종 Step에서 선택값 조합으로 **미리 세팅된 프롬프트 라이브러리**에서 해당 템플릿 조회
- 동적 프롬프트 생성 ❌ → 사전 제작 프롬프트 조회 ✅ (퀄리티 일관성 보장)

### localStorage 누적 구조
```js
localStorage.setItem('signType',   '전면간판')   // Step 1
localStorage.setItem('material',   '채널사인')   // Step 2
localStorage.setItem('finish',     'LED 백라이트') // Step 2
localStorage.setItem('width',      '300')         // Step 3 (cm)
localStorage.setItem('height',     '50')          // Step 3 (cm)
localStorage.setItem('signText',   '간판의 품격') // Step 3
```

### 프롬프트 매핑 구조 (추후 구현)
```js
PROMPT_MAP["전면간판"]["채널사인"]["LED 백라이트"]
  → base prompt (개발자가 정교하게 세팅)
  + 사이즈·문구 동적 삽입
  → Flux Pro API 호출
```

### 핵심 원칙
- 프롬프트 퀄리티는 **개발자가 미리 세팅**한 것에서 나옴
- 고객 선택은 "어떤 프롬프트를 쓸지" 결정하는 키 역할
- LLM(GPT-4o-mini)은 프롬프트를 생성하는 게 아니라 선택값을 **프롬프트에 자연스럽게 합성**하는 용도로만 사용 가능

---

## 2026-05-29 | v1.0 — step2-material.html 간판 상세종류 + 시공방식 선택

- **변경 파일:** `step2-material.html` (신규 생성), `step1-form.html` (goNext 연결)
- **변경 내용:** Step 1 선택값(signType)에 따라 해당 간판의 세부종류를 카드로 표시. 조건부 시공방식 섹션 포함.
- **데이터 구조:**
  - `SUBTYPES` 객체: 5개 간판 종류별 세부 항목 배열 (id, name, img, desc)
  - `INSTALL_DATA` 배열: 시공방식 4종 (전면프레임, 프레임바, 맨벽, 파사드)
  - `NEEDS_INSTALL`: 시공방식 필요 세부종류 = `['채널간판', '스카시간판']` (전면간판 한정)
- **카드 그리드:**
  - `GRID_COLS` 맵으로 간판 종류별 컬럼 수 다르게 설정 (전면4, 돌출4, 어닝3, 지주2, 실내4)
  - `applyMobileCols()`: 뷰포트 너비 변화 시 컬럼 수 자동 보정 (480px↓=2col, 720px↓=min(base,3))
  - 카드 이미지: `img/step2/간판종류-세부종류.jpg` 경로, onerror 시 텍스트 placeholder 표시
- **ⓘ 설명 토글:**
  - 카드 헤더 우측 ⓘ 버튼 클릭 → `card-desc` max-height 트랜지션으로 슬라이드 오픈/클로즈
  - `e.stopPropagation()`으로 카드 선택 이벤트 방지
- **시공방식 섹션:**
  - 기본 숨김, 전면간판 + 채널/스카시 선택 시 `.show` 클래스 추가 → display:block + fadeUp 애니메이션
  - `scrollIntoView({ behavior: 'smooth' })`로 자동 스크롤
  - 시공방식 미선택 시 다음 버튼 미표시 (필수 선택)
- **localStorage 저장:** `signSubType`, `installMethod`(조건부)
- **step1 연결:** `goNext()` alert 제거 → `window.location.href = 'step2-material.html'`
- **이미지 폴더:** `img/step2/` 생성 (파일명 규칙: `간판종류-세부종류.jpg`)
- **시공방식 카드 이미지 추가:** `전면프레임.JPG`, `프레임바.JPG`, `맨벽.JPG`, `파사드.JPG` — 세부종류 카드와 동일한 다크 스타일 카드로 통일
- **카드 토글 선택:** 이미 선택된 카드 재클릭 시 선택 해제 + 설명 패널 닫힘
- **설명 패널 분리 (v1.1 개선):** card-desc(카드 내부 확장) → `.desc-panel`(그리드 아래 별도 패널)로 변경
  - 이유: card-desc 방식은 CSS Grid row 높이 일치 특성으로 같은 줄 카드들이 같이 늘어나는 문제
  - `align-items: start` 추가로 카드 높이 독립 유지
  - 선택 시 패널에 이름+설명 업데이트, 해제 시 패널 숨김
- **ⓘ 버튼 제거:** 카드 클릭으로 설명 표시되므로 불필요
- **scrollIntoView 제거:** 시공방식 섹션 등장 시 자동 스크롤 제거 → 자연스러운 UX
- **모바일 설명 패널 위치 개선:** PC는 그리드 아래 고정, 모바일(≤720px)은 선택 카드 행 바로 아래 삽입
  - `positionDescPanel(cardEl)`: getBoundingClientRect().top 비교로 같은 행 카드 감지 → 마지막 카드 뒤에 DOM 이동
  - `resetDescPanel()`: 패널을 그리드 밖으로 복원 + show/in-grid 클래스 제거
  - `.desc-panel.in-grid`: `grid-column: 1 / -1`로 전체 너비 차지

## 2026-05-29 | v1.1 — step2-material.html UX 개선 모음

- **변경 파일:** `step2-material.html`
- **변경 내용:**
  - **뒤로가기 3종:** `← 이전 단계` 버튼 + 브레드크럼 `전면간판` 클릭 + 스텝바 1번 클릭 → `goBack()` → step1-form.html
  - **모바일 플로팅 버튼:** 720px 이하에서 `다음 단계로` 버튼이 `position: fixed; bottom:0`으로 화면 하단 고정. slideUp 애니메이션. main에 `padding-bottom: 70px` 추가.
  - **모바일 시공방식 바로가기:** 모바일 + 전면간판 채널/스카시 선택 시 설명 패널 하단에 `시공 방식 선택 바로가기` 링크 표시 → `scrollToInstall()` smooth scroll
  - **카드 이미지 비율:** `aspect-ratio: 1/1` (정사각형), `object-fit: cover`, `object-position: top` — 균일한 높이 유지 + 윗부분 우선 표시
  - **step2 라벨:** 스텝바 "소재 · 방식" → "간판 상세 종류" (step1, step2 모두)

## 다음 개발 예정
- [ ] Step 3 — 사이즈 · 문구 입력 (step3-size.html)
- [ ] 나머지 간판 종류 img/step2/ 사진 추가 (돌출/어닝/지주/실내)

---

## [보류] AWS EC2 인페인팅 서버 이전

- **목적:** 개발 완료 후 서비스 오픈 시, 로컬 IOPaint → AWS EC2로 이전하여 24시간 운영
- **서버:** 기존 메인홈페이지 운영 중인 EC2 t3.small (2GB RAM, LaMa 구동 가능)
- **방법:**
  1. EC2에 SSH 접속 → `pip3 install iopaint`
  2. systemd 서비스 등록 (자동 재시작)
  3. AWS 보안그룹 8080 포트 오픈
  4. 코드에서 `LOCAL_ENDPOINT: 'http://EC2_IP:8080'` 으로 변경
- **미확인 사항:** EC2 OS (Amazon Linux vs Ubuntu) → 확인 후 설치 명령어 확정
- **비용:** 추가 없음 (기존 서버 활용)
- [ ] Step 2 — 백엔드 프롬프트 확장 API (`/api/generate`) 연동
- [ ] Step 3 — Flux Pro + RMBG API 파이프라인
- [ ] Step 4 확장 — `addSignFromURL(url)`에 AI 생성 결과 자동 연결
- [ ] 캔버스 스냅샷 저장 (toDataURL) + Supabase JSON 저장
- [ ] 모바일 터치 지원 (Pinch-zoom, 두 손가락 회전)
