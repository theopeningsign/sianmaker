import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import SignboardTransform from './SignboardTransform';

const ResultViewer = ({
  results,
  loading,
  loadingPhase = null,
  lights = [],
  onLightsChange = () => {},
  lightsEnabled = true,
  onToggleEnabled = () => {},
  onApplyLights = () => {},
  signboards = [],
  onRegenerateWithTransforms = () => {},
  textSizeInfo = null,
  onFlatDesignGenerate = () => {}
}) => {
  // props 확인용 로그 - 컴포넌트 마운트 시점
  React.useEffect(() => {
    console.log('[ResultViewer] 컴포넌트 마운트 - onFlatDesignGenerate prop 확인');
    console.log('[ResultViewer] 타입:', typeof onFlatDesignGenerate);
    console.log('[ResultViewer] 값:', onFlatDesignGenerate);
    console.log('[ResultViewer] 기본값인가?', onFlatDesignGenerate.toString() === '() => {}');
    console.log('[ResultViewer] 함수인가?', typeof onFlatDesignGenerate === 'function');
  }, []);
  
  // prop 변경 시 로그
  React.useEffect(() => {
    if (onFlatDesignGenerate && onFlatDesignGenerate.toString() !== '() => {}') {
      console.log('[ResultViewer] onFlatDesignGenerate prop이 제대로 전달되었습니다!');
    }
  }, [onFlatDesignGenerate]);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'night'
  const [selectedLightId, setSelectedLightId] = useState(null);
  const [showTransform, setShowTransform] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });
  const containerRef = useRef(null);
  const draggingRef = useRef(null);
  const originalSignboardsRef = useRef(signboards);
  const imageRef = useRef(null);
  const scaleRef = useRef(1);
  const offsetRef = useRef({ x: 0, y: 0 });
  const selectedAreaRef = useRef(null);
  const imageSizeRef = useRef(imageSize);
  const textSizeInfoRef = useRef(textSizeInfo);
  
  // 줌/팬 기능
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Helper: update lights safely
  const updateLight = (id, updates) => {
    onLightsChange(lights.map(l => (l.id === id ? { ...l, ...updates } : l)));
  };

  // 줌/팬 핸들러 - ImageUploader와 동일한 방식
  const handleWheel = useCallback((e) => {
    const container = containerRef.current;
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX === 0 ? rect.width / 2 : e.clientX - rect.left;
    const mouseY = e.clientY === 0 ? rect.height / 2 : e.clientY - rect.top;
    
    // 줌 전 마우스 위치의 이미지 좌표
    const imageX = (mouseX - offset.x) / scale;
    const imageY = (mouseY - offset.y) / scale;
    
    // 줌 배율 계산 (최소 0.1배, 최대 10배)
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, scale * delta));
    
    // 줌 후 마우스 위치가 같은 이미지 좌표를 가리키도록 offset 조정
    const newOffsetX = mouseX - imageX * newScale;
    const newOffsetY = mouseY - imageY * newScale;
    
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
    scaleRef.current = newScale;
    offsetRef.current = { x: newOffsetX, y: newOffsetY };
  }, [scale, offset]);

  const handleResetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
    scaleRef.current = 1;
    offsetRef.current = { x: 0, y: 0 };
  };

  const handlePanStart = (e) => {
    if (e.button === 2 || e.ctrlKey) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
      e.preventDefault();
    }
  };

  const handlePanMove = (e) => {
    if (isPanning) {
      const newOffset = {
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y
      };
      setOffset(newOffset);
      offsetRef.current = newOffset;
    }
  };

  const handlePanEnd = () => {
    setIsPanning(false);
  };

  // Add light at center-top by default
  const addLight = () => {
    const newLight = {
      id: Date.now().toString(),
      x: 0.5,
      y: 0.2,
      intensity: 1.0,
      radius: 100, // 기본값: 100 (중간값)
      temperature: 0.5,
      enabled: true,
    };
    onLightsChange([...(lights || []), newLight]);
    setSelectedLightId(newLight.id);
    setViewMode('night'); // 조명은 야간 뷰에서 확인
  };

  const removeLight = (id) => {
    onLightsChange(lights.filter(l => l.id !== id));
    if (selectedLightId === id) setSelectedLightId(null);
  };

  // Drag handling (조명 이동 + 리사이즈)
  const handleMouseDown = (e, id, mode = 'move') => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = { id, mode };
    setSelectedLightId(id);
  };

  const handleMouseMove = (e) => {
    if (!draggingRef.current || !containerRef.current) return;

    const imgElement = containerRef.current.querySelector('img');
    if (!imgElement) return;

    const imgRect = imgElement.getBoundingClientRect();
    const { id, mode } = draggingRef.current;

    if (mode === 'move') {
      const x = Math.min(1, Math.max(0, (e.clientX - imgRect.left) / imgRect.width));
      const y = Math.min(1, Math.max(0, (e.clientY - imgRect.top) / imgRect.height));
      updateLight(id, { x, y });

    } else if (mode === 'resize') {
      const light = lights.find(l => l.id === id);
      if (!light) return;
      // 조명 중심에서 마우스까지의 수직 거리 (screen px)
      const centerY_screen = light.y * imgRect.height + imgRect.top;
      const dy_screen = Math.max(10, e.clientY - centerY_screen);
      // overlay px (scale 제거) → radius 역산
      // displayRadius = radius * 0.4, cone bottom = center + displayRadius * 1.2
      // → radius = dy_screen / scale / 1.2 / 0.4
      const new_radius = Math.max(30, dy_screen / scale / 0.48);
      updateLight(id, { radius: new_radius });
    }
  };

  const handleMouseUp = () => {
    draggingRef.current = null;
  };

  useEffect(() => {
    const up = () => handleMouseUp();
    const move = (e) => handleMouseMove(e);
    window.addEventListener('mouseup', up);
    window.addEventListener('mousemove', move);
    return () => {
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', move);
    };
  });

  // 이미지 크기 추적 (imageRef 직접 사용)
  useEffect(() => {
    if (!results) return;
    const img = imageRef.current;
    if (!img) return;

    const updateSize = () => {
      if (img.naturalWidth > 1 && img.naturalHeight > 1) {
        setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
      }
    };

    // 이미 로드된 경우
    if (img.complete && img.naturalWidth > 1) {
      updateSize();
    } else {
      // 아직 로드 중인 경우
      img.addEventListener('load', updateSize);
      return () => img.removeEventListener('load', updateSize);
    }
  }, [results, viewMode]); // viewMode 변경 시에도 재확인

  // 마우스 휠 이벤트 등록
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const wheelHandler = (e) => {
      if (!e.shiftKey) return; // Shift 없으면 일반 스크롤
      e.preventDefault();
      e.stopPropagation();
      handleWheel(e);
    };

    // passive: false로 등록해야 preventDefault가 작동함
    container.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      container.removeEventListener('wheel', wheelHandler);
    };
  }, [scale, offset, results, handleWheel]);

  // signboards를 ref로 저장하여 클로저 문제 방지
  useEffect(() => {
    originalSignboardsRef.current = signboards;
    scaleRef.current = scale;
    offsetRef.current = offset;
  }, [signboards, scale, offset]);
  // originalSignboards를 ref로 저장하여 클로저 문제 방지
  const [pendingTransforms, setPendingTransforms] = useState({});

  const handleApplyTransforms = () => {
    console.log('Transform 적용:', pendingTransforms);
    console.log('Transform 상세:', JSON.stringify(pendingTransforms, null, 2));
    
    // 빈 객체 체크 개선
    const hasValidTransforms = Object.keys(pendingTransforms).some(id => {
      const transform = pendingTransforms[id];
      return transform && Object.keys(transform).length > 0;
    });
    
    if (!hasValidTransforms) {
      console.warn('적용할 transform이 없습니다. pendingTransforms:', pendingTransforms);
      alert('변경사항이 없습니다. 간판을 편집한 후 다시 시도해주세요.');
      return;
    }
    
    setShowTransform(false);
    if (onRegenerateWithTransforms) {
      // pendingTransforms는 객체 형태 { [id]: transform }이므로 배열로 변환
      const transformsArray = Object.keys(pendingTransforms)
        .filter(id => {
          const transform = pendingTransforms[id];
          return transform && Object.keys(transform).length > 0;
        })
        .map(id => ({
            id: parseInt(id),
            ...pendingTransforms[id]
          }));
      
      if (transformsArray.length === 0) {
        console.warn('적용할 transform이 없습니다.');
        alert('변경사항이 없습니다.');
        return;
      }
      
      console.log('변환된 transformsArray:', transformsArray);
      onRegenerateWithTransforms(transformsArray);
    }
  };

  // Color from temperature
  const tempToRGB = (t) => {
    const warm = [255, 220, 200];
    const cool = [200, 210, 255];
    return warm.map((w, i) => Math.round(w * (1 - t) + cool[i] * t));
  };

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">시뮬레이션 생성 중...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-12 text-center">
        <div className="text-gray-400 mb-4">
          <svg className="mx-auto h-16 w-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-gray-400">시뮬레이션 결과가 여기에 표시됩니다.</p>
      </div>
    );
  }

  const currentImage = viewMode === 'day' ? results.day_simulation : results.night_simulation;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">시뮬레이션 결과</h2>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setViewMode(viewMode === 'day' ? 'night' : 'day')}
            className={`px-3 py-1 rounded-full text-sm font-medium transition-colors cursor-pointer ${
              viewMode === 'day' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
            }`}
          >
            {viewMode === 'day' ? 'DAY' : 'NIGHT'}
          </button>
          <button
            onClick={() => {
              setShowTransform(!showTransform);
              if (!showTransform) {
                // 간판 편집 모드로 전환할 때 조명 편집 모드 비활성화
                setSelectedLightId(null);
              }
            }}
            className={`px-3 py-1 text-sm rounded-lg transition-colors ${
              showTransform 
                ? 'bg-orange-500 text-white' 
                : 'bg-orange-500/80 hover:bg-orange-500 text-white'
            }`}
          >
            {showTransform ? '✓ 편집 중' : '✏️ 간판 편집'}
          </button>
          {/* Transform 모드일 때 적용 버튼 */}
          {showTransform && (
            <button
              onClick={handleApplyTransforms}
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white rounded-lg font-bold shadow-xl"
            >
              ✓ 적용하기
            </button>
          )}
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={lightsEnabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="accent-blue-500"
            />
            조명 켜기
          </label>
          <button
            onClick={addLight}
            className="px-3 py-1 text-sm bg-blue-500/80 hover:bg-blue-500 text-white rounded-lg transition-colors"
          >
            + 조명 추가
          </button>
        </div>
      </div>


      <div className="mb-4 border-2 border-white/20 rounded-xl overflow-hidden bg-black/20 relative">
        <div
          ref={containerRef}
          className="relative overflow-hidden"
          style={{ cursor: isPanning ? 'grabbing' : 'default' }}
          onMouseDown={(e) => {
            handlePanStart(e);
            if (e.button === 0 && !e.ctrlKey) setSelectedLightId(null);
          }}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          onWheel={(e) => { if (e.shiftKey) handleWheel(e); }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            ref={imageRef}
            src={currentImage}
            alt={viewMode === 'day' ? '주간 시뮬레이션' : '야간 시뮬레이션'}
            className="w-full h-auto pointer-events-none select-none"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: '0 0',
              transition: isPanning ? 'none' : 'transform 0.1s ease-out'
            }}
          />
          {/* 간판 편집 오버레이 (상호 위치 편집 포함) */}
          {showTransform && signboards.length > 0 && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                zIndex: 50,
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: '0 0'
              }}
            >
              {/* 간판편집 모드에서도 간판 영역(처음 설정한 영역)을 노란 박스로 표시 */}
              {/* 각 간판의 원래 영역(노란 박스) 표시 */}
              {signboards.map((sb) => {
                if (!sb.selectedArea) return null;
                const selectedArea = sb.selectedArea;
                let signboardX, signboardY, signboardWidth, signboardHeight;
                if (selectedArea.type === 'polygon' && selectedArea.points.length >= 4) {
                  const xs = selectedArea.points.map((p) => p.x);
                  const ys = selectedArea.points.map((p) => p.y);
                  signboardX = Math.min(...xs);
                  signboardY = Math.min(...ys);
                  signboardWidth = Math.max(...xs) - signboardX;
                  signboardHeight = Math.max(...ys) - signboardY;
                } else {
                  signboardX = selectedArea.x;
                  signboardY = selectedArea.y;
                  signboardWidth = selectedArea.width;
                  signboardHeight = selectedArea.height;
                }

                const signboardXPercent = (signboardX / imageSize.width) * 100;
                const signboardYPercent = (signboardY / imageSize.height) * 100;
                const signboardWidthPercent = (signboardWidth / imageSize.width) * 100;
                const signboardHeightPercent = (signboardHeight / imageSize.height) * 100;

                return (
                  <div
                    key={`area-${sb.id}`}
                    className="absolute pointer-events-none"
                    style={{
                      left: `${signboardXPercent}%`,
                      top: `${signboardYPercent}%`,
                      width: `${signboardWidthPercent}%`,
                      height: `${signboardHeightPercent}%`,
                      border: '2px dashed rgba(255, 255, 0, 0.6)',
                      backgroundColor: 'rgba(255, 255, 0, 0.1)',
                      borderRadius: '4px',
                      boxShadow: '0 0 0 2px rgba(255, 255, 255, 0.3)'
                    }}
                    title="처음 설정한 간판 영역"
                  />
                );
              })}

              <SignboardTransform
                key={signboards.map((sb) => sb.id).join('|')}
                signboards={signboards.map((sb) => {
                  if (!sb.selectedArea) {
                    return {
                      id: sb.id,
                      polygon_points: [],
                      text: sb.formData?.text || ''
                    };
                  }
                  const a = sb.selectedArea;
                  const points =
                    a.type === 'polygon'
                      ? a.points.map((p) => [p.x, p.y])
                      : [
                          [a.x, a.y],
                          [a.x + a.width, a.y],
                          [a.x + a.width, a.y + a.height],
                          [a.x, a.y + a.height]
                        ];
                  return {
                    id: sb.id,
                    polygon_points: points,
                    text: sb.formData?.text || ''
                  };
                })}
                originalSignboards={signboards}
                imageSize={imageSize}
                selectedArea={null}
                textSizeInfo={textSizeInfo}
                onTransformChange={setPendingTransforms}
                onApply={handleApplyTransforms}
              />
            </div>
          )}
          {/* 조명 오버레이: 야간에서만 표시, 편집 모드가 아닐 때만 */}
          {viewMode === 'night' && lightsEnabled && !showTransform && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: '0 0'
              }}
            >
              {lights.map((light) => {
                const { id, x, y, radius = 50, intensity = 1, temperature = 0.5, enabled = true } = light;
                if (!enabled) return null;
                const color = tempToRGB(temperature);
                // 표시용 반경
                const displayRadius = radius * 0.4;
                const width = displayRadius * 2.0;
                const height = displayRadius * 2.4;
                const alpha = Math.min(0.7, 0.45 * intensity);
                
                // 균일한 타원형 조명 (백엔드와 동일)
                const solidColor = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`;
                
                return (
                  <div key={id}>
                    {/* 조명 기구 아이콘 */}
                    <div
                      className="absolute pointer-events-none"
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        transform: 'translate(-50%, -50%)',
                        width: '30px',
                        height: '20px',
                      }}
                    >
                      <svg viewBox="0 0 30 20" className="w-full h-full">
                        <path
                          d="M5 0 L10 8 L20 8 L25 0 Z"
                          fill="#3a3a3a"
                          stroke="#666"
                          strokeWidth="2"
                        />
                        <ellipse cx="15" cy="10" rx="8" ry="3" fill="#2a2a2a" stroke="#555" strokeWidth="1.5" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 드래그 핸들 (조명 기구 클릭) - 편집 모드가 아닐 때만 */}
          {viewMode === 'night' && !showTransform && (
            <div 
              className="absolute inset-0"
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: '0 0'
              }}
            >
              {lights.map((light) => {
                const { id, x, y, radius = 150, enabled = true } = light;
                if (!enabled && !lightsEnabled) return null;
                const displayRadius = radius * 0.4;
                const coneBottom = displayRadius * 1.2; // 콘 하단까지의 오프셋(px)
                return (
                  <React.Fragment key={id}>
                    {/* 삭제 버튼 (X) - 이동 핸들 위에 렌더링 */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => { e.stopPropagation(); removeLight(id); }}
                      style={{
                        position: 'absolute',
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        transform: 'translate(8px, -52px)',
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        border: '2px solid white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        color: 'white',
                        fontWeight: 'bold',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
                        zIndex: 50,
                        userSelect: 'none',
                      }}
                      title="조명 삭제"
                    >
                      <svg viewBox="0 0 20 20" width="12" height="12">
                        <line x1="3" y1="3" x2="17" y2="17" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                        <line x1="17" y1="3" x2="3" y2="17" stroke="white" strokeWidth="3" strokeLinecap="round"/>
                      </svg>
                    </div>
                    {/* 이동 핸들 (조명 기구 위치) */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, id, 'move')}
                      onClick={(e) => { e.stopPropagation(); setSelectedLightId(id); }}
                      className={`absolute cursor-move ${selectedLightId === id ? 'ring-2 ring-purple-400' : ''}`}
                      style={{
                        left: `${x * 100}%`,
                        top: `${y * 100}%`,
                        width: '40px',
                        height: '30px',
                        marginLeft: '-20px',
                        marginTop: '-15px',
                        borderRadius: '4px',
                      }}
                      title="드래그: 위치 이동"
                    />
                    {/* 리사이즈 핸들 (콘 하단) */}
                    <div
                      onMouseDown={(e) => handleMouseDown(e, id, 'resize')}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        left: `${x * 100}%`,
                        top: `calc(${y * 100}% + ${coneBottom}px)`,
                        transform: 'translate(-50%, -50%)',
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        backgroundColor: selectedLightId === id ? '#a855f7' : 'rgba(200,180,255,0.9)',
                        border: '2px solid white',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                        cursor: 's-resize',
                        pointerEvents: 'all',
                        zIndex: 20,
                      }}
                      title="드래그: 조명 크기 조절"
                    />
                  </React.Fragment>
                );
              })}
            </div>
          )}
          
          {/* 줌 컨트롤 */}
          <div className="absolute top-3 right-3 flex flex-col gap-2 bg-black/50 backdrop-blur-sm rounded-lg p-2 pointer-events-auto">
            <div className="text-xs text-white text-center font-mono">
              {Math.round(scale * 100)}%
            </div>
            <button
              onClick={() => handleWheel({ deltaY: -100, preventDefault: () => {}, clientX: 0, clientY: 0 })}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
              title="확대 (또는 마우스 휠 위)"
            >
              🔍+
            </button>
            <button
              onClick={() => handleWheel({ deltaY: 100, preventDefault: () => {}, clientX: 0, clientY: 0 })}
              className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-sm"
              title="축소 (또는 마우스 휠 아래)"
            >
              🔍-
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-1 bg-blue-500/80 hover:bg-blue-500 text-white rounded text-xs"
              title="원래 크기로"
            >
              리셋
            </button>
          </div>
          
          {/* 도움말 */}
          <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs text-gray-300 pointer-events-none">
            <div>💡 <strong>마우스 휠</strong>: 확대/축소</div>
            <div>💡 <strong>우클릭 드래그</strong>: 이미지 이동</div>
          </div>
        </div>
      </div>

      {/* 선택된 조명 퀵 설정 */}
      {viewMode === 'night' && selectedLightId && (
        <div className="mb-4 bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">선택한 조명</div>
            <button
              onClick={() => removeLight(selectedLightId)}
              className="text-red-400 hover:text-red-300 text-sm"
            >
              삭제
            </button>
          </div>
          {lights
            .filter((l) => l.id === selectedLightId)
            .map((light) => (
              <div key={light.id} className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <div>밝기 (현재: {light.intensity.toFixed(2)})</div>
                  <input
                    type="range"
                    min="0"
                    max="3"
                    step="0.05"
                    value={light.intensity}
                    onChange={(e) => updateLight(light.id, { intensity: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </label>
                <label className="space-y-1">
                  <div>반경 (현재: {light.radius}px)</div>
                  <input
                    type="range"
                    min="50"
                    max="200"
                    step="10"
                    value={light.radius}
                    onChange={(e) => updateLight(light.id, { radius: parseFloat(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                </label>
                <label className="space-y-1 col-span-2">
                  <div>색온도 (0=따뜻, 1=차가움)</div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={light.temperature}
                    onChange={(e) => updateLight(light.id, { temperature: parseFloat(e.target.value) })}
                    className="w-full accent-amber-400"
                  />
                </label>
              </div>
            ))}
        </div>
      )}

      {/* 조명 반영하기 버튼 */}
      {lights.length > 0 && (
        <div className="mb-4">
          <button
            onClick={onApplyLights}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-semibold py-3 px-4 rounded-lg transition-all hover:scale-105 shadow-lg"
          >
            🔦 조명 반영하기 (비교 보기/다운로드에 적용)
          </button>
          <p className="mt-2 text-xs text-amber-300/70 text-center">
            💡 조명을 추가하거나 수정한 후 이 버튼을 눌러주세요!
          </p>
        </div>
      )}

      <div className="flex gap-3 mb-3">
        <button
          onClick={() => {
            const link = document.createElement('a');
            link.href = results.day_simulation;
            link.download = 'day_simulation.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-all hover:scale-105"
        >
          주간 다운로드
        </button>
        <button
          onClick={() => {
            const link = document.createElement('a');
            link.href = results.night_simulation;
            link.download = 'night_simulation.png';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }}
          className="flex-1 bg-purple-500/80 hover:bg-purple-500 text-white font-medium py-3 px-4 rounded-lg transition-all hover:scale-105"
        >
          야간 다운로드
        </button>
      </div>

      {/* 평면도 생성 및 다운로드 버튼 */}
      <div className="flex flex-col gap-3 mb-6">
        {results && (results.flat_design_only || results.flat_design) ? (
          <>
            {/* 주간/야간 선택 버튼 */}
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => {
                  if (onFlatDesignGenerate && typeof onFlatDesignGenerate === 'function' && onFlatDesignGenerate.toString() !== '() => {}') {
                    onFlatDesignGenerate('day');
                  }
                }}
                className="flex-1 bg-yellow-500/80 hover:bg-yellow-500 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm"
                title="주간 평면도"
              >
                ☀️ 주간
              </button>
              <button
                onClick={() => {
                  if (onFlatDesignGenerate && typeof onFlatDesignGenerate === 'function' && onFlatDesignGenerate.toString() !== '() => {}') {
                    onFlatDesignGenerate('night');
                  }
                }}
                className="flex-1 bg-indigo-500/80 hover:bg-indigo-500 text-white font-medium py-2 px-4 rounded-lg transition-all text-sm"
                title="야간 평면도"
              >
                🌙 야간
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = results.flat_design_only || results.flat_design;
                  link.download = 'flat_design_only.png';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex-1 bg-green-500/80 hover:bg-green-500 text-white font-medium py-3 px-4 rounded-lg transition-all hover:scale-105"
                title="흰색 배경 + 간판만 (도면용)"
              >
                📐 도면용 다운로드
              </button>
              {results.flat_design_with_context && (
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = results.flat_design_with_context;
                    link.download = 'flat_design_with_context.png';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="flex-1 bg-blue-500/80 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-all hover:scale-105"
                  title="건물 외벽 + 간판 합성 (시공 도면용)"
                >
                🏗️ 시공 도면 다운로드
                </button>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => {
              console.log('[ResultViewer] 평면도 생성 버튼 클릭됨');
              console.log('[ResultViewer] onFlatDesignGenerate:', onFlatDesignGenerate);
              console.log('[ResultViewer] onFlatDesignGenerate 타입:', typeof onFlatDesignGenerate);
              console.log('[ResultViewer] 기본값인가?', onFlatDesignGenerate.toString() === '() => {}');
              
              if (onFlatDesignGenerate && typeof onFlatDesignGenerate === 'function' && onFlatDesignGenerate.toString() !== '() => {}') {
                console.log('[ResultViewer] 함수 호출 시작');
                onFlatDesignGenerate('day');
              } else {
                console.error('[ResultViewer] onFlatDesignGenerate가 전달되지 않았습니다!');
                console.error('[ResultViewer] 현재 값:', onFlatDesignGenerate);
                alert('평면도 생성 함수가 연결되지 않았습니다. 페이지를 새로고침해주세요.');
              }
            }}
            disabled={loading}
            className="flex-1 bg-green-500/80 hover:bg-green-500 disabled:bg-gray-500/50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all hover:scale-105"
          >
            {loading && loadingPhase === 'flat' ? '생성 중...' : '📐 평면도 생성'}
          </button>
        )}
        {results && results.flat_design_dimensions && (
          <div className="text-xs text-gray-400 text-center">
            치수: {results.flat_design_dimensions.width_mm}mm × {results.flat_design_dimensions.height_mm}mm 
            {results.flat_design_dimensions.scale && ` (${results.flat_design_dimensions.scale})`}
          </div>
        )}
      </div>

      <div className="pt-6 border-t border-white/10">
        <h3 className="text-lg font-semibold mb-4 text-white">비교 보기</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-black/20 rounded-lg p-2">
            <p className="text-xs text-blue-400 mb-2 text-center font-medium">주간</p>
            <img
              src={results.day_simulation}
              alt="주간"
              className="w-full h-auto rounded border border-white/10"
            />
          </div>
          <div className="bg-black/20 rounded-lg p-2">
            <p className="text-xs text-purple-400 mb-2 text-center font-medium">야간</p>
            <img
              src={results.night_simulation}
              alt="야간"
              className="w-full h-auto rounded border border-white/10"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default ResultViewer;
