## 개요

이 프로젝트는 **간판 시뮬레이션/브랜딩 스튜디오**입니다.  
사용자는 건물 외관 사진을 업로드하고, 간판 영역을 지정한 뒤 텍스트/이미지/조명 옵션을 설정하면, 백엔드 AI 엔진이 간판 시뮬레이션 이미지를 생성합니다.  
또한 AI 브랜딩 기능으로 상호명, 간판 스타일, 컬러 팔레트, 로고까지 자동으로 제안·생성할 수 있습니다.

- **프론트엔드**: `signboard-frontend` (React + Tailwind UI)
- **백엔드**: `signboard-backend` (FastAPI + OpenCV/PIL + pix2pix + OpenAI)

---

## 전체 동작 흐름

1. 사용자가 프론트엔드에서 **건물 사진 업로드 및 간판 영역(다각형/사각형) 지정**
2. 각 간판별로 **텍스트/로고/배경색/글자색/폰트/조명 옵션** 입력
3. 프론트엔드 `App.js`가 모든 간판 정보를 **JSON + base64 이미지** 형태로 정리하여  
   백엔드 `/api/generate-simulation`(필요 시 `/api/generate-hq`) 엔드포인트로 `FormData` 전송
4. 백엔드 `main.py`가:
   - 건물 사진 및 간판 영역을 OpenCV/PIL로 파싱
   - 필요한 경우 pix2pix 기반 `SignboardAIEngine`을 통해 간판 영역 변환
   - 주간/야간 시뮬레이션 이미지와 관련 메타데이터를 생성
5. 생성된 이미지를 base64로 응답 → 프론트엔드 `ResultViewer`에서 렌더링
6. 사용자는 추가로 **평면도(치수 포함) 생성**을 요청하면 `/api/generate-flat-design`을 호출하여  
   간판 평면도 이미지를 받아볼 수 있습니다.

AI 브랜딩 탭에서는 `ai_branding.py`의 `AIBrandingSystem`을 통해:

1. 업종/분위기/타깃 정보를 기반으로 **상호명 후보 리스트** 생성
2. 선택된 상호명에 대해 **간판 스타일 코드(channel/flex/neon 등)와 색상 조합 추천**
3. 선택된 컬러 팔레트로 **로고 이미지를 DALL-E를 통해 생성**

---

## 프론트엔드 (signboard-frontend)

### 1. 루트 컴포넌트 `App.js`

- **역할**
  - 상단 탭 전환 (`시안 제작` / `AI 브랜딩`)
  - 간판 목록 및 현재 활성 간판 상태 관리
  - 건물 이미지/간판 영역/조명/생성 결과 등 **전역 상태** 관리
  - 백엔드 API 호출 로직 집약

- **주요 상태**
  - `activeTab`: 현재 탭 (`signboard` | `branding`)
  - `buildingImage`: 업로드한 건물 사진 (`File`)
  - `signboards`: 복수 간판 상태 배열  
    - 각 원소: `{ id, name, selectedArea, formData }`
    - `selectedArea`: 폴리곤/사각형 영역 정보
    - `formData`: 간판 옵션(텍스트, 배경색, 글자색, 폰트, 회전, 플립 등)
  - `lights`, `lightsEnabled`: 조명 정보 및 on/off 상태
  - `results`: 백엔드에서 받은 시뮬레이션/평면도 결과
  - `loading`, `loadingPhase`, `loadingProgress`: 생성 진행 상태

- **핵심 로직**
  - `handleGenerate(mode: 'basic' | 'ai')`
    - 유효성 검사 (건물 사진, 간판 존재 여부, 각 간판의 영역/텍스트/이미지 유효성)
    - `imageToBase64`로 건물/로고/간판 이미지를 base64로 변환
    - 각 간판을 `signboardsPayload` 배열(JSON)로 직렬화
    - 백엔드 **기존 시그니처 호환**을 위해 첫 간판 정보는 개별 필드로도 전송
    - `/api/generate-simulation` 호출 후 결과를 `results`에 저장
    - `mode === 'ai'`일 때 `/api/generate-hq`를 추가 호출하여 고품질 이미지로 대체
  - `handleFlatDesignGenerate(mode = 'day')`
    - 현재 활성 간판 하나에 대해 평면도 생성 요청
    - `/api/generate-flat-design` 호출
    - 응답의 `design_only`, `with_context`, `dimensions`를 `results`에 병합
  - `useEffect`를 이용한 **자동 생성/조명 반영**
    - `lightsEnabled` 변경 시 자동으로 `handleGenerate('basic')` 재호출
    - `lastUserEdit` debounce(600ms) 후 자동 시뮬레이션 재생성

