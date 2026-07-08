# 프로젝트 지시사항 — AI 간판 시안 시스템

## 필수 규칙 1: 회귀 점검 (`python check.py`)
매 수정마다 돌릴 필요는 없음(과투입). 다음 시점에만 실행:
- **커밋 직전** (필수)
- **페이지 간 연결부**(localStorage 키, API 계약, 이동 경로)를 건드렸을 때
- 임시 차단/게이트 코드를 심거나 제거했을 때
FAIL이 있으면 완료 보고 금지. 새 연결점을 만들면 check.py에 항목 추가.

## 필수 규칙 2: 개발노트 자동 갱신
**코드 수정 작업이 완료될 때마다 `DEV_NOTES.md`를 업데이트할 것.** (요청 없어도 자동)
```
## [날짜] vX.X — 작업 제목
- 변경 파일 / 변경 내용(왜) / 주요 기능
```

## 필수 규칙 3: 커밋·푸시는 사용자가 시킬 때만
"커밋해줘"라고 명시했을 때만 커밋. 임의 커밋/푸시 금지.

## 필수 규칙 4: API 키
키는 `.env`에만 (GEMINI_API_KEY, REPLICATE_API_TOKEN). 코드·채팅·깃에 키 입력 금지.
키 입력은 사용자가 직접 한다.

## 프로젝트 개요
간판 중개 플랫폼용 AI 한국형 간판 시안 생성 시스템.
- BM: 시안 1회(주간+야간 2장) 1,000원 / 원가 ~200원 (장당 ~100원) / 마진 ~80%
- 핵심: **Gemini 이미지 모델로 건물사진에 간판을 통째로 photoreal 생성** (한글 정확)

## 현행 아키텍처 (2026-06 확정)
- step1-form.html: 간판 종류 선택 → localStorage `signType`
- step2-material.html: 상세종류·시공방식 → `signSubType`(escId 변환값), `installMethod`
- step3-size.html: 사이즈(cm) 또는 건물사진 업로드+간판영역 지정+기존간판 지우기(Gemini 인페인팅)
  → `signWidth/Height` 또는 `signRatio`, `signBox`(0~1 좌표), `buildingPhoto`(압축)
- step4-design.html: 세밀 디자인(요소 빌더·글자별 색·재질·글씨체·두께·발광·로고·참고이미지)
  → POST /api/generate → 주/야 2장 오버레이 표시(토글·저장)
- server.py (Flask :5000): **프롬프트 컴파일러**(선택값→정밀 영문 프롬프트, 종류별 스키마 분기)
  + Gemini REST 호출(모델: gemini-3.1-flash-image) + /api/erase 인페인팅
- 실행: `start-dev.bat` 더블클릭 (백엔드 :5000 + 프론트 :3000)
- 검사: `python check.py` (JS문법·스토리지계약·게이트잔재·전조합 컴파일·유닛)

## 폐기된 방향 (다시 꺼내지 말 것)
- Flux Pro + LoRA 학습, ControlNet canny, kontext 픽셀보존 → 전부 Gemini로 대체됨
- 절차적 WebGL 글자 렌더 → 데모(proto-channel.html)만 남음

## 잔여 과제 (DEV_NOTES 참조)
- canvas-editor 위저드 연동 휴면 상태 / Tab1(사진 없는 cm 입력) 경로 생성 불가
- step4 UI 종류별 메뉴 분기 / OCR 자동검증+재생성 / 결제
