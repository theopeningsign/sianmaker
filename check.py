#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""사인메이커 회귀 점검 스크립트.
코드 수정 후 반드시 실행:  python check.py        (서버 자동 기동/종료)
                        python check.py --live  (이미 떠있는 :5000 사용)
전 항목 PASS가 아니면 "완료"라고 말하지 말 것. (CLAUDE.md 규칙)

점검 항목:
  A. 5개 페이지 인라인 JS 문법 (node --check)
  B. 페이지 간 localStorage 계약 (쓰는 키 = 읽는 키)
  C. 죽은 관문/차단 코드 잔재 (준비 중 alert 등)
  D. /api/compile 전 조합(25) — 종류별 시공 마커 + 실사례 콜라주 매칭
  E. 서버 유닛: escId 변환값 매칭, 메탈 발광 보정, 영문 혼용, 사이즈 반영
(유료 생성 호출은 하지 않음 — 비용 0원)
"""
import re, os, sys, io, json, time, subprocess, tempfile

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)
sys.stdout.reconfigure(encoding='utf-8', errors='replace') if hasattr(sys.stdout,'reconfigure') else None

PASS=[]; FAIL=[]
def chk(name, ok, detail=''):
    (PASS if ok else FAIL).append(name)
    print(('PASS  ' if ok else 'FAIL  ')+name+(('  -- '+detail) if (detail and not ok) else ''))

PAGES=['step1-form.html','step2-material.html','step3-size.html','step4-design.html','canvas-editor.html']

# ── A. JS 문법 ──
def check_js_syntax():
    for f in PAGES:
        src=open(f,encoding='utf-8').read()
        scripts=[m for m in re.findall(r'<script(?![^>]*src=)[^>]*>(.*?)</script>', src, re.S) if m.strip()]
        ok=True; msg=''
        for sc in scripts:
            with tempfile.NamedTemporaryFile('w',suffix='.js',delete=False,encoding='utf-8') as t:
                t.write(sc); p=t.name
            r=subprocess.run(['node','--check',p],capture_output=True,text=True,shell=True)
            os.unlink(p)
            if r.returncode!=0:
                ok=False; msg=(r.stderr or '').strip().splitlines()[-1][:120]; break
        chk(f'A. JS문법 {f}', ok, msg)

# ── B. localStorage 계약 ──
def check_storage_contract():
    read_keys={}   # key -> 읽는 페이지
    write_keys={}  # key -> 쓰는 페이지
    for f in PAGES:
        src=open(f,encoding='utf-8').read()
        for k in re.findall(r"localStorage\.getItem\(\s*'([^']+)'", src): read_keys.setdefault(k,set()).add(f)
        for k in re.findall(r"localStorage\.setItem\(\s*'([^']+)'", src): write_keys.setdefault(k,set()).add(f)
    # 위저드 필수 계약: step4가 읽는 키는 step1~3 어딘가에서 써야 함
    required={'signType':'step1-form.html','signSubType':'step2-material.html',
              'installMethod':'step2-material.html','signWidth':'step3-size.html',
              'signHeight':'step3-size.html','signRatio':'step3-size.html',
              'signBox':'step3-size.html','buildingPhoto':'step3-size.html'}
    for k,writer in required.items():
        chk(f'B. 계약 {k}: {writer}가 쓰고 step4가 읽음',
            k in write_keys and writer in write_keys.get(k,set()) and
            any('step4' in r for r in read_keys.get(k,set())),
            f'write={sorted(write_keys.get(k,set()))} read={sorted(read_keys.get(k,set()))}')

# ── C. 차단/잔재 코드 ──
def check_no_gates():
    s3=open('step3-size.html',encoding='utf-8').read()
    chk('C. step3 준비중 관문 없음', '준비 중' not in s3 and '준비중' not in s3)
    s4=open('step4-design.html',encoding='utf-8').read()
    chk('C. step4 생성 API 연결(:5000/api/generate)', '/api/generate' in s4)
    chk('C. step3 지우기 API 연결(:5000/api/erase)', '/api/erase' in s3)

# ── D/E. 서버 ──
# step2-material.html의 SUBTYPES id를 escId 변환한 "실제 localStorage 저장값" 그대로.
# step2에서 id를 바꾸면 여기도 같이 갱신할 것.
COMBOS={
 '전면간판':['채널간판','스카시간판','플렉스간판','네온간판','스텐실간판','포인트형전면간판','금속철제간판','기타'],
 '돌출간판':['채널','플렉스','포인트','포인트-큐브','네온','패브릭','기타조형물'],
 '어닝간판':['고정식','접이식','기타'],
 '지주형간판':['플렉스','기타'],
 '실내간판':['채널','스카시','현판_표찰','네온사인','기타'],
}
MARK={'채널':'CHANNEL','스카시':'FLAT CUT-OUT','플렉스':'FLEX-FACE','네온':'NEON','스텐실':'PAINTED WALL',
      '포인트-큐브':'CUBE','포인트':'POINT accent','금속':'METAL sign','패브릭':'FABRIC','현판':'PLAQUE',
      '조형물':'SCULPTURAL','고정식':'FIXED-FRAME','접이식':'RETRACTABLE'}
BASE={'installMethod':'맨벽',
 'elements':[{'type':'text','text':'간판의품격','faceColors':['#ff2d2d']*5,'sideColors':['#fff']*5}],
 'layout':'horizontal','material':'acrylic_glossy','font':'gothic_bold','depth':'thick',
 'lightings':['front'],'lightColor':'same','signBox':{'x':0.2,'y':0.14,'w':0.6,'h':0.12}}

def check_server(base_url):
    import requests, server
    def compile(d):
        r=requests.post(base_url+'/api/compile',json=d,timeout=30)
        r.raise_for_status(); j=r.json(); return j['night']+'\n<<DAY>>\n'+j['day']
    # D. 전 조합
    fails=[]
    for t,subs in COMBOS.items():
        for s in subs:
            d=dict(BASE); d['signType']=t; d['signSubType']=s
            try:
                p=compile(d)
                mk=next((m for k,m in MARK.items() if k in s), None)
                if mk and mk not in p: fails.append(f'{t}/{s}: marker {mk} 누락')
                if not server.example_dataurl(t,s): fails.append(f'{t}/{s}: 실사례 콜라주 매칭 실패')
            except Exception as e:
                fails.append(f'{t}/{s}: {e}')
    chk(f'D. 전 조합 컴파일+마커+실사례 ({sum(len(v) for v in COMBOS.values())}개)', not fails, '; '.join(fails[:4]))
    # E. 유닛들
    d=dict(BASE); d['signType']='전면간판'; d['signSubType']='채널간판'; d['material']='metal'; d['lightings']=['front']
    chk('E. 메탈+전면발광→후광 보정', 'halo of light' in compile(d))
    d=dict(BASE); d['signType']='전면간판'; d['signSubType']='채널간판'
    d['elements']=[{'type':'text','text':'CLASSY 컴퍼니','faceColors':[None]*9,'sideColors':[None]*9}]
    chk('E. 영문 혼용시 로마자금지 문구 제외', 'romanized text, English translations' not in compile(d))
    d=dict(BASE); d['signType']='전면간판'; d['signSubType']='채널간판'; d['signWidthCm']='300'; d['signHeightCm']='60'
    chk('E. 실물사이즈 반영(300cm)', '300 cm' in compile(d))
    d=dict(BASE); d['signType']='돌출간판'; d['signSubType']='채널간판'
    chk('E. 돌출=수직설치(벽평면 아님)', 'PROJECTING' in compile(d))

def main():
    live = '--live' in sys.argv
    check_js_syntax()
    check_storage_contract()
    check_no_gates()
    proc=None
    base='http://localhost:5000'
    try:
        import requests
        up=False
        try: up = requests.get(base+'/',timeout=2).status_code==200
        except Exception: pass
        if not up:
            if live:
                chk('D/E. 서버 접속(:5000)', False, '서버가 떠있지 않음'); raise SystemExit
            proc=subprocess.Popen([sys.executable,'server.py'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            for _ in range(20):
                time.sleep(0.5)
                try:
                    if requests.get(base+'/',timeout=2).status_code==200: break
                except Exception: pass
        check_server(base)
    finally:
        if proc: proc.terminate()
    print('\n'+'='*46)
    print(f'RESULT: {len(PASS)} PASS / {len(FAIL)} FAIL')
    if FAIL:
        print('FAILED ITEMS:'); [print('  - '+f) for f in FAIL]
        sys.exit(1)
    print('ALL GREEN')

if __name__=='__main__':
    main()