### 2. 주요 컴포넌트

- `ImageUploader`
  - 건물 사진 업로드 및 간판 영역 선택(드래그/폴리곤)
  - 선택된 영역을 `selectedArea`로 상위(App)에게 전달

- `SignboardForm`
  - 현재 선택된 간판의 **옵션 편집 폼**
  - 텍스트/폰트/색상/조명/치수 등 폼 입력값을 `formData`로 상위(App)에 전달

- `ResultViewer`
  - 백엔드 응답으로 받은 이미지들을 탭/토글 형식으로 보여줌
  - 주간/야간 시뮬레이션, AI 고품질 이미지, 평면도(배경 포함/제외) 등을 표시
  - 조명 편집/재생성, 변형 값(폰트 크기/위치/회전) 조정 후 재생성 등의 인터랙션 제공

- `AIBrandingTab`
  - 업종/분위기 등 입력을 받아 AI 브랜딩 API 호출
  - 상호명 목록/스타일 추천/색상 팔레트/로고 이미지를 보여주고,  
    선택 결과를 저장(`savedBrandings`)하거나 간판 탭으로 넘기는 역할

---

## 백엔드 (signboard-backend)

### 1. `main.py` – FastAPI 엔트리포인트

- **프레임워크 및 미들웨어**
  - `FastAPI` 애플리케이션 생성 (`app = FastAPI()`)
  - CORS 설정: `http://localhost:3000`, `http://127.0.0.1:3000` 허용

- **외부 의존성**
  - 이미지 처리: `cv2(OpenCV)`, `numpy`, `PIL`
  - 로깅: `logging`
  - AI 브랜딩: `AIBrandingSystem` (`ai_branding.py`, 선택적)
  - 시뮬레이션 엔진: `SignboardAIEngine` (`pix2pix_inference.py`, 선택적)

- **핵심 유틸 함수 (예시)**
  - `base64_to_image`, `base64_to_image_pil`
    - 프론트에서 받은 base64 이미지를 OpenCV/PIL 이미지로 변환
  - 간판 영역/폴리곤 파싱, 조명 정보 적용, 전·후광/측면광 시뮬레이션을 위한  
    여러 보조 함수들(파일 상단~중단부에 다수 존재)

- **주요 엔드포인트**
  - `POST /api/generate-simulation`
    - **입력**
      - `building_photo`: 건물 사진 (base64)
      - `polygon_points`: 첫 간판 영역 좌표(JSON)
      - `signboard_input_type`: `'text' | 'image'`
      - `text`, `logo`, `logo_type`
      - `signboard_image`
      - `installation_type` (설치 위치 타입: 맨벽/입면 등)
      - `sign_type` (간판 종류: 전광채널 등)
      - `bg_color`, `text_color`, `text_direction`
      - `font_size`, `font_family`, `font_weight`
      - `text_position_x`, `text_position_y`
      - `orientation`, `flip_horizontal`, `flip_vertical`, `rotate90`, `rotation`
      - `remove_white_bg`
      - `lights`, `lights_enabled`
      - `signboards`: 복수 간판 정보(JSON 배열, 위와 동일한 필드 구조)
    - **로직 개요**
      - base64 → 이미지 변환
      - 각 간판별 영역을 잘라내거나 투영 변환(perspective transform)
      - 텍스트/로고를 합성하고, 조명/야간 효과를 입힘
      - pix2pix 엔진이 활성화되어 있으면 학습된 모델을 사용해 간판 영역을 변환
      - 최종적으로:
        - `day_simulation`: 주간 시뮬레이션
        - `night_simulation`: 야간 시뮬레이션
        - 텍스트/간판 크기 정보(폭/높이 등)를 포함한 JSON 응답
  - `POST /api/generate-hq`
    - Phase 1에서 만든 결과를 바탕으로 **고품질(AI 보정) 버전**을 생성
    - 성공 시 `ai_image`와 처리 시간 등을 함께 반환
  - `POST /api/generate-flat-design`
    - **평면도(정면 투영 + 치수선 포함)** 이미지를 생성
    - 입력은 단일 간판 기준(현재 활성 간판)
    - `design_only` (흰 배경 + 간판만),  
      `with_context` (건물 외벽 포함),  
      `dimensions` (mm 단위 치수 정보) 반환
  - `GET /`
    - API 상태와 사용 가능한 엔드포인트 목록, `ai_branding` 사용 가능 여부를 반환

