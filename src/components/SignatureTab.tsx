"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Trash2, Undo2, Download, PenTool, Type, Edit3 } from "lucide-react";
import toast from "react-hot-toast";

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

const FONTS = [
  { name: "Nanum Pen Script", label: "나눔 펜" },
  { name: "Nanum Brush Script", label: "나눔 브러쉬" },
  { name: "Hi Melody", label: "하이 멜로디" },
  { name: "Caveat", label: "영문 필기체" } // 영문 전용이지만 추가
];

export default function SignatureTab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typedText, setTypedText] = useState("");
  const [selectedFont, setSelectedFont] = useState(FONTS[0].name);

  const [isDrawing, setIsDrawing] = useState(false);
  const [penWidth, setPenWidth] = useState(3);
  const [penColor, setPenColor] = useState("#000000");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 400;

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

  // 모바일 터치 스크롤 방지
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const preventScroll = (e: TouchEvent) => e.preventDefault();
    canvas.addEventListener('touchstart', preventScroll, { passive: false });
    canvas.addEventListener('touchmove', preventScroll, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', preventScroll);
      canvas.removeEventListener('touchmove', preventScroll);
    };
  }, []);

  const drawTextOnCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (mode === "type" && typedText) {
      const fontSize = 80;
      const fontString = `${fontSize}px "${selectedFont}"`;
      
      try {
        // 폰트가 로드될 때까지 기다림
        await document.fonts.load(fontString);
      } catch (e) {
        console.error("Font load error", e);
      }

      ctx.font = fontString;
      ctx.fillStyle = penColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      
      // 텍스트를 캔버스 중앙에 배치
      ctx.fillText(typedText, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [typedText, selectedFont, penColor, mode]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (mode === "draw") {
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
    } else {
      drawTextOnCanvas();
    }
  }, [strokes, mode, drawTextOnCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

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
    if (mode !== "draw") return;
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
    if (mode !== "draw" || !isDrawing) return;
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
    if (mode !== "draw" || !isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, { points: currentStroke, color: penColor, width: penWidth }]);
      setCurrentStroke([]);
    }
  };

  const handleUndo = () => {
    if (mode === "draw") {
      setStrokes(prev => prev.slice(0, -1));
    }
  };

  const handleClear = () => {
    if (mode === "draw") {
      if (strokes.length > 0 && confirm("모든 서명을 지우시겠습니까?")) {
        setStrokes([]);
        setCurrentStroke([]);
        toast.success("서명이 초기화되었습니다.");
      }
    } else {
      setTypedText("");
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 그리기 모드일 때 스트로크가 없으면 불가, 텍스트 모드일 때 텍스트가 없으면 불가
    if (mode === "draw" && strokes.length === 0) {
      toast.error("그려진 서명이 없습니다.");
      return;
    }
    if (mode === "type" && !typedText) {
      toast.error("입력된 텍스트가 없습니다.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 이미지 데이터에서 실제 픽셀이 있는 영역 찾기
    const imgData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imgData.data;

    let minX = CANVAS_WIDTH, minY = CANVAS_HEIGHT, maxX = 0, maxY = 0;
    
    for (let y = 0; y < CANVAS_HEIGHT; y++) {
      for (let x = 0; x < CANVAS_WIDTH; x++) {
        const alpha = data[(y * CANVAS_WIDTH + x) * 4 + 3];
        if (alpha > 10) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    const padding = 16;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(CANVAS_WIDTH, maxX + padding);
    maxY = Math.min(CANVAS_HEIGHT, maxY + padding);

    const cropW = maxX - minX;
    const cropH = maxY - minY;

    if (cropW <= 0 || cropH <= 0) {
      toast.error("다운로드할 이미지가 없습니다.");
      return;
    }

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    // 원본 캔버스에서 잘라낼 영역을 새 캔버스에 그리기
    cropCtx.putImageData(ctx.getImageData(minX, minY, cropW, cropH), 0, 0);

    const dataUrl = cropCanvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `signature-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("투명 PNG 이미지가 다운로드되었습니다!");
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-4 sm:py-8 px-2 sm:px-4 transition-colors" ref={containerRef}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@700&family=Nanum+Brush+Script&family=Nanum+Pen+Script&family=Hi+Melody&display=swap');
      `}} />
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden w-full">
        {/* 헤더 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4 sm:px-8 py-4 sm:py-6 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800/50 shrink-0">
              <PenTool className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>서명 만들기</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">투명 배경의 서명 이미지를 만들어 저장하세요</p>
            </div>
          </div>
          
          {/* 모드 전환 토글 */}
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-xl shrink-0">
            <button
              onClick={() => setMode("draw")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "draw" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              직접 그리기
            </button>
            <button
              onClick={() => setMode("type")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === "type" ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Type className="w-4 h-4" />
              텍스트로 만들기
            </button>
          </div>
        </div>

        {/* 툴바 */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 sm:px-8 py-4 bg-gray-50/50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
          {mode === "draw" && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-8">굵기</span>
              <div className="flex gap-1.5">
                {widths.map((w) => (
                  <button
                    key={w.value}
                    onClick={() => setPenWidth(w.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-all font-medium ${
                      penWidth === w.value
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === "type" && (
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1 max-w-xs">
                <input
                  type="text"
                  value={typedText}
                  onChange={(e) => setTypedText(e.target.value)}
                  placeholder="서명할 이름을 입력하세요 (예: 김길동)"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">폰트</span>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg outline-none focus:border-blue-500 dark:focus:border-blue-400 text-sm"
                  style={{ fontFamily: selectedFont }}
                >
                  {FONTS.map(f => (
                    <option key={f.name} value={f.name} style={{ fontFamily: f.name, fontSize: '16px' }}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 w-8">색상</span>
            <div className="flex gap-2">
              {presetColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setPenColor(c.value)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    penColor === c.value
                      ? "border-blue-500 dark:border-blue-400 scale-110 shadow-sm"
                      : "border-gray-200 dark:border-gray-600 hover:scale-105"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
              <input
                type="color"
                value={penColor}
                onChange={(e) => setPenColor(e.target.value)}
                className="w-7 h-7 rounded-full border-2 border-gray-200 dark:border-gray-600 cursor-pointer overflow-hidden p-0 bg-transparent outline-none"
                title="사용자 지정 색상"
              />
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex gap-2">
            {mode === "draw" && (
              <button
                onClick={handleUndo}
                disabled={strokes.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 transition-colors shadow-sm"
              >
                <Undo2 className="w-4 h-4" /> 되돌리기
              </button>
            )}
            <button
              onClick={handleClear}
              disabled={mode === "draw" ? strokes.length === 0 : typedText.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 transition-colors shadow-sm font-medium"
            >
              <Trash2 className="w-4 h-4" /> 지우기
            </button>
          </div>
        </div>

        {/* 캔버스 */}
        <div className="p-4 sm:p-8 bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
          <div className="relative rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white shadow-sm mx-auto w-full aspect-[2/1] sm:aspect-auto sm:max-h-[400px]">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className={`block w-full h-full touch-none ${mode === "draw" ? "cursor-crosshair" : "cursor-default"}`}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
            {((mode === "draw" && strokes.length === 0 && !isDrawing) || (mode === "type" && !typedText)) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 dark:text-gray-500 font-medium select-none bg-white/80 dark:bg-gray-800/80 px-4 py-2 rounded-full backdrop-blur-sm">
                  {mode === "draw" ? "이 영역에 서명을 그려보세요" : "위 입력칸에 이름을 입력하면 서명이 생성됩니다"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-8 py-4 sm:py-5 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 text-center sm:text-left">
          <p className="text-xs text-gray-500 dark:text-gray-400">다운로드 시 빈 여백은 자동으로 잘라내어 투명 배경으로 저장됩니다.</p>
          <button
            onClick={handleDownload}
            disabled={mode === "draw" ? strokes.length === 0 : typedText.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 text-sm text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-40 transition-all font-semibold shadow-sm hover:shadow active:scale-95"
          >
            <Download className="w-4 h-4" /> 투명 PNG 다운로드
          </button>
        </div>
      </div>
    </div>
  );
}
