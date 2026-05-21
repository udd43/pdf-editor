"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, Trash2, Check, Undo2 } from "lucide-react";

interface SignaturePadProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (dataUrl: string, width: number, height: number) => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export default function SignaturePad({ isOpen, onClose, onSave }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [penWidth, setPenWidth] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  const CANVAS_WIDTH = 560;
  const CANVAS_HEIGHT = 280;

  const widths = [
    { value: 1, label: "가늘게" },
    { value: 3, label: "보통" },
    { value: 5, label: "굵게" },
    { value: 8, label: "아주 굵게" },
  ];

  // 캔버스에 모든 스트로크를 다시 그리기
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 모달이 열릴 때 초기화
  useEffect(() => {
    if (isOpen) {
      setStrokes([]);
      setCurrentStroke([]);
    }
  }, [isOpen]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    } else {
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasPoint(e);
    setCurrentStroke([point]);

    // 즉시 점 하나를 그리기
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.fillStyle = "#000000";
    ctx.arc(point.x, point.y, penWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);

    // 실시간 그리기
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = [...currentStroke, point];
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = penWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke, color: "#000000", width: penWidth }]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // 그려진 영역만 잘라내기 (투명 배경)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 그려진 영역의 바운딩 박스 계산
    let minX = CANVAS_WIDTH, minY = CANVAS_HEIGHT, maxX = 0, maxY = 0;
    for (const stroke of strokes) {
      for (const point of stroke.points) {
        minX = Math.min(minX, point.x - stroke.width);
        minY = Math.min(minY, point.y - stroke.width);
        maxX = Math.max(maxX, point.x + stroke.width);
        maxY = Math.max(maxY, point.y + stroke.width);
      }
    }

    // 여백 추가
    const padding = 8;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(CANVAS_WIDTH, maxX + padding);
    maxY = Math.min(CANVAS_HEIGHT, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    if (cropW <= 0 || cropH <= 0) return;

    // 잘라낸 영역을 새 캔버스에 그리기 (투명 배경)
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    // 투명 배경 유지
    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      cropCtx.beginPath();
      cropCtx.strokeStyle = "#000000";
      cropCtx.lineWidth = stroke.width;
      cropCtx.lineCap = "round";
      cropCtx.lineJoin = "round";
      cropCtx.moveTo(stroke.points[0].x - minX, stroke.points[0].y - minY);
      for (let i = 1; i < stroke.points.length; i++) {
        cropCtx.lineTo(stroke.points[i].x - minX, stroke.points[i].y - minY);
      }
      cropCtx.stroke();
    }

    const dataUrl = cropCanvas.toDataURL("image/png");
    onSave(dataUrl, cropW, cropH);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2">
            <span className="text-lg">✍️</span>
            <h3 className="text-base font-bold text-gray-800">서명 / 그리기</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/80 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 도구 모음 */}
        <div className="flex items-center gap-4 px-5 py-3 border-b bg-gray-50/80">
          {/* 굵기 선택 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 font-medium mr-1">굵기</span>
            {widths.map((w) => (
              <button
                key={w.value}
                onClick={() => setPenWidth(w.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all duration-150 ${
                  penWidth === w.value
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "bg-white border text-gray-600 hover:bg-gray-100"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* 실행취소 & 전체 지우기 */}
          <button
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-white border rounded-lg hover:bg-gray-100 disabled:opacity-40 transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" /> 지우기
          </button>
        </div>

        {/* 캔버스 영역 */}
        <div className="p-5 bg-gray-100/50">
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-300 bg-white shadow-inner">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block w-full cursor-crosshair touch-none"
              style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
            {strokes.length === 0 && !isDrawing && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm font-medium select-none">여기에 서명 또는 그림을 그려주세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t bg-gray-50/80">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-600 bg-white border rounded-lg hover:bg-gray-100 transition-colors font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={strokes.length === 0}
            className="flex items-center gap-1.5 px-5 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors font-semibold shadow-sm"
          >
            <Check className="w-4 h-4" /> PDF에 삽입
          </button>
        </div>
      </div>
    </div>
  );
}
