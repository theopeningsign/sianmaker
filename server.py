#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사인메이커 생성 백엔드 (Gemini).
step1~4 디자인 선택값 → 정밀 영문 프롬프트 컴파일 → Gemini 이미지(건물사진 편집)로
주간/야간 시안 생성. Python 3.8 호환 위해 SDK 대신 REST API 직접 호출.

실행: python server.py  (http://localhost:5000)
.env:  GEMINI_API_KEY=...      (aistudio.google.com 에서 발급, 사용자가 직접 입력)
필요:  pip install flask python-dotenv requests
"""
import os, json, re
import requests
from flask import Flask, request, jsonify, send_from_directory
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__, static_folder='.', static_url_path='')

GEMINI_MODEL = "gemini-3.1-flash-image"   # 저가형 테스트. 고품질: gemini-3-pro-image
GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent"

# ── 선택값 → 영문 문구 사전 ──
MAT = {
    'acrylic_glossy':'glossy translucent acrylic',
    'acrylic_matte':'matte acrylic',
    'acrylic_milky':'milky translucent diffuser acrylic with even illumination',
    'metal':'brushed stainless steel (non-illuminated)',
    'paint':'color-painted metal finish',
}
# 재질별 사진 질감 큐 — photoreal 마감 디테일 (채널/스카시 등 입체 글자형에 적용)
MAT_FINISH = {
    'acrylic_glossy':"Finish detail: the faces carry a subtle glossy specular sheen with faint soft reflections of the surroundings.",
    'acrylic_matte':"Finish detail: the faces are smooth and fully diffuse — no shine, no reflections.",
    'acrylic_milky':"Finish detail: when lit, the milky faces diffuse the light perfectly evenly across each letter — absolutely no visible LED hotspots or bright dots.",
    'metal':"Finish detail: the brushed metal shows a fine directional hairline grain with soft anisotropic reflections.",
    'paint':"Finish detail: the painted surface is smooth with a slight satin sheen, like factory powder-coating.",
}
# step4 미리보기가 보여주는 실제 웹폰트명을 힌트로 병기 — 미리보기와 생성 결과의 서체 느낌 일치
FONT = {
    'gothic_bold':"a bold, heavy Korean sans-serif (gothic) typeface, similar in feel to the Korean font 'Black Han Sans'",
    'gothic_round':"a rounded, friendly Korean gothic typeface, similar in feel to the Korean font 'Jua'",
    'gothic_basic':"a clean standard Korean gothic typeface, similar in feel to the Korean font 'Do Hyeon'",
    'myeongjo':"an elegant Korean serif (Myeongjo) typeface, similar in feel to the Korean font 'Nanum Myeongjo'",
    'hand':"a hand-written Korean brush-script style, similar in feel to the Korean font 'Gaegu'",
}
# 스카시 전용: 판재 소재(괄호 주석 없는 평문)와 판 두께
MAT_PLAIN = {
    'acrylic_glossy':'glossy acrylic','acrylic_matte':'matte acrylic','acrylic_milky':'milky-white acrylic',
    'metal':'brushed stainless steel','paint':'color-painted metal',
}
DEPTH_SCASI = {
    'thin':'thin (about 10 mm) sheet','normal':'medium-thickness (about 20 mm) sheet',
    'thick':'thick (about 30 mm) sheet','xthick':'extra-thick (40 mm or more) sheet',
}
DEPTH = {
    'thin':'shallow channel depth (about 5 cm returns)',
    'normal':'medium channel depth (about 8 cm returns)',
    'thick':'deep channel returns (about 12 cm)',
    'xthick':'very deep, bold 3D channel returns (15 cm or more)',
}
LAYOUT = {'horizontal':'a single horizontal line','twoline':'two stacked lines','vertical':'a vertical column'}
READ_ORDER = {'horizontal':'left to right','twoline':'left to right, wrapping onto two stacked lines','vertical':'top to bottom'}
# 간판 종류(step1) → 설치 형태. 프롬프트가 무조건 벽부착으로 나가는 것 방지.
SIGN_KIND = {
 '전면간판':"a storefront fascia sign mounted FLAT against the building facade above/near the entrance",
 '돌출간판':("a PROJECTING blade sign (돌출간판): its sign panel sticks OUT from the facade, PERPENDICULAR to the wall "
           "(the panel plane is parallel to the street direction), held by a metal bracket arm anchored to the wall. "
           "CRITICAL ORIENTATION: the panel must NEVER lie flat against or parallel to the wall — from this camera the panel "
           "appears strongly foreshortened at a three-quarter angle, with visible panel thickness and the bracket arm between "
           "wall and panel. Render it as a physical object inside this photo's own camera view and perspective"),
 '어닝간판':"an AWNING sign — the lettering is applied on the front valance of a fabric awning/canopy over the storefront",
 '지주형간판':"a FREESTANDING pylon sign on its own post/structure standing on the ground, separate from the wall",
 '실내간판':"an INTERIOR sign mounted on an indoor wall inside the store",
}
# ── 세부종류 사전 ──
# 레퍼런스 사진(img/step2)과 실제 제작 방식 기준으로 작성. 매칭은 리스트 순서대로
# 부분일치 — '큐브'가 '포인트'보다 먼저 와야 '포인트-큐브'가 큐브로 잡힘.
#   sides:   입체 글자의 옆면(returns) 개념 존재 여부
#   illum:   channel(면/옆/후광) | neon(튜브) | box(박스 전체) | halo_only(비발광 기본, 후광 옵션) | none(비발광)
#   painted: 벽면 직접 도장 (부착물 아님 → MOUNT 문단 생략)
#   con:     CONSTRUCTION 문단 (None이면 채널 기본문 — 재질/두께 반영)
SUBTYPES = [
 ('큐브',   {'sides':False,'illum':'box'},
   "CONSTRUCTION: internally-lit CUBE sign — a compact glowing cube-shaped lightbox with the content printed on its visible faces (front and sides). The whole cube glows evenly and softly."),
 ('포인트', {'sides':False,'illum':'box'},
   "CONSTRUCTION: compact POINT accent sign — a small round or softly-rounded rectangular sign unit (badge/capsule-like), with the content printed cleanly on its face; internally illuminated with an even glow. Boutique accent scale, much smaller than a main fascia sign."),
 ('채널',   {'sides':True,'illum':'channel'}, None),
 ('스카시', {'sides':True,'illum':'halo_only'},
   "CONSTRUCTION: FLAT CUT-OUT (FCO) letters — each letter is precision laser-cut from a SOLID {th} of {mat}, with a clean flat face and crisp square edges, mounted slightly off the wall on hidden standoff pins so each letter casts a subtle shadow. Solid opaque material with a premium minimal look. NO printed film, NO vinyl, NO sign box, NO internal LED inside the letters."),
 ('네온',   {'sides':False,'illum':'neon'},
   "CONSTRUCTION: NEON sign — LED neon-flex tubing bent to trace each letterform as continuous glowing line work (often cursive/script style), mounted directly on the wall or on a slim clear backing. The glowing tubes themselves ARE the letters; no solid letter faces."),
 ('플렉스', {'sides':False,'illum':'box'},
   "CONSTRUCTION: FLEX-FACE lightbox — a slim rectangular steel-frame sign box with a smooth tensioned flex-banner face; the text and graphics are printed FLAT on that face, and the whole face is evenly back-lit from inside. No dimensional letters, no visible tubes."),
 ('스텐실', {'sides':False,'illum':'none','painted':True},
   "CONSTRUCTION: PAINTED WALL LETTERING (stencil style) — the text/graphics are painted DIRECTLY onto the wall surface as flat matte paint, like premium hand-painted shop lettering. Completely flat (zero thickness), no panel, no box, no frame, no gloss; the wall's own texture shows through the paint."),
 ('금속',   {'sides':False,'illum':'halo_only'},
   "CONSTRUCTION: crafted METAL sign — a fabricated metal plate/pan sign (painted steel, enamel, polished brass, or weathered corten finish) with the lettering applied on it as dimensional pieces or fine print. Premium artisan hardware look with visible metal craftsmanship."),
 ('패브릭', {'sides':False,'illum':'none'},
   "CONSTRUCTION: FABRIC banner sign — natural canvas/cotton fabric printed with the text, hanging like a small flag/banner from its mount with a soft cloth drape. Boutique handmade feel. Not illuminated."),
 ('현판',   {'sides':False,'illum':'none'},
   "CONSTRUCTION: PLAQUE (nameplate) — a compact rectangular plate of polished brass, wood, or clear acrylic with engraved or printed lettering, fixed with small standoff bolts at the corners. Formal and refined."),
 ('조형물', {'sides':False,'illum':'box'},
   "CONSTRUCTION: custom SCULPTURAL sign — a unique dimensional sign object shaped to fit the shop's identity (not a standard box or letters), fabricated cleanly with the text/logo integrated into the form."),
 ('접이식', {'sides':False,'illum':'none'},   # 어닝 전용
   "CONSTRUCTION: RETRACTABLE (folding-arm) AWNING sign — a fabric awning that extends on folding arms over the storefront; the text is printed/appliquéd cleanly on the front valance strip (and optionally the slope). Taut fabric, neat tailored finish. Not illuminated."),
 ('고정식', {'sides':False,'illum':'none'},   # 어닝 전용
   "CONSTRUCTION: FIXED-FRAME AWNING sign — a fabric canopy stretched over a fixed metal frame above the storefront; the text is printed/appliquéd cleanly on the front valance strip (and optionally the slope). Taut fabric, neat tailored finish. Not illuminated."),
]
CAPS_CHANNEL = {'sides':True,'illum':'channel'}
# 어닝간판의 '기타' 등 세부종류 매칭 실패 시: 채널로 떨어지면 "천막에 채널글자" 모순 → 종류별 폴백
FALLBACK_AWNING = ({'sides':False,'illum':'none'},
   "CONSTRUCTION: AWNING sign — a fabric awning/canopy over the storefront with the text printed/appliquéd cleanly on the front valance strip. Taut fabric, neat tailored finish. Not illuminated.")

def subtype_entry(subtype, sign_type=''):
    for k,caps,con in SUBTYPES:
        if k in (subtype or ''): return caps,con
    if '어닝' in (sign_type or ''): return FALLBACK_AWNING
    return CAPS_CHANNEL,None

def caps_for(subtype, sign_type=''):
    return subtype_entry(subtype, sign_type)[0]

def valid_lightings(design):
    """물리적으로 불가능한 발광 조합 보정.
    메탈 면(불투광)은 전면발광이 안 됨 — 실제 시공처럼 후광으로 대체.
    채널인데 발광 미선택(UI 기본값)이면 실무 기본인 전면발광으로."""
    lightings=list(design.get('lightings',[]))
    if design.get('material')=='metal' and 'front' in lightings:
        lightings=[l for l in lightings if l!='front']
        if not lightings: lightings=['halo']
    if not lightings and caps_for(design.get('signSubType'), design.get('signType'))['illum']=='channel':
        lightings=['front']
    return lightings

def construction_phrase(design):
    caps,con = subtype_entry(design.get('signSubType'), design.get('signType'))
    finish = MAT_FINISH.get(design.get('material'),'') if caps.get('sides') else ''
    if con:
        # 스카시 등 재질/두께 자리표시자({mat}/{th})가 있으면 고객 선택값 주입
        if '{mat}' in con or '{th}' in con:
            con = con.format(mat=MAT_PLAIN.get(design.get('material'),'brushed stainless steel'),
                             th=DEPTH_SCASI.get(design.get('depth'),'medium-thickness (about 20 mm) sheet'))
        return (con + " " + finish).strip()
    # 채널 기본문 — 재질/두께 반영
    depth = DEPTH.get(design.get('depth'),'medium channel depth')
    mat = MAT.get(design.get('material'),'glossy acrylic')
    return (f"CONSTRUCTION: individually fabricated dimensional 3D CHANNEL letters, {depth}. "
            f"Faces made of {mat} — the face color is perfectly smooth and uniform, like the colored translucent "
            f"film-on-acrylic finish standard in Korean channel fabrication. Each face is edged with a neat trim cap "
            f"binding it to the side returns (folded galvanized-steel or aluminum). Realistic thickness and depth. "
            + finish).strip()

def size_phrase(design):
    """step3에서 받은 실물 사이즈/비율 → 스케일·비례 지시."""
    try: w=float(design.get('signWidthCm') or 0); h=float(design.get('signHeightCm') or 0)
    except (TypeError,ValueError): w=h=0
    if w>0 and h>0:
        return (f"REAL-WORLD SIZE: the fabricated sign is about {int(w)} cm wide × {int(h)} cm tall "
                f"(width:height ≈ {w/h:.1f}:1). Respect this proportion and render the sign at a realistic physical scale relative to the building.")
    try: r=float(design.get('signRatio') or 0)
    except (TypeError,ValueError): r=0
    if r>0:
        return f"PROPORTION: the sign area's width:height ratio is about {r:.1f}:1 — keep the sign's overall proportion close to this."
    # 사이즈 미입력 → 종류별 현실 치수 (옥외광고물 규정·실무 관행 기반). 없으면 AI가 크기를 임의로 정함.
    return typical_size(design)

# 실측 관행: 돌출 폭 50~70cm·벽면 돌출 1m 이내(법규), 전면 파스시아 높이 60~90cm 등
TYPICAL_SIZE = {
 '큐브':  "TYPICAL SCALE: a compact glowing cube roughly 40–50 cm per side.",
 '패브릭':"TYPICAL SCALE: a cloth banner roughly 45 cm wide × 60–70 cm tall.",
 '현판':  "TYPICAL SCALE: a compact plaque roughly 30–45 cm wide.",
 '포인트':"TYPICAL SCALE: a compact accent unit roughly 40–60 cm across.",
}
TYPICAL_SIZE_TYPE = {
 '돌출': ("TYPICAL SCALE: a compact blade sign roughly 50–70 cm across, projecting no more than about 1 m from the wall "
         "(Korean outdoor-advertising regulation), mounted at upper-storefront height."),
 '지주': "TYPICAL SCALE: a freestanding pylon roughly 3–5 m tall.",
 '어닝': "TYPICAL SCALE: the valance lettering is roughly 15–25 cm tall.",
 '전면': "TYPICAL SCALE: a storefront fascia sign roughly 60–90 cm tall, spanning the shopfront width.",
 '실내': "TYPICAL SCALE: sized to read comfortably indoors, roughly 30–120 cm across depending on the wall.",
}
def typical_size(design):
    sub=design.get('signSubType') or ''
    for k,v in TYPICAL_SIZE.items():
        if k in sub: return v
    for k,v in TYPICAL_SIZE_TYPE.items():
        if k in (design.get('signType') or ''): return v
    return None
# 'asis'를 "panel"로 쓰면 맨벽 MOUNT의 "NO backing panel"과 문구 충돌 → 컷 형태 평면 피스로 표현
LOGO_TREAT = {'asis':'reproduced as-is as a flat printed piece cut to the logo\'s outline','channel':'fabricated as dimensional 3D channel pieces like the letters','metal':'fabricated in dimensional brushed metal'}
LOGO_SIZE = {'small':'smaller than the text','normal':'about the same height as the text','large':'larger than the text'}
MOUNT = {
 '맨벽': ("MOUNTING (bare-wall / 맨벽 — VERY IMPORTANT): each individual letter and the logo is fixed DIRECTLY onto the "
         "bare wall surface with small hidden standoff spacers. There is absolutely NO backing panel, NO sign box, NO frame, "
         "and NO horizontal rail/bar behind the letters. The existing wall surface and its texture stay fully visible between, "
         "around and behind every letter. Do NOT put the letters on a dark rectangular plate. Each letter casts a soft contact shadow on the wall."),
 '전면프레임': ("MOUNTING (front frame panel / 전면프레임): the letters are mounted on a solid rectangular fascia panel that spans the "
            "sign area — an aluminum-composite panel (ACP) skin over a steel tube frame, with a perfectly flat, smooth, evenly "
            "colored matte surface and clean square edges (the standard Korean sign fascia). The letters sit on this panel."),
 '프레임바': ("MOUNTING (raceway / 프레임바): the letters are mounted on a slim horizontal RACEWAY — a narrow rectangular metal box "
           "running the length of the letter row, attached to the wall (NOT a full solid panel); the raceway is visible behind "
           "the row of letters, and the wall shows above and below it."),
 '파사드': ("MOUNTING (facade / 파사드): the sign is integrated into a designed architectural facade surround — premium cladding "
          "(aluminum-composite panel, stone-look or wood-look finish) wrapping the storefront frontage and framing the entrance, "
          "with the lettering composed into this facade design."),
}
def mount_desc(install): return MOUNT.get(install, MOUNT['맨벽'])

def hex_name(hex):
    try:
        h=hex.lstrip('#'); r,g,b=[int(h[i:i+2],16)/255 for i in (0,2,4)]
    except: return ''
    mx,mn=max(r,g,b),min(r,g,b); l=(mx+mn)/2; d=mx-mn
    if d<0.08:
        return 'white' if l>0.8 else ('black' if l<0.2 else 'gray')
    if mx==r: hue=(60*((g-b)/d)+360)%360
    elif mx==g: hue=60*((b-r)/d)+120
    else: hue=60*((r-g)/d)+240
    names=[(15,'red'),(45,'orange'),(70,'yellow'),(160,'green'),(200,'cyan'),(255,'blue'),(290,'purple'),(330,'pink'),(360,'red')]
    base='red'
    for lim,nm in names:
        if hue<lim: base=nm; break
    # 우드톤/브라운 간판이 흔한데 어두운 주황이 'orange'로 나가면 부정확
    if base=='orange' and l<0.45: return 'brown'
    # 명도 수식어: navy(#001f5c)가 그냥 'blue'로 뭉개지는 것 방지
    if l<0.3: return 'dark '+base
    if l>0.75: return 'light '+base
    return base

def col(hex):
    return f"{hex_name(hex)} ({hex})" if hex else "default"

def colors_phrase(colors_list):
    """글자별 색 리스트 → '모두 X' 또는 글자별 나열."""
    vals=[c for c in colors_list if c]
    if not vals: return None
    uniq=set(vals)
    if len(uniq)==1: return col(vals[0])
    return None  # 글자별 다름 → 호출부에서 글자별 처리

def spell_out(txt):
    """한글 정확도용 글자별 분해: '간판' → 「간」+「판」."""
    return " + ".join(f"「{c}」" for c in txt if not c.isspace())

def sign_texts(design):
    """디자인 내 모든 텍스트 문자열 (검증 체크리스트/주간변환 재명시용)."""
    return [el.get('text','').strip() for el in design.get('elements',[])
            if el.get('type')!='logo' and el.get('text','').strip()]

def elements_phrase(elements, caps=None):
    """요소(텍스트/로고) → 영문 구성 설명. 로고 개수도 반환.
    caps['sides']=False(네온/플렉스/금속 등)면 옆면(returns) 문구 생략 — 입체 글자가 아닌데 옆면색이 나가는 모순 방지."""
    caps = caps or CAPS_CHANNEL
    parts=[]; logo_n=0
    for el in elements:
        if el.get('type')=='logo':
            logo_n+=1
            t=LOGO_TREAT.get(el.get('treat'),'as shown')
            s=LOGO_SIZE.get(el.get('size'),'about the same height as the text')
            cm = el.get('colorMode')
            cdesc = (f"recolored to solid {col(el.get('color'))}" if cm=='mono' else "keeping its original colors")
            parts.append(f"the provided LOGO image, {t}, {s}, {cdesc}, reproduced faithfully without distortion (keep its aspect ratio and details)")
        else:
            txt=el.get('text','').strip()
            if not txt: continue
            faces=el.get('faceColors') or []
            sides=el.get('sideColors') or []
            fp=colors_phrase(faces); sp=colors_phrase(sides)
            chars=[c for c in txt if c.strip()!='']
            # 색 배열은 공백 포함 원문 인덱스 기준(공백 자리는 null) — 원문 enumerate로 매핑해야 공백 뒤 글자가 안 밀림
            def per_letter(colors):
                return ", ".join(f"'{ch}'={col(colors[i])}" for i,ch in enumerate(txt)
                                 if not ch.isspace() and i<len(colors) and colors[i])
            if fp:
                facedesc=f"{fp} faces" if caps['sides'] else f"in {fp} lettering"
            else:
                facedesc=(f"per-letter face colors ({per_letter(faces)})" if caps['sides']
                          else f"with per-letter colors ({per_letter(faces)})")
            glyphs=f'the text "{txt}" (exactly these {len(chars)} glyphs: {spell_out(txt)})'
            if caps['sides']:
                # 옆면색도 글자별 지정 지원 (기존엔 글자별로 다르면 white로 뭉개졌음)
                sidedesc=f"{sp} side returns" if sp else (
                    f"per-letter side-return colors ({per_letter(sides)})" if any(sides) else "white side returns")
                parts.append(f'{glyphs} with {facedesc} and {sidedesc}')
            else:
                parts.append(f'{glyphs} {facedesc}')
    return parts, logo_n

def lighting_phrase(lightings, light_color, scene, caps=None):
    caps = caps or CAPS_CHANNEL
    if scene=='day':
        if caps['illum'] in ('none','halo_only'):
            return "Scene & time: clear daytime. The sign shows its solid material colors under natural daylight."
        if caps['illum']=='neon':
            return ("Scene & time: clear daytime. The neon is switched OFF — the tubes are visible as pale, "
                    "unlit tubing tracing the letterforms, no glow.")
        return ("Scene & time: clear daytime. The sign is switched OFF (not illuminated); "
                "the faces show their solid colors under natural daylight, no glow.")
    # night
    if light_color=='same': gc="in each part's own color"
    elif light_color=='white': gc="in bright white"
    elif light_color and light_color.startswith('#'): gc=f"in {col(light_color)}"
    else: gc="brightly"
    # 발광 방식은 세부종류 스키마를 따름 — 비발광 간판에 발광 문구가 나가는 모순 방지
    if caps['illum']=='none':
        return ("Scene & time: evening/night. This sign type is NOT internally illuminated: it appears under ambient "
                "street/storefront lighting only, with NO glow coming from the sign itself.")
    if caps['illum']=='halo_only':
        # 스카시/금속: 자체 발광 불가(솔리드 소재) — 후광을 골랐을 때만 백라이트, 아니면 비발광
        if 'halo' in (lightings or []):
            return ("Scene & time: evening/night. The letters/plate are back-lit: hidden LEDs behind them cast a soft warm "
                    f"halo of light onto the wall {gc}, silhouetting each solid letter. The letter faces themselves do NOT glow.")
        return ("Scene & time: evening/night. This sign is NOT internally illuminated (solid material, no internal lighting): "
                "it appears under ambient street/storefront lighting only, with NO glow from the sign itself.")
    if caps['illum']=='neon':
        return ("Scene & time: evening/night. The sign is switched ON: the neon tubes themselves glow vividly "
                f"{gc}, casting a soft colored halo onto the surrounding surface.")
    if caps['illum']=='box':
        return ("Scene & time: evening/night. The sign is switched ON: the whole sign face is internally lit and "
                f"glows evenly {gc}, spilling soft light onto the surroundings. "
                "Exposure note: the printed graphics stay clearly readable on the glowing face — never blown out to white.")
    eff=[]
    if 'front' in lightings: eff.append(f"the letter faces are internally LED-illuminated and glow evenly {gc}")
    if 'side'  in lightings: eff.append(f"ONLY the side returns emit light and glow {gc}, while the front faces stay opaque (rim/side-lit channel)")
    if 'halo'  in lightings: eff.append(f"a soft halo of light glows from behind the letters onto the wall {gc} (reverse-channel / halo-lit, letters lifted slightly off the wall)")
    if not eff: eff.append("the sign is softly illuminated")
    return ("Scene & time: evening/night. The sign is switched ON and illuminated; "
            + "; ".join(eff) + ". The light spills softly onto the surrounding wall. "
            "Exposure note: the glowing parts stay clearly recognizable in their specified colors — bright but NOT blown out to white.")

def box_verbal(box):
    """% 박스 → 언어적 위치 서술 (이미지 모델은 좌표+말 병행 시 훨씬 잘 지킴)."""
    cx=box['x']+box['w']/2; cy=box['y']+box['h']/2
    h='left' if cx<0.36 else ('right' if cx>0.64 else 'horizontal-center')
    v='upper' if cy<0.36 else ('lower' if cy>0.64 else 'vertically-middle')
    w=round(box['w']*100); ht=round(box['h']*100)
    # 박스 비율에 맞는 명칭 (세로 영역에 'wide strip'이라고 하면 모순)
    shape = 'a wide horizontal strip' if box['w']>=box['h']*2 else ('a tall vertical strip' if box['h']>=box['w']*2 else 'an area')
    return f"the {v} {h} part of the photo — {shape} about {w}% of the image width and {ht}% of its height"

# 간판 종류별 설치 평면 지시 — '벽 평면 밀착'은 돌출(수직)/지주형(바닥)/어닝(천막면)에 모순
PLANE = {
 '전면':"The sign must sit ON the wall plane, following the wall's perspective and foreshortening exactly.",
 '실내':"The sign must sit ON the wall plane, following the wall's perspective and foreshortening exactly.",
 '돌출':"The sign is mounted AT this location, projecting perpendicular from the wall on its bracket — it does not lie flat on the wall.",
 '지주':"The sign stands on the ground at this location on its own post/structure, vertical and plumb.",
 '어닝':"The lettering follows the awning's fabric surface at this location (its slope/valance plane), not the wall behind it.",
}
def plane_line(sign_type):
    for k,v in PLANE.items():
        if k in (sign_type or ''): return v
    return PLANE['전면']

def placement_phrase(box, sign_type=''):
    if not box or not box.get('w'):
        return "in the main sign area indicated by the customer. " + plane_line(sign_type)
    x0=round(box['x']*100); y0=round(box['y']*100)
    x1=round((box['x']+box['w'])*100); y1=round((box['y']+box['h'])*100)
    # 돌출/지주형은 벽면 사각형을 "채우는" 물건이 아님 — 채우라고 하면 모델이 그 틀에
    # 별도 사진을 끼워넣는(picture-in-picture) 오류를 냄. 위치 표시로만 사용.
    projecting = any(k in (sign_type or '') for k in ('돌출','지주'))
    if projecting:
        fill_rule = ("That rectangle marks WHERE the sign is mounted — NOT its exact outline; "
                     "render the sign there at a realistic physical scale as a 3D object in the scene.")
    else:
        fill_rule = "Center the sign within that exact area and size it to fill it."
    return (f"in {box_verbal(box)}. Precisely: STRICTLY inside the rectangle spanning {x0}%–{x1}% of the image width "
            f"(from the left edge) and {y0}%–{y1}% of the image height (from the top). "
            f"{fill_rule} {plane_line(sign_type)} "
            "If any existing sign, lettering or fixture already occupies this target area, REMOVE it completely first "
            "and reconstruct the surface behind it, then install the new sign in its place — never blend the new sign with an old one. "
            "Do NOT place the sign anywhere else")

def is_lit_at_night(design):
    """야간 씬에서 간판이 실제로 발광하는지 (주간변환 프롬프트 분기용)."""
    caps = caps_for(design.get('signSubType'), design.get('signType'))
    if caps['illum']=='none': return False
    if caps['illum']=='halo_only': return 'halo' in valid_lightings(design)
    return True

def compile_prompt(design, scene):
    caps = caps_for(design.get('signSubType'), design.get('signType'))
    elements, logo_n = elements_phrase(design.get('elements',[]), caps)
    elem_join = ", then ".join(elements) if elements else "the sign text"
    kind = SIGN_KIND.get(design.get('signType'), SIGN_KIND['전면간판'])
    texts = sign_texts(design)
    txt_line = " / ".join(f'"{t}"' for t in texts) if texts else '(logo only)'
    # 고객 문구에 영문이 포함되면 "로마자/영문 금지" 문구가 주문 내용까지 지우라는 오폭이 됨
    has_latin = any(re.search(r'[A-Za-z]', t) for t in texts)
    # 시공방법(맨벽/프레임 등) 문단은 "낱글자를 벽에 붙이는" 글자형(sides=True: 채널/스카시)
    # 벽부착 간판에만 성립. 박스/판형(플렉스/금속/포인트/현판)에 넣으면 "박스 금지" 모순이 되고,
    # painted(스텐실=도장)와 돌출/어닝/지주형도 해당 없음.
    wall_mounted = (any(k in (design.get('signType') or '전면간판') for k in ('전면','실내'))
                    and caps.get('sides') and not caps.get('painted'))
    mount_block = ("\n" + mount_desc(design.get('installMethod')) + "\n") if wall_mounted else ""
    sz = size_phrase(design)
    size_block = ("\n" + sz + "\n") if sz else ""
    # 두줄/세로 + 요소 여러 개 → 배분 순서 명시 (미지정 시 모델이 임의 배치)
    layout_extra = ""
    if len(elements)>=2 and design.get('layout')=='twoline':
        layout_extra = " Stack the listed elements in order: the first on the top line, the rest below."
    elif len(elements)>=2 and design.get('layout')=='vertical':
        layout_extra = " Stack the listed elements vertically in the listed order, top to bottom."
    # 야간: 고객 사진은 보통 낮 촬영 — "전부 그대로" 지시와 밤 장면이 모순되므로
    # 장면 전환(저녁화)을 명시적으로 허용하되 구도/구조는 고정.
    # 실내간판은 하늘/가로등이 없음 → 사진 서술과 저녁화 문구를 실내용으로 분기.
    interior = '실내' in (design.get('signType') or '')
    photo_desc = "a real photograph of an interior wall inside a store" if interior else "a real photograph of a building storefront"
    if scene=='night':
        night_shift = ("dim the ambient room lighting to a cozy evening level so the sign reads clearly"
                       if interior else
                       "naturally shift the whole scene to EVENING/NIGHT — darker dusk sky, warm light in the windows, subtle street lighting")
        task_line = (f"TASK: Edit the FIRST input image ({photo_desc}) in two ways ONLY: "
                     f"(1) install a newly fabricated Korean sign on it as specified below, and (2) {night_shift}. "
                     "Keep the camera position, framing, structure and every physical object identical to the photo.")
        lock_exc = " (allowing only the overall evening lighting shift described in TASK)"
    else:
        task_line = (f"TASK: Edit the FIRST input image ({photo_desc}) to show a newly fabricated Korean sign installed on it. "
                     "Keep EVERYTHING ELSE in the photo unchanged"
                     + ("." if interior else " (building, windows, street, sky, lighting)."))
        lock_exc = ""
    p = f"""You are a professional signage visualization compositor.
{task_line}

TWO ABSOLUTE RULES (highest priority — never violate):
1. TEXT ACCURACY: The sign displays exactly this text: {txt_line}{" (plus the customer's logo as specified below)" if logo_n else ""}. Reproduce it character-for-character. Never translate, transliterate, romanize, misspell, add, or drop any character. Each Hangul character is ONE complete syllable block — never decompose it into separate jamo pieces. {"Do not add any words beyond the specified text." if has_latin else "No English subtitle or extra words."}
2. PLACEMENT LOCK: The new sign appears ONLY in the specified area. Everything outside that area stays identical to the input photo{lock_exc}.

SIGN TYPE: {kind}.

PLACEMENT: Install the sign {placement_phrase(design.get('signBox'), design.get('signType'))}.
{size_block}{mount_block}
SIGN CONTENT — the sign reads, {READ_ORDER.get(design.get('layout'),'left to right')}: {elem_join}.{' Leave a natural, even gap between consecutive elements.' if len(elements)>=2 else ''}
Layout: {LAYOUT.get(design.get('layout'),'a single horizontal line')}.{layout_extra}
Typography: keep natural, even letter spacing; never stretch, squash, or overlap the glyphs.
Typeface: {FONT.get(design.get('font'),'a bold Korean gothic typeface')}.

{construction_phrase(design)}

LIGHTING. {lighting_phrase(valid_lightings(design), design.get('lightColor'), scene, caps)}

INTEGRATION: Match the photo's exact perspective, scale, white balance and light direction, as if the sign was captured in the same single exposure by the original camera — consistent grain, focus and sharpness with the rest of the photo. The result MUST look like a REAL PHOTOGRAPH of the installed sign — indistinguishable from a real photo. Sharp focus, high detail, professional signage photography."""
    # 입력 이미지 순번 명시 — 로고/참고가 동시에 있을 때 Gemini가 역할을 헷갈리지 않도록
    # (api_generate의 첨부 순서와 일치: 건물 → 로고들 → 참고)
    img_lines=[]; n=2
    for i in range(logo_n):
        tag = f"LOGO {i+1}" if logo_n>1 else "LOGO"
        img_lines.append(f"input image #{n} is the customer's {tag} — incorporate it exactly as described in SIGN CONTENT, preserving its shapes")
        n+=1
    if design.get('refImage'):
        img_lines.append(f"input image #{n} is a STYLE REFERENCE — borrow its overall mood and finish nuances, but NEVER copy its text or logo, "
                          "and if it conflicts with the CONSTRUCTION or SIGN CONTENT sections above, those sections take priority")
        n+=1
    if design.get('_typeExample'):
        img_lines.append(f"input image #{n} is a COLLAGE OF REAL INSTALLED EXAMPLES of this exact sign type — imitate ONLY the "
                          "fabrication style, materials, mounting and lighting behavior shown there; NEVER copy any text, brand "
                          "name, logo, or color scheme from it (its shops are unrelated), and NEVER paste, inset, or reproduce "
                          "any part of that collage or its background/sky into the output — it is a style reference only, "
                          "not content to insert")
    if img_lines:
        p += "\n\nINPUT IMAGES: input image #1 is the building photograph to edit; " + "; ".join(img_lines) + "."
    # Google 공식 편집 템플릿의 표준 문구("Keep everything else ... exactly the same") 정렬
    keep_same = ("Keep everything else in the image exactly the same, preserving the original style, lighting and composition"
                 + (" (apart from the overall day-to-evening shift)" if scene=='night' else "") + ".")
    p += (f"\n\nCONSTRAINTS: {keep_same} Do NOT add any extra text, logo, watermark, or decoration beyond what is specified. "
          "Output a single photorealistic image with the SAME framing, camera angle and aspect ratio as input image #1."
          "\n\nFINAL SELF-CHECK before outputting — verify all of these are true:"
          f"\n- The sign text reads exactly {txt_line}"
          + (f" (glyph by glyph: {'; '.join(spell_out(t) for t in texts)})" if texts else "") +
          "\n- Every character is crisp, sharp and highly legible"
          "\n- The sign's construction matches the CONSTRUCTION section (correct sign type, not a different kind of sign)"
          "\n- The sign sits only inside the specified placement area; the rest of the photo is unchanged"
          + (" apart from the described evening lighting shift" if scene=='night' else "") +
          "\n- The sign is a physical object photographed IN the scene (same sky/wall/lighting), NOT an inset, overlay, or pasted picture box"
          "\n- The image looks like a real photograph, not an illustration"
          "\n\nAVOID: garbled or gibberish text, misspelled or deformed Korean characters, extra strokes, "
          "merged or split glyphs, "
          + ("" if has_latin else "romanized text, English translations, ") +
          "watermarks, cartoon/illustration/sticker look, altered surroundings, "
          "picture-in-picture insets, pasted photo patches, framed cutout boxes, any rectangular photo fragment "
          "with its own different background/sky/lighting composited onto the scene.")
    return p

# ── 세부종류 실사례 예시 이미지 (img/step2 실제 시공 사진 콜라주) ──
# 텍스트 서술만으론 한계인 '시공 스타일'을 실물 사진으로 전달. 프롬프트가 텍스트 복사를 금지.
_EXAMPLE_CACHE={}
def example_dataurl(sign_type, sub):
    # step2는 escId 변환값을 저장('현판/표찰'→'현판_표찰') — '_'도 제거해야 파일명과 일치
    s=(sub or '').replace('간판','').replace('-','').replace('/','').replace('_','')
    if s=='포인트형전면': s='포인트형'
    fn=os.path.join(os.path.dirname(os.path.abspath(__file__)),'img','step2',f"{sign_type}-{s}.JPG")
    if fn in _EXAMPLE_CACHE: return _EXAMPLE_CACHE[fn]
    durl=None
    try:
        if os.path.exists(fn):
            import base64
            with open(fn,'rb') as f:
                durl="data:image/jpeg;base64,"+base64.b64encode(f.read()).decode()
    except OSError:
        durl=None
    _EXAMPLE_CACHE[fn]=durl
    return durl

# ── 이미지 유틸 ──
def dataurl_parts(durl):
    if not durl: return None
    if ',' in durl:
        head,b64=durl.split(',',1)
        mime='image/png'
        if 'image/' in head: mime=head.split('image/')[1].split(';')[0]; mime='image/'+mime
    else:
        b64=durl; mime='image/png'
    return {"inlineData":{"mimeType":mime,"data":b64}}

def gemini_generate(prompt, image_dataurls):
    key=os.environ.get('GEMINI_API_KEY')
    parts=[{"text":prompt}]
    for d in image_dataurls:
        ip=dataurl_parts(d)
        if ip: parts.append(ip)
    # 낮은 temperature = 프롬프트 충실도 우선 (글자/위치 드리프트 감소)
    body={"contents":[{"parts":parts}],"generationConfig":{"responseModalities":["IMAGE"],"temperature":0.35}}
    r=None
    for attempt in (1,2):
        r=requests.post(GEMINI_URL.format(m=GEMINI_MODEL), params={"key":key},
                        json=body, timeout=180)
        # 과부하/일시 오류는 1회 재시도 — 고객 결제 건이 일시 장애로 실패하지 않게
        if r.status_code in (429,500,503) and attempt==1:
            import time; time.sleep(2.5); continue
        break
    if r.status_code!=200:
        raise RuntimeError(f"Gemini {r.status_code}: {r.text[:300]}")
    data=r.json()
    cands=data.get('candidates',[])
    if not cands: raise RuntimeError("no candidates: "+json.dumps(data)[:300])
    for part in cands[0].get('content',{}).get('parts',[]):
        inl=part.get('inlineData') or part.get('inline_data')
        if inl and inl.get('data'):
            return "data:image/png;base64,"+inl['data']
    # 이미지 없음 → 텍스트(거부 사유 등) 노출
    txts=[p.get('text','') for p in cands[0].get('content',{}).get('parts',[])]
    raise RuntimeError("이미지 미생성: "+(" ".join(txts)[:300] or json.dumps(data)[:300]))

@app.after_request
def cors(resp):
    resp.headers['Access-Control-Allow-Origin']='*'
    resp.headers['Access-Control-Allow-Headers']='Content-Type'
    resp.headers['Access-Control-Allow-Methods']='POST, OPTIONS'
    return resp

# 프롬프트만 확인 (키 불필요)
@app.route('/api/compile', methods=['POST','OPTIONS'])
def api_compile():
    if request.method=='OPTIONS': return ('',204)
    d=request.get_json(force=True)
    return jsonify(day=compile_prompt(d,'day'), night=compile_prompt(d,'night'))

@app.route('/api/generate', methods=['POST','OPTIONS'])
def api_generate():
    if request.method=='OPTIONS': return ('',204)
    if not os.environ.get('GEMINI_API_KEY'):
        return jsonify(error='GEMINI_API_KEY 없음 — .env에 키를 넣어주세요 (aistudio.google.com)'),400
    d=request.get_json(force=True)
    # 입력 이미지: 건물 → 로고들 → 참고
    imgs=[]
    if d.get('buildingPhoto'): imgs.append(d['buildingPhoto'])
    for el in d.get('elements',[]):
        if el.get('type')=='logo' and el.get('img'): imgs.append(el['img'])
    if d.get('refImage'): imgs.append(d['refImage'])
    # 세부종류 실사례 콜라주를 마지막 입력으로 첨부 (프롬프트의 순번 서술과 일치)
    ex = example_dataurl(d.get('signType'), d.get('signSubType'))
    if ex:
        imgs.append(ex); d['_typeExample']=True
    if not d.get('buildingPhoto'):
        return jsonify(error='건물 사진이 없어요 (step3에서 사진 업로드 필요)'),400
    texts = sign_texts(d)
    logo_n = sum(1 for el in d.get('elements',[]) if el.get('type')=='logo' and el.get('img'))
    if not texts and not logo_n:
        return jsonify(error='간판에 넣을 문구 또는 로고가 없어요 (step4에서 입력 필요)'),400
    txt_lock = (" The sign text reads exactly: " + " / ".join(f'"{t}"' for t in texts) +
                " — keep every Korean character glyph-for-glyph identical, never redraw or respell it.") if texts else ""
    # 비발광 간판(스카시 비후광/금속/패브릭/현판/스텐실/어닝)은 밤 사진에 발광이 없음 —
    # "불을 꺼라" 지시가 가면 없는 glow를 지우려다 간판을 훼손할 수 있어 분기
    avoid = (" AVOID: garbled or deformed Korean characters, extra strokes, merged glyphs, "
             "moving or resizing the sign, altering any object, watermarks.")
    # 주간 변환에 고객 원본 사진을 2번째 입력으로 첨부 — 야간 렌더만으로 낮을 재생성하면
    # 건물 디테일이 원본과 달라질 수 있음(드리프트). 원본이 건물의 진짜 낮 모습 레퍼런스.
    sign_state = ("The sign is switched OFF in daytime: it shows its solid daytime appearance with NO glow and NO light spill. "
                  if is_lit_at_night(d) else
                  "The sign is not illuminated; it keeps its exact material appearance. ")
    day_from_night = (
        "You are given TWO images. Input image #1 is a nighttime render of a storefront with a newly installed sign. "
        "Input image #2 is the ORIGINAL photograph of the SAME building (before the new sign was installed). "
        "Re-render image #1 as a clear DAYTIME photograph in bright natural daylight: restore the building, wall textures, "
        "windows, street and sky to their TRUE appearance as seen in image #2 (if image #2 was itself taken at night, "
        "infer the same building's natural daytime appearance from it), while keeping the NEW SIGN from image #1 "
        "EXACTLY as it is — same position, size, shape, colors, materials and the exact same text. "
        + sign_state +
        "Do not move or alter anything else. Same framing and aspect ratio as image #1. Photorealistic."
        + txt_lock + avoid
    )
    try:
        night = gemini_generate(compile_prompt(d,'night'), imgs)
        # 낮 버전 = 밤 결과(간판 유지) + 원본 사진(건물 복원 레퍼런스)
        day   = gemini_generate(day_from_night, [night, d['buildingPhoto']])
    except Exception as e:
        return jsonify(error=str(e)),500
    return jsonify(night=night, day=day)

@app.route('/api/erase', methods=['POST','OPTIONS'])
def api_erase():
    if request.method=='OPTIONS': return ('',204)
    if not os.environ.get('GEMINI_API_KEY'):
        return jsonify(error='GEMINI_API_KEY 없음 (.env)'),400
    d=request.get_json(force=True)
    image=d.get('image'); mask=d.get('mask')
    if not image or not mask:
        return jsonify(error='image/mask 필요'),400
    prompt=(
        "You are a photo cleanup / object-removal tool. You are given TWO images: "
        "input image #1 is a photograph of a building storefront, and input image #2 is a black-and-white MASK of the same size where WHITE marks the areas to remove. "
        "Remove whatever is in the WHITE-masked areas (e.g., existing signage, lettering, logos) from the photograph and realistically reconstruct those areas to seamlessly match the surrounding wall/surface — continue its texture, color, lighting, shadows and perspective as if nothing was ever mounted there. "
        "Keep everything else in the image exactly the same, preserving the original style, lighting and composition. "
        "Output a single clean photorealistic image with the SAME framing and aspect ratio as input image #1. "
        "AVOID: adding any new object or text, leftover outlines or ghosting of the removed sign, blur patches, watermarks."
    )
    try:
        out=gemini_generate(prompt, [image, mask])
    except Exception as e:
        return jsonify(error=str(e)),500
    return jsonify(image=out)

@app.route('/')
def root():
    # 위저드 시작점은 step1 (기존: step4로 바로 열림)
    return send_from_directory('.', 'step1-form.html')

if __name__=='__main__':
    print("server: http://localhost:5000  (Gemini:", GEMINI_MODEL, ")")
    app.run(host='0.0.0.0', port=5000, debug=False)
