import React, { useState, useRef, useEffect, useCallback } from 'react';

const FONT_FAMILY_MAP = {
  malgun: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  nanumgothic: "'Nanum Gothic', sans-serif",
  nanumbarungothic: "'Nanum Barun Gothic', sans-serif",
  gulim: 'Gulim, sans-serif',
  batang: 'Batang, serif',
};

// 모서리 핸들 설정: xFactor/yFactor = 드래그 방향에 따른 크기 변화 부호
const HANDLE_CONFIG = [
  { id: 'nw', left: '0%',   top: '0%',   xFactor: -1, yFactor: -1, cursor: 'nw-resize' },
  { id: 'ne', left: '100%', top: '0%',   xFactor:  1, yFactor: -1, cursor: 'ne-resize' },
  { id: 'se', left: '100%', top: '100%', xFactor:  1, yFactor:  1, cursor: 'se-resize' },
  { id: 'sw', left: '0%',   top: '100%', xFactor: -1, yFactor:  1, cursor: 'sw-resize' },
];

/** 2D 벡터를 angleDeg만큼 회전 */
const rotateVec = (x, y, deg) => {
  const r = (deg * Math.PI) / 180;
  return {
    x: x * Math.cos(r) - y * Math.sin(r),
    y: x * Math.sin(r) + y * Math.cos(r),
  };
};

