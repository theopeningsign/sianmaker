# DEV_NOTES — AI 간판 시안 시스템 개발 노트

> 대화 압축/초기화 시에도 개발 맥락을 유지하기 위한 기록.
> 코드 변경 완료 시마다 자동 갱신됨.

---

## 2026-07-08 | step4 입력 UI 종류별 리뉴얼 — 비발광 간판에 발광 메뉴 뜨던 모순 해소

- **문제:** UI가 채널 기준 고정이라 스카시(자체발광 불가)에도 전면/측면/후광 메뉴가 전부 노출.
- **수정:** server.py SUBTYPES 스키마를 step4에 미러링(SUBTYPE_CAPS) — 종류별 메뉴 분기:
  - 채널: 전면/측면/후광 3종 + 옆면색·두께·재질 (기존 그대로)
  - 스카시·금속: 발광방식 → **"후광(백라이트)" 하나만** ("자체발광 없음" 안내 문구)
  - 네온·플렉스·포인트·큐브·조형물: 발광방식 숨김(항상 발광), 옆면색·두께·재질 숨김
  - 스텐실·패브릭·현판·어닝(고정/접이/기타): 입체·발광 카드 통째 숨김
  - 옆면색 블록은 입체 글자형(sides)에만, 평면 종류는 "글자 색상"으로 라벨 변경
  - 미리보기도 동일 분기(평면=두께스택 없음, 네온/박스=항상 글로우, 비발광=글로우 없음)
- **검증:** check.py 21/21 PASS + caps 분기 10케이스 시뮬레이션 정확.

## 2026-07-07 | 돌출간판 "사진 붙여넣기(인셋)" 버그 수정

- **증상:** 돌출간판 생성 시 장면에 설치되지 않고, 예시 콜라주풍 사진(다른 하늘 배경째)이 화면 구석에 액자처럼 합성됨.
- **원인 3가지:** ① SIGN_KIND 돌출 서술의 "측면 각도로 보여줘라"를 별도 컷 삽입으로 해석 ② placement의 "사각형을 가득 채워라"가 돌출간판(벽면을 채우는 물건이 아님)에선 '사진 끼우는 틀'로 오해 ③ 예시 콜라주 가드에 "사진 자체 붙여넣기 금지"가 없어 배경째 복붙.
- **수정:** ① 돌출 서술 재작성 — "이 사진의 카메라 시점 안의 실물로, 패널은 벽과 수직·단축(foreshortened) 3/4 각도, 벽과 평행 금지" ② placement 분기 — 돌출/지주는 "사각형은 위치 표시일 뿐, 실물 스케일로 설치" ③ 콜라주 가드에 "콜라주·그 배경/하늘을 붙여넣거나 인셋 금지" ④ AVOID에 picture-in-picture·붙여넣은 사진 조각 추가 + 셀프체크에 "장면 속 실물, 인셋 아님" 항목.
- **검증(2회 생성, ~400원):** 1차 수정 후 인셋은 사라졌으나 패널이 벽과 평행하게 부착됨 → 방향 잠금 강화 후 **정상**: 건물 모서리에 수직 돌출·브래킷·단축 3/4 뷰·야간 발광+벽 반사·주간 소등 동일 위치. 한글 정상.

## 2026-07-07 | 전범위 검수 (전 파일 통독) — 버그 4건 수정 + check.py 도입

- **검수 범위:** step1~4·canvas-editor·server.py 전체 통독, 페이지 간 localStorage 계약, API 계약, 전 조합.
- **수정 1 — step3 "준비 중" 관문 제거:** 채널·맨벽만 통과시키던 옛 임시코드가 남아 다른 조합을 막고 있었음(백엔드는 전 종류 지원인데). 전 조합 step4 진입으로.
- **수정 2 — `현판/표찰` 실사례 매칭 버그:** step2는 escId 변환값(`현판_표찰`)을 저장하는데 서버가 `_` 미처리 → 콜라주 매칭 실패. server example_dataurl에 `_` 제거 추가.
- **수정 3 — Tab1(직접 cm) 경로의 옛 사진 잔존 버그:** 사이즈만 입력해도 이전 세션의 buildingPhoto/signBox가 남아 **옛 건물사진으로 생성될 수 있었음**. 이 세션에 사진 있으면 저장, 없으면 두 키 제거.
- **수정 4 — 지우기 저해상도 강등 버그:** 지우기가 표시 캔버스(≤672px) 해상도로 결과를 만들어 건물사진 품질 하락 → 원본 해상도(긴 변 1568px 상한)로 지우도록 수정(마스크는 확대 매핑).
- **step4 제목 동적화:** 하드코딩("전면간판·채널간판·맨벽") → 실제 선택 조합 표시.
- **check.py 신설:** 회귀 점검 스크립트(JS문법 5p·스토리지 계약·게이트 잔재·전 조합 25종 컴파일+마커+실사례·유닛 4종). 조합표는 step2 실제 저장 ID 기준. **커밋 전/연결부 수정 시 실행** (CLAUDE.md 규칙화 — 매 수정마다는 과투입이라 제외). 현재 21/21 PASS.
- **CLAUDE.md 현행화:** 폐기된 Flux+LoRA 아키텍처 서술 → Gemini 현행 아키텍처로 교체. launch.json은 이 PC용(live-server :3031)으로 복원.
- **실생성 검증:** 집 버전 컴파일러로 주/야 세트 1회 생성(~200원) — 한글 정확·색 유지·맨벽·주야 일치·기존 시설물 제거 후 설치까지 전부 정상.
- **미수정 메모:** canvas-editor 위저드 연동 휴면(오버레이 방식 확정 시 정리 필요) / step2 카드 img가 소문자 .jpg 참조(파일은 .JPG — Windows OK, 리눅스 배포 시 404) / Tab1 사진 없음 경로는 생성 차단(정직한 에러로 동작).

