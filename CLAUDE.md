# 프로젝트 지시사항 — AI 간판 시안 시스템

## 필수 규칙: 개발노트 자동 갱신
**코드 파일(html/js/css/py 등)을 수정하고 해당 작업이 완료될 때마다, 반드시 `DEV_NOTES.md`를 업데이트할 것.**
사용자가 요청하지 않아도 자동으로 기록. 절대 빠뜨리지 말 것.

기록 형식:
```
## [날짜] vX.X — 작업 제목
- 변경 파일: 파일명
- 변경 내용: 무엇을 왜 바꿨는지 (기술적 원인 포함)
- 주요 기능: 추가/수정된 기능 목록
```

## 프로젝트 개요
간판 중개 플랫폼용 AI 기반 한국형 간판 시안 생성 & 편집 시스템.
- BM: 시안 1회 생성 1,000원 / 원가 ~100원 / 마진 ~90%
- 핵심: 오브젝트 생성 AI(Flux Pro + LoRA) + 웹 캔버스(Fabric.js) 하이브리드

## 아키텍처 요약
- Step 1: 유저 입력 (간판 종류/사이즈/문구)
- Step 2: 결제 → LLM 프롬프트 확장 (GPT-4o-mini or Claude Haiku)
- Step 3: Flux Pro + Custom LoRA → RMBG 누끼 → 투명 PNG 리턴
- Step 4: Fabric.js 캔버스 — 건물 사진 + 간판 PNG 레이어 편집 **(현재 개발 중)**

## 인프라
- 로컬 학습: HP OMEN 16 (RTX 4060/4070) — Kohya_ss LoRA 학습
- 클라우드 서비스: Replicate 또는 Fal.ai (종량제)
- 개발 PC: i5-9400F / RAM 16GB / GTX 1050 Ti

## 현재 작업 파일
- `canvas-editor.html` — Fabric.js 편집기 메인 (Step 4)