const SignboardTransform = ({
  signboards = [],
  originalSignboards = [],
  imageSize = { width: 1, height: 1 },
  onTransformChange,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [transforms, setTransforms] = useState({});
  const [dragState, setDragState] = useState(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  // 컨테이너 크기 추적 (폰트 사이즈 계산용)
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 간판별 transform 초기화
  useEffect(() => {
    if (imageSize.width <= 1 && imageSize.height <= 1) return;

    setTransforms(prev => {
      const next = { ...prev };
      let changed = false;

      signboards.forEach(sb => {
        const origSb = originalSignboards.find(s => s.id === sb.id);
        const formData = origSb?.formData || {};
        const initRotation = formData.rotation || 0;

        const pts = sb.polygon_points || [];
        if (pts.length < 4) return;

        const xs = pts.map(p => p[0]);
        const ys = pts.map(p => p[1]);
        const areaLeft   = Math.min(...xs);
        const areaTop    = Math.min(...ys);
        const areaRight  = Math.max(...xs);
        const areaBottom = Math.max(...ys);
        const areaW = areaRight - areaLeft;
        const areaH = areaBottom - areaTop;

        const existing = next[sb.id];

        if (existing) {
          return; // 이미 초기화된 경우 변경 없음
        }

        // 최초 초기화: 편집 박스 = 실제 간판 polygon 전체 영역
        const boxW  = (areaW / imageSize.width)  * 100;
        const boxH  = (areaH / imageSize.height) * 100;
        const boxCX = ((areaLeft + areaW / 2) / imageSize.width)  * 100;
        const boxCY = ((areaTop  + areaH / 2) / imageSize.height) * 100;

        next[sb.id] = {
          x: boxCX,
          y: boxCY,
          width:  boxW,
          height: boxH,
          rotation: initRotation,
          // 백엔드 출력 계산을 위한 원래 간판 영역 (이미지 %)
          _area: {
            x: (areaLeft / imageSize.width)  * 100,
            y: (areaTop  / imageSize.height) * 100,
            w: (areaW    / imageSize.width)  * 100,
            h: (areaH    / imageSize.height) * 100,
          },
        };
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [signboards, imageSize, originalSignboards]);

  /**
   * transform → 백엔드 파라미터 변환
   * - newPolygonPoints: 박스의 4개 모서리를 이미지 픽셀 좌표로 변환
   *   → 백엔드가 이 좌표로 perspective transform 수행
   *   → 이동/크기/회전이 모두 polygon에 반영됨
   * - textPositionX/Y = 50, rotation = 0 (polygon에 이미 반영됨)
   */
  const toOutput = useCallback((id, t) => {
    if (!t) return null;

    // 박스 중심 (이미지 픽셀 좌표)
    const cxPx = (t.x / 100) * imageSize.width;
    const cyPx = (t.y / 100) * imageSize.height;
    const hwPx = (t.width  / 100) * imageSize.width  / 2;
    const hhPx = (t.height / 100) * imageSize.height / 2;

    // 4개 모서리: TL → TR → BR → BL (회전 적용)
    const newPolygonPoints = [
      [-hwPx, -hhPx],
      [ hwPx, -hhPx],
      [ hwPx,  hhPx],
      [-hwPx,  hhPx],
    ].map(([rx, ry]) => {
      const rot = rotateVec(rx, ry, t.rotation);
      return [Math.round(cxPx + rot.x), Math.round(cyPx + rot.y)];
    });

    return {
      id,
      newPolygonPoints,   // 백엔드 polygon_points 업데이트용
      textPositionX: 50,  // polygon에 위치가 반영됐으므로 중앙 고정
      textPositionY: 50,
      rotation: 0,        // polygon에 회전이 반영됐으므로 0
    };
  }, [imageSize]);

  // transform 업데이트 + 부모에 알림
  const updateTransform = useCallback((id, updates) => {
    setTransforms(prev => {
      const newT = { ...prev[id], ...updates };
      const next = { ...prev, [id]: newT };

      if (onTransformChange) {
        const output = {};
        Object.keys(next).forEach(tid => {
          const o = toOutput(parseInt(tid), next[tid]);
          if (o) output[tid] = o;
        });
        onTransformChange(output);
      }

      return next;
    });
  }, [onTransformChange, toOutput]);

  // 마우스 위치 → 컨테이너 기준 % 좌표
  const getMousePct = useCallback((e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width)  * 100,
      y: ((e.clientY - rect.top)  / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e, id, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const pos = getMousePct(e);
    const t = transforms[id];
    if (!t) return;

    setDragState({
      id,
      mode,
      startPos: pos,
      startTransform: { ...t },
      // 회전 드래그: 시작 각도 기록 (클릭 지점에서 박스 중심까지의 각도)
      startAngle: mode === 'rotate'
        ? Math.atan2(pos.y - t.y, pos.x - t.x) * (180 / Math.PI)
        : 0,
    });
  }, [transforms, getMousePct]);

  // 드래그 중 mousemove / mouseup 처리
  useEffect(() => {
    if (!dragState) return;

    const onMove = (e) => {
      const pos = getMousePct(e);
      const { id, mode, startPos, startTransform: t, startAngle } = dragState;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      if (mode === 'move') {
        updateTransform(id, { x: t.x + dx, y: t.y + dy });

      } else if (mode === 'rotate') {
        // 현재 마우스가 박스 중심 기준으로 어느 각도인지 계산
        const curAngle = Math.atan2(pos.y - t.y, pos.x - t.x) * (180 / Math.PI);
        updateTransform(id, { rotation: t.rotation + (curAngle - startAngle) });

      } else if (mode.startsWith('resize-')) {
        const handleId = mode.replace('resize-', '');
        const handle = HANDLE_CONFIG.find(h => h.id === handleId);
        if (!handle) return;

        // 드래그 벡터를 박스 로컬 좌표계로 변환 (회전 반영)
        const local = rotateVec(dx, dy, -t.rotation);

        // 각 핸들의 xFactor/yFactor에 따라 너비/높이 변화량 결정
        const dw = local.x * handle.xFactor;
        const dh = local.y * handle.yFactor;

        const newWidth  = Math.max(3, t.width  + dw);
        const newHeight = Math.max(3, t.height + dh);

        // 중심은 드래그 벡터의 절반만큼 이동 (고정 모서리를 기준으로)
        // xFactor² = yFactor² = 1 이므로 centerDelta = (local/2) rotated back
        const centerDelta = rotateVec(local.x / 2, local.y / 2, t.rotation);

        updateTransform(id, {
          width:  newWidth,
          height: newHeight,
          x: t.x + centerDelta.x,
          y: t.y + centerDelta.y,
        });
      }
    };

    const onUp = () => setDragState(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [dragState, getMousePct, updateTransform]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0"
      style={{ pointerEvents: 'none', zIndex: 100 }}
      onClick={() => setSelectedId(null)}
    >
      {signboards.map(sb => {
        const t = transforms[sb.id];
        if (!t) return null;
        const isSelected = selectedId === sb.id;
        const isMoving = dragState?.id === sb.id && dragState.mode === 'move';

        // formData에서 미리보기 스타일 가져오기
        const origSb = originalSignboards.find(s => s.id === sb.id);
        const formData = origSb?.formData || {};
        const bgColor       = formData.bgColor    || '#1B3A6B';
        const textColor     = formData.textColor  || '#FFFFFF';
        const fontFamily    = FONT_FAMILY_MAP[formData.fontFamily] || FONT_FAMILY_MAP.malgun;
        const fontWeight    = formData.fontWeight  || '700';
        const textDirection = formData.textDirection || 'horizontal';
        const isImageMode   = formData.signboardInputType === 'image';
        const displayText   = sb.text || formData.text || '';

        // 폰트 사이즈: 폭과 높이 모두 고려해서 실제 렌더와 비슷하게
        const boxWidthPx  = (t.width  / 100) * containerSize.width;
        const boxHeightPx = (t.height / 100) * containerSize.height;

        // 줄바꿈 처리: 명시적 개행(\n)만 허용
        const lines = (displayText || '').split('\n');
        const maxLineLen = Math.max(1, ...lines.map(l => l.length || 1));
        const lineCount  = lines.length || 1;

        // 높이 기준: 줄 수에 맞게 분배
        const fontSzByHeight = Math.max(10, (boxHeightPx * 0.82) / lineCount);
        // 폭 기준: 가장 긴 줄이 폭을 넘지 않도록 (한글 1자 ≈ 1em)
        const fontSzByWidth  = Math.max(10, (boxWidthPx  * 0.90) / maxLineLen);
        // 둘 중 작은 값 사용
        const approxFontSz = Math.min(fontSzByHeight, fontSzByWidth);

        const output = toOutput(sb.id, t);

        return (
          <React.Fragment key={sb.id}>
            {/* ── 간판 박스 ── */}
            <div
              style={{
                position: 'absolute',
                left: `${t.x}%`,
                top:  `${t.y}%`,
                width:  `${t.width}%`,
                height: `${t.height}%`,
                transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                transformOrigin: 'center',
                border: isSelected
                  ? '2px solid #3B82F6'
                  : '1px dashed rgba(255,255,255,0.5)',
                cursor: isMoving ? 'grabbing' : 'grab',
                pointerEvents: 'auto',
                zIndex: isSelected ? 10 : 1,
                overflow: 'visible',
                borderRadius: 3,
                boxShadow: isSelected
                  ? '0 0 0 1px rgba(59,130,246,0.3), 0 4px 16px rgba(0,0,0,0.4)'
                  : '0 2px 6px rgba(0,0,0,0.2)',
              }}
              onMouseDown={(e) => handleMouseDown(e, sb.id, 'move')}
              onClick={(e) => { e.stopPropagation(); setSelectedId(sb.id); }}
            >
              {/* ── 배경 + 텍스트 미리보기 ── */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: bgColor,
                  opacity: 0.85,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  writingMode: textDirection === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                  pointerEvents: 'none',
                  borderRadius: 2,
                }}
              >
                {isImageMode ? (
                  <span style={{
                    color: 'rgba(255,255,255,0.5)',
                    fontSize: Math.max(10, approxFontSz * 0.5),
                  }}>
                    📷 이미지
                  </span>
                ) : (
                  <span style={{
                    color: textColor,
                    fontFamily,
                    fontWeight,
                    fontSize: approxFontSz,
                    textAlign: 'center',
                    padding: '4px 8px',
                    whiteSpace: 'pre',      // 명시적 개행만 허용, 자동 줄바꿈 없음
                    lineHeight: 1.2,
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}>
                    {displayText || '텍스트를 입력하세요'}
                  </span>
                )}
              </div>

              {/* ── 상단 라벨 ── */}
              <div style={{
                position: 'absolute',
                top: -22,
                left: 0,
                backgroundColor: isSelected ? '#3B82F6' : 'rgba(0,0,0,0.7)',
                color: 'white',
                fontSize: 11,
                padding: '2px 6px',
                borderRadius: '3px 3px 0 0',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}>
                {displayText || `간판 ${sb.id + 1}`}
              </div>

              {/* ── 선택된 경우: 핸들 표시 ── */}
              {isSelected && (
                <>
                  {/* 회전 연결선 */}
                  <div style={{
                    position: 'absolute',
                    left: '50%',
                    top: -30,
                    width: 1,
                    height: 30,
                    backgroundColor: '#22C55E',
                    transform: 'translateX(-50%)',
                    pointerEvents: 'none',
                  }} />

                  {/* 회전 핸들 */}
                  <div
                    title="드래그해서 회전"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: -30,
                      transform: 'translate(-50%, -50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      backgroundColor: '#22C55E',
                      border: '2px solid white',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                      cursor: 'grab',
                      zIndex: 20,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, sb.id, 'rotate')}
                  />

                  {/* 4개 모서리 리사이즈 핸들 */}
                  {HANDLE_CONFIG.map(h => (
                    <div
                      key={h.id}
                      style={{
                        position: 'absolute',
                        left: h.left,
                        top:  h.top,
                        transform: 'translate(-50%, -50%)',
                        width: 12,
                        height: 12,
                        borderRadius: 2,
                        backgroundColor: 'white',
                        border: '2px solid #3B82F6',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        cursor: h.cursor,
                        zIndex: 20,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, sb.id, `resize-${h.id}`)}
                    />
                  ))}
                </>
              )}
            </div>

            {/* ── 선택 시 정보 HUD ── */}
            {isSelected && output && (
              <div style={{
                position: 'absolute',
                left: `${t.x}%`,
                top:  `${t.y + t.height / 2 + 1.5}%`,
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                color: '#ccc',
                fontSize: 10,
                padding: '3px 8px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                zIndex: 20,
                display: 'flex',
                gap: 10,
              }}>
                <span title="글자 크기">↔ {Math.round(output.fontSize)}%</span>
                <span title="회전 각도">↺ {Math.round(t.rotation)}°</span>
                <span title="위치 (X, Y)">
                  ⊕ {Math.round(output.textPositionX)}, {Math.round(output.textPositionY)}
                </span>
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SignboardTransform;
