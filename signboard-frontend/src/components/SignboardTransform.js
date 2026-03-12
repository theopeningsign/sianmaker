import React, { useState, useRef, useEffect, useCallback } from 'react';

const FONT_FAMILY_MAP = {
  malgun: "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif",
  nanumgothic: "'Nanum Gothic', sans-serif",
  nanumbarungothic: "'Nanum Barun Gothic', sans-serif",
  gulim: 'Gulim, sans-serif',
  batang: 'Batang, serif',
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

  // 컨테이너 크기 추적 (SVG 픽셀 좌표 계산용)
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // 간판별 transform 초기화: polygon_points(픽셀) → points(% 배열)
  useEffect(() => {
    if (imageSize.width <= 1 && imageSize.height <= 1) return;

    setTransforms(prev => {
      const next = { ...prev };
      let changed = false;

      signboards.forEach(sb => {
        if (next[sb.id]) return; // 이미 초기화된 경우 스킵

        const pts = sb.polygon_points || [];
        if (pts.length < 4) return;

        const points = pts.map(([px, py]) => [
          (px / imageSize.width) * 100,
          (py / imageSize.height) * 100,
        ]);

        next[sb.id] = { points };
        changed = true;
      });

      return changed ? next : prev;
    });
  }, [signboards, imageSize]);

  // transform → 백엔드 파라미터 변환
  const toOutput = useCallback((id, t) => {
    if (!t?.points) return null;
    return {
      id,
      newPolygonPoints: t.points.map(([x, y]) => [
        Math.round((x / 100) * imageSize.width),
        Math.round((y / 100) * imageSize.height),
      ]),
      textPositionX: 50,
      textPositionY: 50,
      rotation: 0,
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
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleMouseDown = useCallback((e, id, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(id);
    const pos = getMousePct(e);
    const t = transforms[id];
    if (!t?.points) return;

    setDragState({
      id,
      mode,
      startPos: pos,
      startPoints: t.points.map(p => [...p]),
    });
  }, [transforms, getMousePct]);

  // 드래그 처리
  useEffect(() => {
    if (!dragState) return;

    const onMove = (e) => {
      const pos = getMousePct(e);
      const { id, mode, startPos, startPoints } = dragState;
      const dx = pos.x - startPos.x;
      const dy = pos.y - startPos.y;

      if (mode === 'move') {
        // 전체 이동
        updateTransform(id, {
          points: startPoints.map(([x, y]) => [x + dx, y + dy]),
        });

      } else if (mode.startsWith('scale-')) {
        // 비례 리사이즈: 반대쪽 꼭지점 고정, 전체 스케일
        const i = parseInt(mode.replace('scale-', ''));
        const oppIdx = (i + 2) % 4;
        const opp = startPoints[oppIdx];
        const origI = startPoints[i];

        // 현재 마우스 위치를 드래그 꼭지점의 새 위치로 사용
        const newIx = pos.x;
        const newIy = pos.y;

        const scaleX = (origI[0] - opp[0]) !== 0
          ? (newIx - opp[0]) / (origI[0] - opp[0])
          : 1;
        const scaleY = (origI[1] - opp[1]) !== 0
          ? (newIy - opp[1]) / (origI[1] - opp[1])
          : 1;

        updateTransform(id, {
          points: startPoints.map(([x, y]) => [
            opp[0] + (x - opp[0]) * scaleX,
            opp[1] + (y - opp[1]) * scaleY,
          ]),
        });

      } else if (mode.startsWith('corner-')) {
        // 개별 꼭지점 이동 (Shift/Ctrl + 드래그)
        const i = parseInt(mode.replace('corner-', ''));
        const newPoints = startPoints.map((p, idx) =>
          idx === i ? [p[0] + dx, p[1] + dy] : [...p]
        );
        updateTransform(id, { points: newPoints });
      }
    };

    const onUp = () => setDragState(null);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
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
        if (!t?.points || t.points.length < 4) return null;

        const isSelected = selectedId === sb.id;

        // centroid 계산
        const cx = t.points.reduce((s, [x]) => s + x, 0) / 4;
        const cy = t.points.reduce((s, [, y]) => s + y, 0) / 4;

        // formData에서 미리보기 스타일
        const origSb = originalSignboards.find(s => s.id === sb.id);
        const formData = origSb?.formData || {};
        const bgColor       = formData.bgColor    || '#1B3A6B';
        const textColor     = formData.textColor  || '#FFFFFF';
        const fontFamily    = FONT_FAMILY_MAP[formData.fontFamily] || FONT_FAMILY_MAP.malgun;
        const fontWeight    = formData.fontWeight  || '700';
        const textDirection = formData.textDirection || 'horizontal';
        const isImageMode   = formData.signboardInputType === 'image';
        const displayText   = sb.text || formData.text || '';

        // 간판 실제 방향/크기 계산: y 기준으로 정렬 후 상단/하단 엣지 추출
        const sortedByY = [...t.points].sort((a, b) => a[1] - b[1]);
        const topPts = [...sortedByY.slice(0, 2)].sort((a, b) => a[0] - b[0]); // [TL, TR]
        const botPts = [...sortedByY.slice(2, 4)].sort((a, b) => a[0] - b[0]); // [BL, BR]
        const [tlX, tlY] = topPts[0];
        const [trX, trY] = topPts[1];

        // 상단 엣지 각도 (텍스트 회전용) — ±45° 이내로 clamp (UX 미리보기 전용)
        const rawAngleDeg = Math.atan2(
          (trY - tlY) * containerSize.height / 100,
          (trX - tlX) * containerSize.width / 100
        ) * (180 / Math.PI);
        const angleDeg = Math.max(-45, Math.min(45, rawAngleDeg));

        // 실제 간판 폭/높이 (px)
        const edgeLen = ([x1, y1], [x2, y2]) => Math.sqrt(
          ((x2 - x1) * containerSize.width / 100) ** 2 +
          ((y2 - y1) * containerSize.height / 100) ** 2
        );
        const signWidthPx  = (edgeLen(topPts[0], topPts[1]) + edgeLen(botPts[0], botPts[1])) / 2;
        const signHeightPx = (edgeLen(topPts[0], botPts[0]) + edgeLen(topPts[1], botPts[1])) / 2;

        const lines = (displayText || '').split('\n');
        const maxLineLen = Math.max(1, ...lines.map(l => l.length || 1));
        const lineCount = lines.length || 1;
        const fontSzByHeight = Math.max(10, (signHeightPx * 0.82) / lineCount);
        const fontSzByWidth  = Math.max(10, (signWidthPx  * 0.90) / maxLineLen);
        const approxFontSz = Math.min(fontSzByHeight, fontSzByWidth);

        // SVG polygon points (픽셀 좌표)
        const svgPoints = t.points.map(([x, y]) =>
          `${(x / 100) * containerSize.width},${(y / 100) * containerSize.height}`
        ).join(' ');

        // CSS clip-path
        const clipPath = `polygon(${t.points.map(([x, y]) => `${x}% ${y}%`).join(', ')})`;

        return (
          <React.Fragment key={sb.id}>
            {/* ── SVG 외곽선 ── */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
                zIndex: 1,
              }}
            >
              <polygon
                points={svgPoints}
                fill="none"
                stroke={isSelected ? '#3B82F6' : 'rgba(255,255,255,0.75)'}
                strokeWidth={isSelected ? 2 : 1.5}
                strokeDasharray={isSelected ? '' : '6 3'}
              />
            </svg>

            {/* ── 배경 + 텍스트 미리보기 (clip-path) ── */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: bgColor,
                opacity: 0.82,
                clipPath,
                cursor: 'move',
                pointerEvents: 'all',
                zIndex: 2,
              }}
              onMouseDown={(e) => handleMouseDown(e, sb.id, 'move')}
              onClick={(e) => { e.stopPropagation(); setSelectedId(sb.id); }}
            >
              {/* 텍스트: centroid에 배치 + 간판 기울기 반영 */}
              <div
                style={{
                  position: 'absolute',
                  left: `${cx}%`,
                  top: `${cy}%`,
                  transform: `translate(-50%, -50%) rotate(${angleDeg}deg)`,
                  width: signWidthPx,
                  pointerEvents: 'none',
                  writingMode: textDirection === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                  textAlign: 'center',
                }}
              >
                {isImageMode ? (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: Math.max(10, approxFontSz * 0.5) }}>
                    📷 이미지
                  </span>
                ) : (
                  <span style={{
                    color: textColor,
                    fontFamily,
                    fontWeight,
                    fontSize: approxFontSz,
                    whiteSpace: 'pre',
                    lineHeight: 1.2,
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                    padding: '4px 8px',
                    display: 'block',
                  }}>
                    {displayText || '텍스트를 입력하세요'}
                  </span>
                )}
              </div>
            </div>

            {/* ── 상단 라벨 ── */}
            <div style={{
              position: 'absolute',
              left: `${Math.min(...t.points.map(p => p[0]))}%`,
              top: `${sortedByY[0][1]}%`,
              transform: 'translateY(-100%)',
              backgroundColor: isSelected ? '#3B82F6' : 'rgba(0,0,0,0.7)',
              color: 'white',
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: '3px 3px 0 0',
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
              userSelect: 'none',
              zIndex: 5,
            }}>
              {displayText || `간판 ${sb.id + 1}`}
              <span style={{ fontSize: 9, opacity: 0.65, marginLeft: 6 }}>
                Shift+드래그: 꼭지점 개별 이동
              </span>
            </div>

            {/* ── 중심 이동 핸들 ── */}
            <div
              title="드래그: 전체 이동"
              style={{
                position: 'absolute',
                left: `${cx}%`,
                top: `${cy}%`,
                transform: 'translate(-50%, -50%)',
                width: 18,
                height: 18,
                borderRadius: '50%',
                backgroundColor: isSelected ? 'rgba(59,130,246,0.9)' : 'rgba(100,160,255,0.7)',
                border: '2px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                cursor: 'move',
                pointerEvents: 'all',
                zIndex: 10,
              }}
              onMouseDown={(e) => handleMouseDown(e, sb.id, 'move')}
              onClick={(e) => { e.stopPropagation(); setSelectedId(sb.id); }}
            />

            {/* ── 꼭지점 핸들 × 4 ── */}
            {t.points.map(([x, y], i) => (
              <div
                key={i}
                title={`꼭지점 ${i + 1} | 드래그: 비례 리사이즈 | Shift+드래그: 개별 이동`}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  width: 14,
                  height: 14,
                  borderRadius: '3px',
                  backgroundColor: 'white',
                  border: `2px solid ${isSelected ? '#3B82F6' : 'rgba(100,160,255,0.9)'}`,
                  boxShadow: '0 2px 5px rgba(0,0,0,0.45)',
                  cursor: 'nw-resize',
                  pointerEvents: 'all',
                  zIndex: 15,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const mode = (e.shiftKey || e.ctrlKey) ? `corner-${i}` : `scale-${i}`;
                  handleMouseDown(e, sb.id, mode);
                }}
              />
            ))}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default SignboardTransform;
