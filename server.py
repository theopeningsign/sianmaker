#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사인메이커 생성 백엔드 (Gemini).
step1~4 디자인 선택값 → 정밀 영문 프롬프트 컴파일 → Gemini 이미지(건물사진 편집)로
주간/야간 시안 생성. Python 3.8 호환 위해 SDK 대신 REST API 직접 호출.

실행: python server.py  (http://localhost:5000)
.env:  GEMINI_API_KEY=...      (aistudio.google.com 에서 발급, 사용자가 직접 입력)
필요:  pip install flask python-dotenv requests
"""
import os, io, base64, json
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
FONT = {
    'gothic_bold':'a bold, heavy Korean sans-serif (gothic) typeface',
    'gothic_round':'a rounded, friendly Korean gothic typeface',
    'gothic_basic':'a clean standard Korean gothic typeface',
    'myeongjo':'an elegant Korean serif (Myeongjo) typeface',
    'hand':'a hand-written Korean brush-script style',
}
DEPTH = {
    'thin':'shallow channel depth',
    'normal':'medium channel depth',
    'thick':'deep, thick channel returns',
    'xthick':'very deep, bold 3D channel returns',
}
LAYOUT = {'horizontal':'a single horizontal line','twoline':'two stacked lines','vertical':'a vertical column'}
LOGO_TREAT = {'asis':'reproduced as-is as a flat printed panel','channel':'fabricated as dimensional 3D channel pieces like the letters','metal':'fabricated in dimensional brushed metal'}
LOGO_SIZE = {'small':'smaller than the text','normal':'about the same height as the text','large':'larger than the text'}
MOUNT = {
 '맨벽': ("MOUNTING (bare-wall / 맨벽 — VERY IMPORTANT): each individual letter and the logo is fixed DIRECTLY onto the "
         "bare wall surface with small hidden standoff spacers. There is absolutely NO backing panel, NO sign box, NO frame, "
         "and NO horizontal rail/bar behind the letters. The existing wall surface and its texture stay fully visible between, "
         "around and behind every letter. Do NOT put the letters on a dark rectangular plate. Each letter casts a soft contact shadow on the wall."),
 '전면프레임': ("MOUNTING (front frame panel / 전면프레임): the letters are mounted on a solid rectangular backing panel that spans the "
            "sign area, with a clean flat-colored background and a neat edge frame around it."),
 '프레임바': ("MOUNTING (frame bar / 프레임바): the letters are mounted on a slim horizontal frame bar / rail structure behind them "
           "(NOT a full solid panel); the bar/rail is visible behind the row of letters, the wall shows above and below it."),
 '파사드': ("MOUNTING (facade / 파사드): the sign is integrated into a designed architectural facade surround (clad panel / premium "
          "finish) framing the storefront entrance."),
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
    for lim,nm in names:
        if hue<lim: return nm
    return 'red'

def col(hex):
    return f"{hex_name(hex)} ({hex})" if hex else "default"

def colors_phrase(colors_list):
    """글자별 색 리스트 → '모두 X' 또는 글자별 나열."""
    vals=[c for c in colors_list if c]
    if not vals: return None
    uniq=set(vals)
    if len(uniq)==1: return col(vals[0])
    return None  # 글자별 다름 → 호출부에서 글자별 처리

def elements_phrase(elements):
    """요소(텍스트/로고) → 영문 구성 설명. 로고 개수도 반환."""
    parts=[]; logo_n=0
    for el in elements:
        if el.get('type')=='logo':
            logo_n+=1
            t=LOGO_TREAT.get(el.get('treat'),'as shown')
            s=LOGO_SIZE.get(el.get('size'),'about the same height as the text')
            cm = el.get('colorMode')
            cdesc = (f"recolored to solid {col(el.get('color'))}" if cm=='mono' else "keeping its original colors")
            parts.append(f"the provided LOGO image, {t}, {s}, {cdesc}")
        else:
            txt=el.get('text','').strip()
            if not txt: continue
            faces=el.get('faceColors') or []
            sides=el.get('sideColors') or []
            fp=colors_phrase(faces); sp=colors_phrase(sides)
            chars=[c for c in txt if c.strip()!='']
            if fp:
                facedesc=f"{fp} faces"
            else:
                per=", ".join(f"'{ch}'={col(faces[i])}" for i,ch in enumerate(chars) if i<len(faces) and faces[i])
                facedesc=f"per-letter face colors ({per})"
            sidedesc=f"{sp} side returns" if sp else "white side returns"
            parts.append(f'the word "{txt}" with {facedesc} and {sidedesc}')
    return parts, logo_n

def lighting_phrase(lightings, light_color, scene):
    if scene=='day':
        return ("Scene & time: clear daytime. The sign is switched OFF (not illuminated); "
                "the faces show their solid colors under natural daylight, no glow.")
    # night
    if light_color=='same': gc="in each part's own color"
    elif light_color=='white': gc="in bright white"
    elif light_color and light_color.startswith('#'): gc=f"in {col(light_color)}"
    else: gc="brightly"
    eff=[]
    if 'front' in lightings: eff.append(f"the letter faces are internally LED-illuminated and glow evenly {gc}")
    if 'side'  in lightings: eff.append(f"ONLY the side returns emit light and glow {gc}, while the front faces stay opaque (rim/side-lit channel)")
    if 'halo'  in lightings: eff.append(f"a soft halo of light glows from behind the letters onto the wall {gc} (back-lit halo channel)")
    if not eff: eff.append("the sign is softly illuminated")
    return ("Scene & time: evening/night. The sign is switched ON and illuminated; "
            + "; ".join(eff) + ". The light spills softly onto the surrounding wall.")

def placement_phrase(box):
    if not box or not box.get('w'):
        return "in the main sign area of the storefront wall indicated by the customer"
    x0=round(box['x']*100); y0=round(box['y']*100)
    x1=round((box['x']+box['w'])*100); y1=round((box['y']+box['h'])*100)
    return (f"STRICTLY inside the rectangular area spanning {x0}%–{x1}% from the left edge and "
            f"{y0}%–{y1}% from the top of the image. Center the sign within that exact area and size it to fill it. "
            "Do NOT place the sign anywhere else. Do NOT move, cover, replace, hide, or alter any existing "
            "signage, awning, lettering or structure that is outside this area — leave the rest of the building exactly as in the photo")

def compile_prompt(design, scene):
    elements, logo_n = elements_phrase(design.get('elements',[]))
    elem_join = ", then ".join(elements) if elements else "the sign text"
    p = f"""You are a professional signage visualization compositor.
TASK: Edit the FIRST input image (a real photograph of a building storefront) to show a fabricated Korean CHANNEL-LETTER sign installed on it. Keep EVERYTHING ELSE in the photo unchanged (building, windows, existing signs, street, sky, lighting).

PLACEMENT: Install the sign {placement_phrase(design.get('signBox'))}.

{mount_desc(design.get('installMethod'))}

SIGN CONTENT (render EXACTLY, character-for-character — never translate, transliterate, romanize, add, or drop any character; keep perfect Korean spelling):
The sign reads, left to right: {elem_join}.
Layout: {LAYOUT.get(design.get('layout'),'a single horizontal line')}.
Typeface: {FONT.get(design.get('font'),'a bold Korean gothic typeface')}.

CONSTRUCTION: individually fabricated dimensional 3D channel letters, {DEPTH.get(design.get('depth'),'medium channel depth')}. Faces made of {MAT.get(design.get('material'),'glossy acrylic')}, with clean metal side returns. Realistic thickness and depth.

LIGHTING. {lighting_phrase(design.get('lightings',[]), design.get('lightColor'), scene)}

INTEGRATION: Match the photo's exact perspective, scale, white balance and light direction. The result MUST look like a REAL PHOTOGRAPH of the installed sign — indistinguishable from a real photo. Sharp focus, high detail, professional signage photography. Do NOT make it look like a cartoon, illustration, sticker, or flat graphic."""
    if logo_n:
        p += "\n\nThe LOGO image is provided as a separate input image; incorporate it as described above."
    if design.get('refImage'):
        p += "\n\nA STYLE REFERENCE image is also provided as an input — match its material/finish/mood for the sign (but NOT its text)."
    p += "\n\nCONSTRAINTS: Do NOT alter the building or surroundings. Do NOT add any extra text, logo, watermark, or decoration beyond what is specified. Output a single photorealistic image."
    return p

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
    body={"contents":[{"parts":parts}],"generationConfig":{"responseModalities":["IMAGE"]}}
    r=requests.post(GEMINI_URL.format(m=GEMINI_MODEL), params={"key":key},
                    json=body, timeout=180)
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
    if not d.get('buildingPhoto'):
        return jsonify(error='건물 사진이 없어요 (step3에서 사진 업로드 필요)'),400
    day_from_night = (
        "This is a nighttime photograph of a storefront with an illuminated channel-letter sign. "
        "Re-render the EXACT same scene as a clear DAYTIME photograph in bright natural daylight. "
        "The sign is switched OFF: the letter faces show their solid colors with NO glow and NO light spill. "
        "Keep the building, the sign, its exact position, size, shape, colors and the exact Korean text 100% identical — "
        "change ONLY the time of day (to daytime) and turn the sign's illumination off. Do not move or alter anything else. Photorealistic."
    )
    try:
        night = gemini_generate(compile_prompt(d,'night'), imgs)
        # 낮 버전은 밤 결과를 그대로 낮으로 변환 → 위치/글자/구성 동일하게 고정
        day   = gemini_generate(day_from_night, [night])
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
        "(1) a photograph of a building storefront, and (2) a black-and-white MASK of the same size where WHITE marks the areas to remove. "
        "Remove whatever is in the WHITE-masked areas (e.g., existing signage, lettering, logos) from the photograph and realistically reconstruct those areas to seamlessly match the surrounding wall/surface (texture, color, lighting, shadows). "
        "Keep the entire rest of the photo 100% identical. Do NOT add any new object, text, or watermark. Output a single clean photorealistic image, same composition and size."
    )
    try:
        out=gemini_generate(prompt, [image, mask])
    except Exception as e:
        return jsonify(error=str(e)),500
    return jsonify(image=out)

@app.route('/')
def root():
    return send_from_directory('.', 'step4-design.html')

if __name__=='__main__':
    print("server: http://localhost:5000  (Gemini:", GEMINI_MODEL, ")")
    app.run(host='0.0.0.0', port=5000, debug=False)
