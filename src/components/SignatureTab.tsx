"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Trash2, Undo2, Download, PenTool } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export default function SignatureTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#000000");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  
  // Use state for dimensions so canvas can resize based on container
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });

  const presetColors = [
    { value: "#000000", label: "검정" },
    { value: "#EF4444", label: "빨강" },
    { value: "#3B82F6", label: "파랑" },
    { value: "#22C55E", label: "초록" },
  ];

  const widths = [
    { value: 2, label: "가늘게" },
    { value: 4, label: "보통" },
    { value: 6, label: "굵게" },
    { value: 10, label: "아주 굵게" },
  ];

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth - 40, // padding
          height: 400,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, dimensions]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const getCanvasPoint = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = dimensions.width / rect.width;
    const scaleY = dimensions.height / rect.height;

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

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.beginPath();
    ctx.fillStyle = penColor;
    ctx.arc(point.x, point.y, penWidth / 2, 0, Math.PI * 2);
    ctx.fill();
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    setCurrentStroke(prev => [...prev, point]);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const pts = [...currentStroke, point];
    if (pts.length >= 2) {
      ctx.beginPath();
      ctx.strokeStyle = penColor;
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
      setStrokes(prev => [...prev, { points: currentStroke, color: penColor, width: penWidth }]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (confirm("모든 서명을 지우시겠습니까?")) {
      setStrokes([]);
      setCurrentStroke([]);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // 바운딩 박스 계산 (그려진 영역만)
    let minX = dimensions.width, minY = dimensions.height, maxX = 0, maxY = 0;
    for (const stroke of strokes) {
      for (const point of stroke.points) {
        minX = Math.min(minX, point.x - stroke.width);
        minY = Math.min(minY, point.y - stroke.width);
        maxX = Math.max(maxX, point.x + stroke.width);
        maxY = Math.max(maxY, point.y + stroke.width);
      }
    }

    const padding = 16;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(dimensions.width, maxX + padding);
    maxY = Math.min(dimensions.height, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    if (cropW <= 0 || cropH <= 0) return;

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      cropCtx.beginPath();
      cropCtx.strokeStyle = stroke.color;
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
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `signature-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-8 px-4" ref={containerRef}>
      <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-8 py-6 border-b border-gray-100">
          <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center border border-blue-100">
            <PenTool className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "Inter, sans-serif" }}>서명 그리기</h2>
            <p className="text-sm text-gray-500">투명 배경의 서명 이미지를 만들어 저장하세요</p>
          </div>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap items-center gap-6 px-8 py-4 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 w-8">굵기</span>
            <div className="flex gap-1.5">
              {widths.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setPenWidth(w.value)}
                  className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                    penWidth === w.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 w-8">색상</span>
            <div className="flex gap-2">
              {presetColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPenColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    penColor === c.value
                      ? "border-blue-500 scale-110 shadow-sm"
                      : "border-gray-200 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="w-7 h-7 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden p-0 bg-transparent outline-none"
                title="사용자 지정 색상"
              />
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 transition-colors shadow-sm"
            >
              <Undo2 className="w-4 h-4" /> 되돌리기
            </button>
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 disabled:opacity-40 transition-colors shadow-sm font-medium"
            >
              <Trash2 className="w-4 h-4" /> 지우기
            </button>
          </div>
        </div>

        {/* 캔버스 */}
        <div className="p-8 bg-gray-50">
          <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 bg-white shadow-sm mx-auto" style={{ width: dimensions.width, height: dimensions.height }}>
            <canvas
              ref={canvasRef}
              width={dimensions.width}
              height={dimensions.height}
              className="block w-full h-full cursor-crosshair touch-none"
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
                <p className="text-gray-400 font-medium select-none bg-white/80 px-4 py-2 rounded-full backdrop-blur-sm">
                  이 영역에 서명이나 그림을 그려보세요
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-gray-100 bg-white">
          <p className="text-xs text-gray-500">다운로드 시 빈 여백은 자동으로 잘라내어 투명 배경으로 저장됩니다.</p>
          <button
            onClick={handleDownload}
            disabled={strokes.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all font-semibold shadow-sm hover:shadow active:scale-95"
          >
            <Download className="w-4 h-4" /> 투명 PNG 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
