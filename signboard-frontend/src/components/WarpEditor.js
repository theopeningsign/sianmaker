import React, { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

/**
 * WarpEditor
 *
 * - props
 *   - imageFile: App.js의 buildingImage (File 객체) 또는 이미지 URL(string)
 *   - selectedArea: { type: 'polygon' | 'rect', points?: {x,y}[], x,y,width,height? }
 *   - formData: 현재 간판의 formData (text, textColor 사용)
 *   - onAreaChange: 영역 편집이 끝날 때마다 호출되는 콜백
 *       (ImageUploader와 동일하게 { type: 'polygon', points: [{x,y}, ...]} 형태로 전달)
 *
 * - 기능
 *   - Fabric.js로 배경 이미지 + Polygon 렌더링
 *   - 각 꼭짓점에 개별 드래그 컨트롤 부여 (원근/형태 조정)
 *   - formData.text / textColor 변경 시 캔버스 텍스트 실시간 반영
 *   - 마우스 휠 줌, 우클릭(또는 Ctrl+드래그) 팬 기능
 */
const WarpEditor = ({
  imageFile,
  selectedArea,
  formData,
  signboards = [],           // 전체 간판 목록 (현재 간판 + 다른 간판들)
  currentSignboardId = null, // 현재 편집 중인 간판 ID
  onAreaChange,
}) => {
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const polygonRef = useRef(null);
  const textRef = useRef(null);
  const backgroundRef = useRef(null);
   const otherPolygonsRef = useRef([]); // 다른 간판들의 반투명 폴리곤
  const brightnessFilterRef = useRef(null); // 야간 모드용 밝기 필터
  const urlRef = useRef(null);
  const isPanningRef = useRef(false);
  const lastPosXRef = useRef(0);
  const lastPosYRef = useRef(0);

  // 이미지 URL 준비 (File 또는 string 모두 지원)
  useEffect(() => {
    if (!imageFile) return;

    let url;
    if (typeof imageFile === 'string') {
      url = imageFile;
    } else {
      url = URL.createObjectURL(imageFile);
      urlRef.current = url;
    }

    const initCanvas = () => {
      const canvasEl = canvasRef.current;
      if (!canvasEl) return;

      // 기존 캔버스 제거
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }

      const canvas = new fabric.Canvas(canvasEl, {
        selection: false,
        preserveObjectStacking: true,
      });
      fabricCanvasRef.current = canvas;

      // 배경 이미지 로드
      fabric.Image.fromURL(url, (img) => {
        if (!canvas) return;

        // 원본 이미지 크기 기준으로 캔버스 설정
        canvas.setWidth(img.width);
        canvas.setHeight(img.height);

        // 배경 이미지는 편집 불가
        img.selectable = false;
        img.evented = false;
        img.hoverCursor = 'default';

        backgroundRef.current = img;
        canvas.add(img);
        canvas.sendToBack(img);

        // 다른 간판들의 반투명 영역 먼저 그림
        drawOtherSignboards();

        // 선택 영역을 Polygon으로 변환해서 추가
        createOrUpdatePolygon();

        // 텍스트 오브젝트 생성
        createOrUpdateText();

        canvas.renderAll();
      }, { crossOrigin: 'anonymous' });

      // 줌 핸들러 (ImageUploader의 handleWheel 로직을 Fabric 방식으로 이식)
      const handleWheel = (opt) => {
        const evt = opt.e;
        evt.preventDefault();
        evt.stopPropagation();

        const delta = evt.deltaY;
        let zoom = canvas.getZoom();
        const factor = delta > 0 ? 0.9 : 1.1;
        zoom *= factor;
        zoom = Math.max(0.1, Math.min(10, zoom));

        const point = new fabric.Point(evt.offsetX, evt.offsetY);
        canvas.zoomToPoint(point, zoom);
      };

      // 팬 핸들러 (우클릭 또는 Ctrl+드래그)
      const handleMouseDown = (opt) => {
        const evt = opt.e;
        if (evt.button === 2 || evt.ctrlKey) {
          isPanningRef.current = true;
          lastPosXRef.current = evt.clientX;
          lastPosYRef.current = evt.clientY;
          evt.preventDefault();
        }
      };

      const handleMouseMove = (opt) => {
        if (!isPanningRef.current) return;
        const evt = opt.e;
        const vpt = canvas.viewportTransform;
        if (!vpt) return;

        const dx = evt.clientX - lastPosXRef.current;
        const dy = evt.clientY - lastPosYRef.current;

        vpt[4] += dx;
        vpt[5] += dy;

        canvas.setViewportTransform(vpt);

        lastPosXRef.current = evt.clientX;
        lastPosYRef.current = evt.clientY;
      };

      const handleMouseUp = () => {
        isPanningRef.current = false;
      };

      canvas.on('mouse:wheel', handleWheel);
      canvas.on('mouse:down', handleMouseDown);
      canvas.on('mouse:move', handleMouseMove);
      canvas.on('mouse:up', handleMouseUp);

      // Polygon 편집이 끝났을 때 부모로 좌표 전달
      canvas.on('object:modified', (opt) => {
        if (!opt.target || opt.target !== polygonRef.current) return;
        notifyAreaChange();
      });
    };

    initCanvas();

    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
      }
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
    // imageFile이 바뀔 때마다 전체 초기화
  }, [imageFile]);

  // selectedArea 변경 시 Polygon 생성/업데이트
  useEffect(() => {
    if (!fabricCanvasRef.current || !backgroundRef.current) return;
    createOrUpdatePolygon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea]);

  // signboards / 현재 간판 변경 시 다른 간판들의 반투명 영역 업데이트
  useEffect(() => {
    if (!fabricCanvasRef.current || !backgroundRef.current) return;
    drawOtherSignboards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signboards, currentSignboardId]);

  // formData.text / textColor 변경 시 텍스트 업데이트
  useEffect(() => {
    if (!fabricCanvasRef.current || !backgroundRef.current) return;
    createOrUpdateText();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData?.text, formData?.textColor, formData?.fontFamily]);

  // formData.opacity 변경 시 시트지 투명도(폴리곤 투명도) 실시간 반영
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const poly = polygonRef.current;
    if (!canvas || !poly) return;

    const raw = typeof formData?.opacity === 'number' ? formData.opacity : 1;
    const clamped = Math.max(0, Math.min(1, raw));

    // 객체 전체 투명도 조절 (배경 비침 효과)
    poly.set({ opacity: clamped });
    canvas.requestRenderAll();
  }, [formData?.opacity]);

  // formData.isNight 변경 시 배경 밝기 필터 적용 (야간 시뮬레이션 분위기)
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    const img = backgroundRef.current;
    if (!canvas || !img) return;

    if (formData?.isNight) {
      let filter = brightnessFilterRef.current;
      if (!filter) {
        filter = new fabric.Image.filters.Brightness({ brightness: -0.5 });
        brightnessFilterRef.current = filter;
      }

      const filters = img.filters || [];
      if (!filters.includes(filter)) {
        filters.push(filter);
        img.filters = filters;
      }

      img.applyFilters();
      canvas.requestRenderAll();
    } else {
      if (brightnessFilterRef.current && img.filters) {
        img.filters = img.filters.filter((f) => f !== brightnessFilterRef.current);
        img.applyFilters();
        canvas.requestRenderAll();
      }
    }
  }, [formData?.isNight]);

  // formData.lightsEnabled 변경 시 텍스트/폴리곤 Glow(Shadow) 효과 적용
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const glowOn = !!formData?.lightsEnabled;
    const color = formData?.textColor || '#FFFFFF';

    const shadow = glowOn
      ? new fabric.Shadow({
          color,
          blur: 18,
          offsetX: 0,
          offsetY: 0,
        })
      : null;

    if (textRef.current) {
      textRef.current.set({ shadow });
    }
    if (polygonRef.current) {
      polygonRef.current.set({ shadow });
    }

    canvas.requestRenderAll();
  }, [formData?.lightsEnabled, formData?.textColor]);

  const getPolygonPointsFromSelectedArea = () => {
    if (!selectedArea) return [];

    if (selectedArea.type === 'polygon' && Array.isArray(selectedArea.points)) {
      return selectedArea.points.map((p) => ({ x: p.x, y: p.y }));
    }

    if (selectedArea.type === 'rect') {
      const { x, y, width, height } = selectedArea;
      return [
        { x, y },
        { x: x + width, y },
        { x: x + width, y: y + height },
        { x, y: y + height },
      ];
    }

    return [];
  };

  const createOrUpdatePolygon = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const points = getPolygonPointsFromSelectedArea();
    if (!points.length) {
      if (polygonRef.current) {
        canvas.remove(polygonRef.current);
        polygonRef.current = null;
        canvas.renderAll();
      }
      return;
    }

    if (!polygonRef.current) {
      const poly = new fabric.Polygon(points, {
        fill: 'rgba(255, 215, 0, 0.15)',
        stroke: '#FFD700',
        strokeWidth: 2,
        objectCaching: false,
        transparentCorners: false,
        perPixelTargetFind: true,
        selectable: true,
      });

      addVertexControls(poly);

      polygonRef.current = poly;
      canvas.add(poly);
      canvas.bringToFront(poly);
    } else {
      // 기존 polygon 업데이트
      polygonRef.current.set({
        points,
      });
      addVertexControls(polygonRef.current);
    }

    canvas.requestRenderAll();
  };

  // 다른 간판들의 selectedArea를 반투명 폴리곤으로 그리기 (읽기 전용)
  const drawOtherSignboards = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !backgroundRef.current) return;

    // 기존 다른 간판 폴리곤 제거
    if (otherPolygonsRef.current.length > 0) {
      otherPolygonsRef.current.forEach((obj) => {
        canvas.remove(obj);
      });
      otherPolygonsRef.current = [];
    }

    const others = (signboards || []).filter(
      (sb) => sb && sb.id !== currentSignboardId && sb.selectedArea
    );

    const created = [];

    others.forEach((sb) => {
      const area = sb.selectedArea;
      let pts = [];

      if (area.type === 'polygon' && Array.isArray(area.points)) {
        pts = area.points.map((p) => ({ x: p.x, y: p.y }));
      } else if (area.type === 'rect') {
        const { x, y, width, height } = area;
        pts = [
          { x, y },
          { x: x + width, y },
          { x: x + width, y: y + height },
          { x, y: y + height },
        ];
      }

      if (!pts.length) return;

      const poly = new fabric.Polygon(pts, {
        fill: 'rgba(148, 163, 184, 0.18)', // slate 계열 반투명
        stroke: '#94A3B8',
        strokeWidth: 1.5,
        opacity: 0.3,
        selectable: false,
        evented: false,
        hoverCursor: 'default',
      });

      canvas.add(poly);
      created.push(poly);
    });

    otherPolygonsRef.current = created;

    // 레이어 순서 정리: 배경 < 다른 간판 < 현재 폴리곤 < 텍스트
    if (backgroundRef.current) {
      canvas.sendToBack(backgroundRef.current);
    }
    if (polygonRef.current) {
      canvas.bringToFront(polygonRef.current);
    }
    if (textRef.current) {
      canvas.bringToFront(textRef.current);
    }

    canvas.requestRenderAll();
  };

  // Fabric.js 예제를 바탕으로 각 꼭짓점에 개별 컨트롤 추가
  const addVertexControls = (poly) => {
    const lastControl = poly.points.length - 1;
    poly.cornerStyle = 'circle';
    // 야간 모드에서도 잘 보이도록 컨트롤 색상 조정
    const isNight = !!formData?.isNight;
    poly.cornerColor = isNight ? 'rgba(255,255,255,0.95)' : '#FF4500';
    poly.controls = poly.points.reduce((acc, point, index) => {
      acc['p' + index] = new fabric.Control({
        positionHandler: vertexPositionHandler(index),
        actionHandler: vertexDragHandler(index, poly),
        actionName: 'modifyPolygon',
        pointIndex: index,
        cursorStyle: 'pointer',
      });
      return acc;
    }, {});

    // 중앙 이동용 컨트롤(선택 상자) 유지
    poly.hasBorders = true;
    poly.hasControls = true;
    poly.padding = 5;
    poly.borderColor = isNight ? '#38BDF8' : '#00BFFF';
    poly.cornerColor = isNight ? 'rgba(255,255,255,0.95)' : '#FF4500';

    // 마지막 컨트롤은 색을 약간 다르게
    if (poly.controls['p' + lastControl]) {
      poly.controls['p' + lastControl].cornerColor = isNight ? 'rgba(251,191,36,0.95)' : '#FF69B4';
    }
  };

  const vertexPositionHandler = (index) => {
    return function (_dim, _finalMatrix, fabricObject) {
      const x = fabric.util.transformPoint(
        new fabric.Point(
          fabricObject.points[index].x - fabricObject.pathOffset.x,
          fabricObject.points[index].y - fabricObject.pathOffset.y
        ),
        fabricObject.calcTransformMatrix()
      );
      return x;
    };
  };

  const vertexDragHandler = (index, poly) => {
    return function (eventData, transform, x, y) {
      const canvas = poly.canvas;
      if (!canvas) return false;

      const localPoint = fabric.util.transformPoint(
        new fabric.Point(x, y),
        fabric.util.invertTransform(poly.calcTransformMatrix())
      );

      poly.points[index].x = localPoint.x + poly.pathOffset.x;
      poly.points[index].y = localPoint.y + poly.pathOffset.y;

      poly.dirty = true;
      canvas.requestRenderAll();
      return true;
    };
  };

  const notifyAreaChange = () => {
    if (!polygonRef.current || !onAreaChange) return;

    // Fabric Polygon의 points는 pathOffset 기준이므로 원본 좌표로 변환
    const poly = polygonRef.current;
    const pts = poly.points.map((p) => ({
      x: p.x,
      y: p.y,
    }));

    const updatedArea = {
      type: 'polygon',
      points: pts,
    };

    onAreaChange(updatedArea);

    // 편집이 끝난 뒤에는 텍스트를 캔버스 중앙으로 재배치
    centerTextOnCanvas();
  };

  const centerTextOnCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !textRef.current) return;

    const centerX = canvas.getWidth() / 2;
    const centerY = canvas.getHeight() / 2;

    textRef.current.set({
      left: centerX,
      top: centerY,
      originX: 'center',
      originY: 'center',
    });

    canvas.requestRenderAll();
  };

  // 폰트 로딩 안정화: 브라우저에 아직 없는 폰트는 기본 고딕으로 폴백 후, 로드 완료 시 재렌더링
  const getSafeFontFamily = (desired) => {
    const fallback = 'malgun, sans-serif';
    const target = desired || 'malgun';

    if (typeof document === 'undefined' || !document.fonts || !document.fonts.check) {
      return target || fallback;
    }

    try {
      const loaded = document.fonts.check(`16px "${target}"`);
      if (loaded) return target;

      // 아직 로드되지 않은 경우: 폴백을 사용하되, 로드 완료 후 한 번 재렌더링
      document.fonts.ready.then(() => {
        const canvas = fabricCanvasRef.current;
        if (!canvas || !textRef.current) return;
        textRef.current.set('fontFamily', target);
        canvas.requestRenderAll();
      });

      return fallback;
    } catch (e) {
      return fallback;
    }
  };

  const createOrUpdateText = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const text = formData?.text || '';
    const color = formData?.textColor || '#FFFFFF';
    const safeFontFamily = getSafeFontFamily(formData?.fontFamily);

    if (!textRef.current) {
      // 폴리곤의 중심에 텍스트 배치
      const points = getPolygonPointsFromSelectedArea();
      let centerX = canvas.getWidth() / 2;
      let centerY = canvas.getHeight() / 2;

      if (points.length) {
        const xs = points.map((p) => p.x);
        const ys = points.map((p) => p.y);
        centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
        centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
      }

      const textbox = new fabric.Textbox(text || '', {
        left: centerX,
        top: centerY,
        originX: 'center',
        originY: 'center',
        fill: color,
        fontSize: formData?.fontSize || 80,
        fontFamily: safeFontFamily,
        fontWeight: formData?.fontWeight || '400',
        editable: false,
        selectable: false,
        evented: false,
      });

      textRef.current = textbox;
      canvas.add(textbox);
      canvas.bringToFront(textbox);
    } else {
      textRef.current.set({
        text: text || '',
        fill: color,
        fontSize: formData?.fontSize || textRef.current.fontSize,
        fontFamily: safeFontFamily || textRef.current.fontFamily,
        fontWeight: formData?.fontWeight || textRef.current.fontWeight,
      });
    }

    canvas.requestRenderAll();
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-2xl p-4">
      {!imageFile ? (
        <div className="text-center text-gray-400 py-16">
          건물 이미지를 먼저 업로드해주세요.
        </div>
      ) : (
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="border border-white/20 rounded-lg max-w-full h-auto"
            style={{ maxHeight: '600px', cursor: 'crosshair' }}
            onContextMenu={(e) => e.preventDefault()}
          />
          <div className="absolute bottom-3 left-3 bg-black/60 text-xs text-gray-200 rounded px-3 py-2 space-y-1">
            <div>💡 마우스 휠: 확대/축소</div>
            <div>💡 우클릭 or Ctrl 드래그: 이동</div>
            <div>💡 꼭짓점 드래그: 간판 영역 변형</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarpEditor;