### 2. `ai_branding.py` – AI 브랜딩 시스템

- **클래스**: `AIBrandingSystem`
- **환경 변수**
  - `OPENAI_API_KEY` 필수
- **사용 모델**
  - 텍스트: `gpt-4o-mini` (ChatCompletion API)
  - 이미지: `dall-e-3`

- **주요 메서드**
  - `generate_business_names(industry, mood, target_customer, count)`
    - 업종/분위기/타깃을 받아 **상호명 후보 리스트**를 JSON으로 반환
    - 프롬프트에서 실제 간판 제작 가능성, 업종 연상, 글자 수 제한 등 세부 규칙을 엄격하게 지정
  - `suggest_signboard_style(name, industry)`
    - 상호명 + 업종을 보고
      - `recommended_style` (내부 코드)
      - `style_name` (한글명)
      - `reason` (추천 이유)
      - `color_bg`, `color_text`
      - `alternative`, `confidence`
      - 을 JSON으로 반환
  - `generate_brand_colors(business_name, industry, mood)`
    - 메인/텍스트/포인트 색상과 각 색의 이름, 대비 점수 등을 JSON으로 반환
  - `generate_logo(business_name, industry, mood, colors)`
    - DALL-E 3를 이용해 **간판용 로고 아이콘 이미지**를 base64로 생성
    - 색상 팔레트를 받아 2색(flat) 스타일의 심볼을 생성

---

## 데이터 구조 요약

- **간판 단위 상태 (`signboards` 배열의 각 원소)**
  - `id`: 고유 ID
  - `name`: 리스트 표시용 이름
  - `selectedArea`:
    - `{ type: 'polygon', points: [{x, y}, ...] }`
    - 또는 `{ type: 'rect', x, y, width, height }`
  - `formData`:
    - `signboardInputType`: `'text' | 'image'`
    - `text`, `logo`, `logoType`
    - `signboardImage`
    - `installationType`, `signType`
    - `bgColor`, `textColor`, `textDirection`
    - `fontSize`, `fontFamily`, `fontWeight`
    - `textPositionX`, `textPositionY`
    - `orientation`, `flipHorizontal`, `flipVertical`
    - `rotate90`, `rotation`
    - `removeWhiteBg`
    - (평면도용) `width_mm`, `height_mm`

- **백엔드 시뮬레이션 응답 (`results`)**
  - `day_simulation`: base64 이미지 (주간)
  - `night_simulation`: base64 이미지 (야간)
  - (AI 모드) `ai_image`, `basic_day_simulation`, `basic_night_simulation`, `processing_time`
  - (평면도)  
    - `flat_design`, `flat_design_only`, `flat_design_with_context`, `flat_design_dimensions`
  - 텍스트/간판 크기 정보: `text_width`, `text_height`, `signboard_width`, `signboard_height` 등

---

## 정리

이 프로젝트의 핵심은 **프론트엔드에서 간판/조명/브랜딩 옵션을 풍부하게 편집**하고,  
이를 **백엔드의 이미지 처리 + AI 엔진에 정확한 형식(JSON + base64)으로 전달**하여  
현실감 있는 시뮬레이션과 브랜딩 자산(상호명/스타일/컬러/로고)을 자동으로 생성하는 것입니다.  
프론트엔드는 상태·UI·사용자 경험에 집중하고, 백엔드는 이미지 합성/투영/조명/AI 모델 호출에 집중하도록 역할이 분리되어 있습니다.