## 2026-07-05 | 실사례 기반 구체화 — 예시 사진 투입 + 종류별 현실 치수

- **변경 파일:** server.py
- **★ 세부종류 실사례 사진을 Gemini 입력에 자동 첨부:** img/step2의 실제 시공 사진 콜라주(고객에게 보여주는 그 사진)를 마지막 입력 이미지로 전달 — "이 종류가 실제로 어떻게 생겼는지"를 텍스트가 아니라 실물로 학습시킴. 텍스트 서술만으로는 한계였던 시공 스타일(스카시 금속 질감, 큐브 발광감, 패브릭 드레이프)이 그라운딩됨.
  - 오염 가드: "제작 스타일·재질·장착·발광만 모방, 예시 속 텍스트/브랜드/로고/배색은 절대 복사 금지(무관한 가게들)" 명시.
  - example_dataurl(): signType+signSubType → img/step2 파일 자동 매핑(캐시), 25종 전부 존재 확인.
  - 이미지 순번 서술과 첨부 순서 일치(건물→로고→참고→예시).
- **종류별 현실 기본 치수 (사이즈 미입력 시):** 기존엔 무지시 → AI가 크기 임의 결정. 옥외광고물 규정·실무 관행 기반 TYPICAL SCALE 폴백:
  - 돌출 50–70cm·벽면 돌출 1m 이내(법규 명시), 큐브 40–50cm, 패브릭 45×60cm, 현판 30–45cm, 지주 3–5m, 어닝 레터 15–25cm, 전면 파스시아 높이 60–90cm.
  - 고객이 cm 입력 시엔 REAL-WORLD SIZE가 우선(TYPICAL 미출현 확인).
- **검증:** 예시 25종 매핑/순번/가드/치수 5건 + 회귀 40조합 전부 통과.

## 2026-07-05 | 한국 간판 제작 실무 재검증 — 시공 재료 정확화

- **변경 파일:** server.py
- **웹 재검증으로 확인한 한국 실무 표준:**
  - 채널 구조 = 바닥판+옆판(입체)+전면 캡. 캡형(전면발광)/오픈형/백릿형(후광) 분류 — 기존 front/halo 매핑 정확함 확인.
  - **채널 면 마감 = 아크릴에 컬러 반투명 시트 부착이 한국 표준** → 채널 CONSTRUCTION에 "film-on-acrylic, 완전 균일한 면색" 명시 (붓자국/얼룩 방지).
  - **전면프레임 = 갈바 각관 프레임 + 알루미늄복합판넬(ACP) 마감이 표준** → "solid backing panel" 두루뭉술 서술을 "ACP skin over steel tube frame, 평활 무광 균일면"으로 교체.
  - 파사드 = ACP/석재룩/우드룩 클래딩 감싸기로 구체화.
  - 입체캡(트림캡) 한국 채널에도 표준 부품 확인.
- **검증:** ACP/파사드/시트마감 3건 + 전 종류 40조합 회귀 통과.

## 2026-07-05 | 문장 단위 정독 — 섹션 간 충돌 6건 최종 정리

- **변경 파일:** server.py
- **수정:**
  1. 맨벽 MOUNT("NO backing panel") ↔ 로고 asis("flat printed panel") 문구 충돌 → "flat printed piece cut to the logo's outline".
  2. 참고이미지 ↔ 고객 재질 선택 충돌 시 우선순위 미지정 → "CONSTRUCTION/SIGN CONTENT가 우선" 명시.
  3. 주간변환: 고객 원본이 밤 사진인 엣지 → "원본이 밤이면 그 건물의 자연스러운 낮 모습을 추론" 절 추가.
  4. 채널 트림캡 디테일 추가(업계 표준 부품 — 면과 옆판을 잇는 몰딩).
  5. 갈색 색명: 어두운 주황(#8B4513 등 우드톤) 'orange' → 'brown'.
  6. RULE 1에 로고 존재 병기(텍스트만 최우선 규칙에 있었음).
- **검증:** 6건 개별 확인 + 전 종류 40조합 회귀 통과. 대표 프롬프트(채널+로고+참고, 야간) 5,712자.

## 2026-07-05 | 프롬프트 흐름 재감사 — 원본 참조 주간변환 등 4건

- **변경 파일:** server.py
- **★ 주간 변환에 고객 원본 사진 첨부 (건물 드리프트 방지):** 기존엔 야간 렌더 1장만으로 낮을 재생성 → 건물 디테일이 원본과 달라질 위험(고객: "우리 건물이 아닌데?"). 고객이 올린 원본(대부분 낮 사진)이 완벽한 레퍼런스인데 미사용이었음 → day 변환을 2이미지 구성으로: "#1=야간 렌더(간판 유지), #2=원본 사진(건물·벽·하늘 복원 레퍼런스)".
- **영문 상호 AVOID 오폭 수정:** 고객 문구에 영문 포함("CAFE 커피") 시 AVOID의 "romanized text, English translations"가 주문 내용까지 지우라는 모순 → 문구에 라틴문자 감지되면 해당 금지항목 자동 제외 + RULE 1 문구 전환.
- **채널 발광 미선택 기본값:** UI 기본값이 빈 배열 → "softly illuminated" 모호 문구로 나가던 것 → 채널 계열이면 실무 기본인 전면발광으로 간주.
- **빈 요소 결제 가드:** 문구도 로고도 없는 생성 요청 → 400 "문구 또는 로고가 없어요" (Gemini 호출 전 차단).
- **확인만 하고 수정 불필요:** erase 이미지는 표시 캔버스 크기 기준이라 이미 적정 / f-string 문법 Python 3.8 호환(triple-quote 내 단일따옴표는 3.8 유효).
- **검증:** 영문 오폭 3케이스·발광 기본값·가드 2종(가짜 키로 라우트 테스트)·전 종류 40조합 회귀 전부 통과.

## 2026-07-05 | 프롬프트 5회 반복 검수 — 용어 팩트체크 + 장면·평면 논리 정합

- **변경 파일:** server.py
- **R1 — 업계 용어 팩트체크 (웹 검증):**
  - "SCASI"는 영어에 없는 콩글리시(透かし 유래) → 미국 업계 정식 용어 **FLAT CUT-OUT (FCO) letters**로 교체.
  - 프레임바 → **raceway** (글자 길이만큼 벽에 붙는 좁은 금속 박스 — 업계 표준 용어).
  - 후광 → **reverse-channel / halo-lit** (글자를 벽에서 띄워 장착) 정식 명칭 병기.
  - 채널 두께에 실측 치수 병기 (업계 표준 returns 3~6인치 기반: 5/8/12/15cm+).
- **R2 — 장면·평면 논리 오류:**
  - **실내간판인데 "storefront 사진, 어스름 하늘·가로등"** → 실내 사진 서술 + "실내 조명을 저녁 분위기로" 분기.
  - **"벽 평면 밀착" 지시가 돌출(수직)/지주형(바닥)/어닝(천막면)에도 나감** → PLANE 사전(종류별 설치 평면) 분기.
  - box_verbal이 세로 영역에도 "wide strip" → 비율 기반(가로띠/세로띠/영역).
- **R3 — 주간 씬 종류별 부정확:** 네온 주간에 "faces show solid colors"(면 없음) → "꺼진 튜브가 보임". 스카시/금속 주간 문구 분리. day_from_night도 종류 중립 문구로.
- **R4 — API 파라미터 리스크 검증:** temperature가 이미지 생성 API 미지원이면 400으로 전멸 위험 → 공식 문서 확인: generationConfig.temperature 정식 지원(0~2, 기본 1.0). responseModalities=["IMAGE"]는 이미지 전용 모델에서 유효(실건물 검증 이력 있음) — 유지.
- **R5 — 최종 정합:** FINAL SELF-CHECK에 야간 저녁화 예외 병기(RULE 2와 불일치 해소), 간판 종류 일치 확인 항목 추가(채널↔네온 드리프트 방지), 금속 '판'에 "letters" 문구 수정.
- **검증:** 최복잡 페이로드(로고+참고+글자별색+두줄) × 전 종류 20종 × 주/야 = 40 컴파일 전부 통과. 비발광 종류에 "switched ON" 미출현 자동 스캔 통과. 대표 프롬프트 전문 육안 검토 — 섹션 간 모순 0.

## 2026-07-05 | 프롬프트 고도화 2차 — 장면 논리 + Google 공식/커뮤니티 기법 반영

- **변경 파일:** server.py
- **핵심 수정 — 야간 장면 논리 모순:** 고객 사진은 보통 낮 촬영인데 야간 프롬프트가 "하늘·조명 포함 전부 그대로"를 지시 → "대낮에 켜진 간판"이 정답인 모순. 야간 TASK를 "①간판 설치 ②장면 전체를 저녁으로 전환(어스름 하늘·창문 불빛·가로등), 구도/구조는 고정"으로 재정의. PLACEMENT LOCK에도 저녁화 예외 병기.
- **영역 내 기존 간판 처리:** 고객이 지우기를 안 했을 때 신규 간판이 기존 간판과 혼합되는 문제 → "영역 안 기존 부착물은 완전 제거 후 벽 복원하고 설치, 절대 혼합 금지" 명시.
- **웹 리서치 반영 (Google 공식 Nano Banana 가이드 + 커뮤니티 한글 렌더링 기법):**
  - 공식 편집 템플릿 표준문구 "Keep everything else in the image exactly the same, preserving the original style, lighting and composition" 정렬.
  - **AVOID 리스트**(semantic negative): garbled text/자획 추가/자모 분해·병합/로마자화/워터마크/일러스트화 — 한글 깨짐 방지 커뮤니티 검증 기법.
  - 자모 분해 금지 명문화("Each Hangul character is ONE complete syllable block").
  - 카메라 언어: "same single exposure, consistent grain/focus" (동일 노출 합성감).
- **디테일 고도화:**
  - MAT_FINISH: 재질별 사진 질감 큐(유광=스펙큘러 반사, 유백=LED 핫스팟 금지, 메탈=헤어라인 그레인, 도장=새틴).
  - 점등 노출 가드: "발광부는 지정색 유지, 흰색으로 날아가지 않게" (front/box).
  - Typography 줄: 자간 균일·글리프 변형 금지·선명도. 요소 2개 이상 시 자연 간격.
  - 로고 왜곡 금지(비율·디테일 보존). 출력 프레이밍/종횡비 입력과 동일 고정.
  - 벽 평면 원근 준수("sit ON the wall plane, following its perspective").
  - /api/erase 프롬프트도 동일 기법 적용(고스팅/잔상 금지 AVOID 등).
  - 중복 정리: PLACEMENT 꼬리 반복문·INTEGRATION cartoon 금지(AVOID와 중복) 제거.
- **검증:** 전 세부종류 20종 × 주/야 = 40 컴파일 전부 통과, 공백 포함 글자별 색 매핑 유지, 야간 프롬프트 5,028자(~1,250토큰).

## 2026-07-05 | 종단 리뷰 — 모순/구멍 8건 보완

- **변경 파일:** server.py, step4-design.html(업로드 축소만, UI 무변경)
- **주요 수정:**
  1. **비발광 간판 주간변환 모순 (결과물 훼손 위험):** day_from_night가 무조건 "점등된 간판, 불을 꺼라" → 스카시(비후광)/금속/패브릭/현판/스텐실/어닝은 밤에도 발광 없음. 없는 glow를 지우려다 간판 훼손 가능 → is_lit_at_night()로 점등/비점등 프롬프트 분기.
  2. **어닝간판 구성 구멍:** 세부종류(고정식/접이식/기타)가 SUBTYPES 미매칭 → 채널 기본문("천막에 3D 채널글자+옆면발광")으로 나가던 것 → 고정식/접이식 전용 구성문 + 어닝 signType 폴백(FALLBACK_AWNING).
  3. **돌출-기타조형물:** 채널 기본문 → '조형물' SCULPTURAL 구성문 신설.
  4. **Gemini 재시도:** 429/500/503 시 2.5초 후 1회 재시도 — 일시 장애로 고객 결제 건 실패 방지.
  5. **로고/참고 이미지 다운스케일(step4):** 원본 그대로 API에 가던 것 → 긴 변 1024px (로고=PNG 투명보존, 참고=JPEG 0.85). 비용/지연 절감.
  6. **두줄/세로 배치 요소 배분 명시:** 요소 2개 이상일 때 "첫 요소가 윗줄" 등 순서 지시 (기존엔 모델 임의 배치).
  7. 서버 루트(/) → step1-form.html (기존 step4 직행).
  8. 미사용 import(io, base64) 제거.
- **검증:** 12케이스(어닝 3, 조형물, is_lit_at_night 5, 두줄, 회귀 2) 전부 통과. step4 shrinkUpload 2000px→1024px PNG 동작 확인, 콘솔 에러 0.

## 2026-07-05 | 입력 데이터 전수 감사 — 누락/유실 5건 수정

- **변경 파일:** server.py
- **배경:** "고객 입력이 전부 프롬프트에 반영되는가" 전수 추적(step4 UI 전 필드 → save() payload → compile_prompt). 유실 3건 + 모호함 2건 발견.
- **수정 내용:**
  1. **공백 인덱스 버그:** 색 배열(faceColors/sideColors)은 공백 포함 원문 인덱스인데 서버는 공백 제거 후 enumerate → 공백 뒤 글자들의 글자별 색이 밀리거나 유실("간판 집"의 '집' 색 증발). 원문 인덱스 기준 per_letter()로 수정.
  2. **글자별 옆면색 유실:** 옆면색이 글자별로 다르면 "white side returns"로 뭉개졌음 → per-letter side-return colors로 나열.
  3. **스카시 재질/두께 무시:** 고객이 무광아크릴/두꺼움을 골라도 고정 문구("스텐/신주/아크릴 중")로 나감 → {mat}/{th} 자리표시자 주입. MAT_PLAIN(평문 소재)·DEPTH_SCASI(판 두께 mm) 사전 신설.
  4. **다중 입력 이미지 순번 명시:** 로고+참고 동시 첨부 시 어느 이미지가 뭔지 미지정 → "input image #2 is LOGO / #3 is STYLE REFERENCE" 순번 명시 (api_generate 첨부 순서와 일치).
  5. **폰트명 힌트:** step4 미리보기 웹폰트(Black Han Sans/Jua/Do Hyeon/Nanum Myeongjo/Gaegu)를 프롬프트에 "similar in feel to" 힌트로 병기 — 미리보기와 결과 서체 일치도 향상.
  6. **읽기 방향:** 세로 배치인데 "reads left to right"로 나가던 것 → READ_ORDER(가로/두줄/세로별)로 분기.
- **검증:** 9개 체크 전부 통과 (공백 뒤 글자색, 글자별 옆면색, 스카시 재질·두께, 이미지 순번, 세로 방향, 폰트 힌트, 채널 회귀).

## 2026-07-05 | 프롬프트 도메인 정확도 고도화 — 실제 레퍼런스 사진 + 업계 제작방식 기반

- **변경 파일:** server.py, step4-design.html(payload 3필드 추가만, UI 무변경)
- **배경:** AI가 간판 종류를 잘못 서술하는 문제(예: 스카시를 필름으로 설명). img/step2 실제 레퍼런스 사진 29장을 전수 확인하고 업계 제작방식을 웹 검증해서 세부종류 사전을 전면 재작성.
- **레퍼런스 사진으로 확정한 정의:**
  - **스카시** = 판재(스텐/신주/골드메탈/아크릴)를 통재단한 솔리드 입체 글자 + 다보 부착. 필름/박스/내부LED 없음. 기본 비발광, 후광 옵션(halo_only).
  - **스텐실** = 벽면에 직접 페인트칠한 평면 레터링 (기존 "글자 뚫린 판" 서술은 오류였음 → painted 플래그, MOUNT 문단 생략).
  - **금속철제** = 도장/법랑/신주/코르텐 금속 판·팬 간판 (halo_only).
  - **포인트형** = 소형 악센트 발광 유닛 / **포인트큐브(돌출)** = 발광 큐브 박스.
  - **돌출-패브릭** = 봉걸이 천 깃발배너 (비발광).
  - **현판/표찰** = 신주/우드/아크릴 판 + 스탠드오프 볼트.
  - 채널 기본문: 옆판 재질 명시(갈바 절곡/알루미늄).
- **구조 변경:**
  - SUBTYPE_CAPS + construction_phrase 분리 구조 → **SUBTYPES 단일 사전**(키, caps, CONSTRUCTION 문단)으로 통합. 순서 매칭('큐브'가 '포인트'보다 먼저).
  - illum에 **halo_only** 추가: 스카시/금속은 후광 선택 시에만 백라이트("면은 발광 안 함" 명시), 아니면 비발광.
  - **MOUNT 문단(맨벽 낱글자 등)은 글자형(sides=True) 벽부착에만 삽입** — 박스/판형(플렉스·금속·포인트·현판)에 "박스 금지" 문단이 섞이던 모순 제거.
- **step3 사이즈 정보 프롬프트 연결 (기존엔 버려졌음):**
  - step4 payload에 signWidthCm/signHeightCm/signRatio 추가 (localStorage에서).
  - server size_phrase(): 수동입력 → "REAL-WORLD SIZE: 400cm × 60cm (6.7:1)" / 사진모드 → "PROPORTION: 4.2:1".
- **검증:** 11개 세부종류 케이스 컴파일 + MOUNT 유무 7케이스 전부 통과.

## 2026-07-04 | 세부종류 능력 스키마 도입 + 사진 저장 쿼터 수정 (UI 무변경)

- **변경 파일:** server.py, step3-size.html
- **배경:** "돌출 골라도 채널로 생성" 버그의 근본 원인은 종류별 능력(발광 가능 여부, 옆면 존재 여부)이 데이터로 정의돼 있지 않아서. 문구 분기(if '네온')만으론 조합 모순이 계속 생김.
- **server.py — SUBTYPE_CAPS 스키마:**
  - 세부종류별 `{sides: 옆면(returns) 개념 유무, illum: channel|neon|box|none}` 정의. 컴파일러 전체(elements/lighting)가 이 스키마를 참조.
  - 비발광 종류(금속/패브릭/현판): 야간에도 "자체 발광 없음, 주변광만" — 발광 문구 모순 구조적 차단.
  - box 발광(플렉스/스텐실/포인트): "면 전체 발광" (글자별 발광 아님).
  - sides=False 종류: "white side returns" 등 옆면 문구 생략, "in red lettering" 형태로.
  - 기존 네온 특별처리(if '네온')는 스키마로 흡수.
  - **valid_lightings() 가드:** 메탈 면(불투광)+전면발광 = 물리적 불가 조합 → 실제 시공처럼 후광으로 자동 대체.
  - 검증: 채널(회귀)/금속/플렉스/메탈+전면발광 4케이스 컴파일 확인.
- **step3-size.html — 건물사진 저장 쿼터 수정 (goNext 내부만, UI 무변경):**
  - 원본 폰 사진(수 MB base64)을 localStorage에 그대로 저장 → 5MB 쿼터 초과 위험. sessionStorage 폴백도 쿼터 동일해서 같이 실패 가능했음.
  - `shrinkForStorage()`: 저장 직전 긴 변 1568px 제한 + JPEG 0.87 재압축 (Gemini 입력 비용도 절감). signBox 좌표는 0~1 비율이라 무영향.
  - 둘 다 실패 시 무음 실패 대신 안내 alert. goNext의 페이지 이동 로직은 proceedNext()로 분리(비동기 저장 후 이동).
  - 검증: 3000×2000 더미 → 1568×1045 JPEG 축소 확인, 콘솔 에러 없음.

## 2026-07-04 | 프롬프트 컴파일러 정확도 개선 (간판종류 반영 + 한글 락 강화)

- **변경 파일:** server.py
- **배경:** 기존 compile_prompt가 step1~2 선택값을 무시하고 무조건 "벽 부착 채널간판"으로 생성. 돌출/어닝/지주형/실내를 골라도 프롬프트에 반영 안 됐음.
- **변경 내용:**
  - **SIGN_KIND 사전 신설:** 간판종류(전면/돌출/어닝/지주형/실내) → 설치 형태 영문 서술. 돌출은 "벽에 수직, 브라켓 암, 측면 각도" 명시.
  - **construction_phrase() 신설:** 세부종류(채널/네온/스카시/플렉스/스텐실/금속/패브릭/현판/포인트)별 제작방식 분기. 기존엔 채널 고정.
  - **시공방법(맨벽 등) 문단은 벽부착형(전면/실내)에만 삽입** — 돌출간판에 "맨벽 직접 부착" 문단이 섞이는 모순 제거.
  - **한글 텍스트 락 강화:** ① 프롬프트 최상단 "TWO ABSOLUTE RULES"로 텍스트 정확도+영역 고정을 최우선 명시 ② 글자별 분해(「간」+「판」...) ③ 프롬프트 맨 끝 FINAL SELF-CHECK에 글자 재명시(recency 효과).
  - **주간 변환(day_from_night)에도 간판 문구 재명시** — 변환 중 글자 드리프트 방지.
  - **위치 지정 이중화:** % 좌표에 언어적 위치("upper horizontal-center part...") 병행 — 이미지 모델이 좌표만보다 훨씬 잘 지킴.
  - **temperature 0.35 설정** — 충실도 우선, 글자/위치 드리프트 감소.
  - **hex_name 개선:** 명도 기반 dark/light 수식어 (navy가 'blue'로 뭉개지던 것 → 'dark blue').
  - **네온 발광 문구 분리:** 네온 서브타입일 때 "면 발광" 대신 "튜브 자체 발광" — CONSTRUCTION과 모순 제거.
- **검증:** /api/compile 로직 직접 호출 테스트 — 전면-채널-맨벽, 돌출-네온 두 케이스 정상 컴파일 확인. (실 이미지 생성은 GEMINI_API_KEY 필요 — 이 PC .env 없음)

## 2026-06-04 | 실제 건물 검증 성공 + 입력 UI/지우기/시공분기 완성

- **실건물 검증:** 사장님 실제 매장(화강암 벽) 사진으로 "조양권 [로고] 컴퍼니" 생성 → 한글 완벽, 로고 삽입, **맨벽(프레임 패널 없이 벽에 직접)** 확인, 주/야 일치, photoreal. gemini-3-pro-image.
- **모델:** `gemini-3-pro-image` (한글·품질 최상). 비용은 pro라 1시안(주/야 2장) ~300~500원 추정 → 추후 `gemini-3.1-flash-image` 한글 되는지 테스트해 원가 절감 검토(마진 89% 목표).
- **시공방법 분기:** server MOUNT 사전(맨벽/전면프레임/프레임바/파사드)으로 프롬프트 분기. step4가 localStorage의 실제 installMethod 사용(하드코딩 제거). → 맨벽이면 백킹 없이, 프레임바면 바 백킹 등.
- **주/야 위치 일치:** 야간 생성 후 그 이미지를 낮으로 변환(day_from_night)해서 위치/글자/구성 동일.
- **영역 정확도:** signBox %좌표를 프롬프트에 명시("STRICTLY inside x%~ y%~"), 기존 외부 요소 변경 금지.
- **기존 간판 지우기(step3):** 🧹 브러시 + ⬜ 사각형 마스크 → /api/erase(Gemini 인페인팅, iopaint 불필요) → 깨끗한 벽. 검증 OK(간판 제거됨).
- **step4 입력 UI:** 요소 빌더(텍스트/로고 순서·이동/삭제), 글자별 앞면/옆면색(전체동일·글자별), 재질(유광/무광/유백/메탈/도장), 글씨체, 두께, 발광방식(복수), 발광색, 참고이미지, 미리보기 상단고정. **입력 포커스 버그 수정**(input 중 renderAll→포커스/IME 끊김 → oninput은 미리보기만, onchange에 전체갱신).
- **저장 버튼:** 결과 오버레이에 주/야 PNG 다운로드.
- **프롬프트 컴파일러(/api/compile, 키 불필요):** 선택값→정밀 영문 프롬프트(한글 원문 따옴표). 검증 완료.
- **변경 파일:** server.py, step3-size.html, step4-design.html, .env(GEMINI_API_KEY), .claude/settings.local.json.

## 2026-06-04 | ★★★ Gemini 전환 — 한글+사진+건물합성 종단 성공

- **결정적 전환:** Flux/kontext(한글 깨짐) → **Gemini 이미지 모델**로 교체. 사장님이 Gemini 결과물(완벽한 한글 채널간판)을 보여줘서 방향 전환.
- **모델:** `gemini-3-pro-image` 가 정답. (gemini-2.5-flash-image는 한글 깨짐: 컴퍼니→켬펴비 / 3-pro는 완벽)
- **Python 3.8이라 SDK 불가** → **Gemini REST API 직접 호출**(requests). v1beta generateContent, responseModalities=[IMAGE].
- **프롬프트 컴파일러(server.py compile_prompt):** step1~4 선택값 → 정밀 영문 프롬프트(한글 원문 따옴표 유지). 재질/폰트/두께/발광/배치/로고/시공 → 영문 문구 사전 매핑. 색 hex+이름. /api/compile로 키 없이 확인 가능.
- **생성:** /api/generate = 건물사진+로고+참고 이미지 입력 + 프롬프트 → Gemini가 건물에 간판 통째로 그림 → 주간(소등)+야간(점등) 2장.
- **검증 결과(gem3_night/day.png):** "클래시 컴퍼니" 한글 완벽, 파랑/빨강 정확, 측면발광 흰색+벽 빛번짐, 진짜 시공 사진 수준. 주/야 둘 다 OK.
- **입력 UI(step4-design.html):** 요소 빌더(텍스트/로고 순서·이동) + 글자별 앞면/옆면색(전체동일·글자별) + 재질(유광/무광/유백/메탈/도장) + 글씨체 + 두께 + 발광방식(복수) + 발광색 + 참고이미지 + 미리보기 상단고정.
- **남은 것:** ① 비용(3-pro는 비쌈 → 3.1-flash-image 한글 되는지 비교) ② 위치 이동(하이브리드: 에디터 배치→확정 후 굽기) ③ 다른 간판조합 템플릿.
- **변경:** server.py(Gemini REST+컴파일러), step4-design.html(세밀 입력+생성연결), .env(GEMINI_API_KEY).

## 2026-06-04 | ★ 전면-채널-맨벽 종단 파이프라인 완성 (작동)

- **한글 깨짐(품→픔) 진짜 원인 = 입력 레이아웃 글로우가 속획 뭉갬.** render_layout을 **글로우 없는 선명 입력**으로 → 품 3/3 정확. 발광은 프롬프트가 담당.
- **색 정확도:** 프롬프트 COLOR_LOCK("빨강 유지, 주황/노랑으로 안 튀게") → 빨강/파랑 유지.
- **주/야 2버전:** 같은 선명입력으로 kontext 2회(점등/소등) → signNight/signDay 투명 PNG.
- **종단:** step3(건물+영역 signBox 저장) → step4(글자·색·발광→생성) → canvas-editor(건물 배경+영역 배치, 주/야 토글=PNG스왑+야간 디밍+글로우, 이동/크기조절).
- **검증:** editor_night_preview.png = 건물 위 발광 "간판의품격" 시안, 한글 정확. (에디터 캡처는 타임아웃 → eval+합성으로 검증)
- **변경:** server.py, step4-design.html, canvas-editor.html, step3-size.html, .claude/settings.local.json
- **남은 튜닝:** 소등 색 일부 회색끼·점등 글로우 강화(작동엔 지장 없음). 실행: python server.py. 생성 1회=kontext 2장≈$0.08.

## 2026-05-29 | ★★ 최종 파이프라인 확정 — kontext 픽셀보존 방식 (검증완료)

- **결정적 결과:** canny는 한글 깨짐(클→몰, dev/pro 둘 다). 순수 프롬프트(ideogram)도 한글 깨짐(콜탬시…). 
  **flux-kontext-pro(이미지 편집형)** = 글자 픽셀 보존 → 한글 100% + photoreal 달성.
- **신뢰도 검증:** 4개 이름 연속 성공 — 클래시컴퍼니 / 정직한공인중개사(8자) / 행복한약국 / 쌍쌍불족발(ㅆ+받침多). 전부 정확.
- **구도 제어:** 프롬프트에 "front view, orthographic, no perspective/tilt, keep layout exact" 넣으면 기울기·크기 변형 잡힘.
- **확정 파이프라인:**
  ```
  PIL/WebGL로 글자 레이아웃(정확한 한글 픽셀+색)
   → flux-kontext-pro 재질·조명 photoreal化 (정면고정, 검은배경 글자만)
   → RMBG 누끼 → 투명 PNG
   → 캔버스에서 건물사진에 위치·크기 잡아 합성 (AI는 위치 안 건드림)
  ```
- **도구:** make_color.py(컬러 레이아웃), gen.py(다중모델: kontext/ideogram/imagen/canny). 모델: black-forest-labs/flux-kontext-pro.
- **비용:** kontext-pro ~$0.04/장 (≈50원) → 1,000원 결제 마진 OK.
- **다음:** RMBG 누끼→투명PNG 확인 / 건물사진 합성 / 색·시공방식 파라미터화 / 앱 통합.

## 2026-05-29 | ★ Stage3 AI 마감 검증 성공 (핵심 가설 입증, canny — 이후 kontext로 대체됨)

- **결과:** control_input.png("대박치킨" 맑은고딕 흑백 윤곽) → flux-canny-dev → `out_finish_dev_193428.png`.
- **판정:** ✅ 한글 100% 정확(깨짐 0) + ✅ photoreal(실제 채널간판 사진 수준). **dev 모델·첫 시도**로 달성.
- **결론:** "폰트로 한글 윤곽 고정(canny) → Flux가 재질·조명만 입힘" 아키텍처 핵심 리스크 **통과**. WebGL "그림"과 차원이 다른 사진 결과.
- **튜닝 포인트:** 흑백 컨트롤이라 색 정보 없음→Flux가 따뜻한 화이트 기본 선택(프롬프트로 색 지정 필요). 테두리 패널 생성됨(전면프레임 느낌)→맨벽은 프롬프트로 제어.
- **추가 파일:** make_control.py(한글→canny 컨트롤 PNG), control_input.png.
- **다음:** 색/시공방식 프롬프트 튜닝, pro 모델 비교, 건물사진 합성.

## 2026-05-29 | Stage3 AI 마감 검증 하네스 (ai_finish_test.py)

- **변경 파일:** `ai_finish_test.py` (신규), `proto-channel.html` (PNG 내보내기 버튼 + preserveDrawingBuffer)
- **목적:** "그림→사진" 격차를 AI가 메우는지 + 한글 유지되는지 실제 검증.
- **흐름:** proto-channel.html [PNG 내보내기] → 렌더 PNG → ai_finish_test.py → Replicate flux-canny-dev/pro (canny로 한글 윤곽 고정 + photoreal 재질 입힘) → out_finish_*.png.
- **보안:** REPLICATE_API_TOKEN은 .env에서만 읽음(코드/깃에 키 없음). 사장님이 직접 .env 설정.
- **전제:** pip install replicate python-dotenv requests. 카드 등록 필요(Flux는 유료).
- **대기:** 사장님 토큰 재발급+.env 설정 후 실행. 유료 생성이라 실행 전 승인 받을 것.

## 2026-05-29 | 전면-채널-맨벽 WebGL 프로토타입 (proto-channel.html)

- **변경 파일:** `proto-channel.html` (신규)
- **목적:** Stage1 절차적 렌더 핵심 리스크("그림 같다" 격차) 조기 검증. CSS 데모 대비 실제 3D가 나은지.
- **기술:** Three.js 0.160 (ESM importmap) + opentype.js로 한글 폰트(Black Han Sans, jsDelivr) 외곽선 추출 → SVGLoader.createShapes(구멍 처리) → ExtrudeGeometry(압출+베벨) → 면발광(emissive)+UnrealBloomPass + RoomEnvironment(반사) + PointLight(벽 빛번짐) + 그림자.
- **기능:** 상호명 실시간 입력, 야간점등/주간소등 토글, 5색 변경, OrbitControls 회전/줌. 카메라 자동 fit.
- **결과:** 한글 깨짐 0%, 실시간·0원. 야간=흰색발광면+빨강글로우+벽반사, 주간=빨간면+어두운금속측면+그림자. CSS 데모보다 확연히 입체·사실적. 단 여전히 "깨끗한 CG/렌더" 느낌 = Stage1 한계 → 실사진 격차는 Stage3 AI 마감+건물합성 몫(예상대로).
- **수정한 버그:** OrbitControls maxDistance(120)가 카메라 자동fit 거리를 클램프 → 2000으로. 입력창 브라우저 자동완성 → autocomplete off.
- **잔여 사소버그:** 색상 기본값이 가끔 0(레드) 아닌 값으로 시작(프리뷰 환경 추정). 기능엔 무관.
- **미커밋 상태** (사장님 "커밋해줘" 대기).

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
