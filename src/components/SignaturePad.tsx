"use client";
 
import React, { useRef, useState, useEffect, useCallback } from "react";
import { X, Trash2, Check, Undo2, Download } from "lucide-react";
import toast from "react-hot-toast";

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
  const [penColor, setPenColor] = useState("#000000");
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
 
  const CANVAS_WIDTH = 560;
  const CANVAS_HEIGHT = 280;
 
  const presetColors = [
    { value: "#000000", label: "검정" },
    { value: "#FFFFFF", label: "흰색" },
    { value: "#EF4444", label: "빨강" },
    { value: "#3B82F6", label: "파랑" },
    { value: "#22C55E", label: "초록" },
  ];

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
  }, [strokes]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

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
    ctx.fillStyle = penColor;
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
    setStrokes([]);
    setCurrentStroke([]);
    toast.success("초기화되었습니다.");
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) {
      toast.error("그려진 내용이 없습니다.");
      return;
    }

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

    if (cropW <= 0 || cropH <= 0) {
      toast.error("저장할 이미지가 없습니다.");
      return;
    }

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
    onSave(dataUrl, cropW, cropH);
    toast.success("PDF에 서명이 추가되었습니다.");
    onClose();
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) {
      toast.error("그려진 내용이 없습니다.");
      return;
    }

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

    if (cropW <= 0 || cropH <= 0) {
      toast.error("다운로드할 이미지가 없습니다.");
      return;
    }

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return;

    // 투명 배경으로 스트로크 그리기
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
    toast.success("이미지가 다운로드되었습니다.");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-[640px] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80">
          <div className="flex items-center gap-2">
            <span className="text-lg">✍️</span>
            <h3 className="text-base font-bold text-gray-800 dark:text-white">서명 / 그리기</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 도구 모음 */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 overflow-y-auto max-h-[30vh]">
          {/* 굵기 선택 */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mr-1">굵기</span>
            {widths.map((w) => (
              <button
                key={w.value}
                onClick={() => setPenWidth(w.value)}
                className={`px-2.5 py-1 text-xs rounded-md transition-all duration-150 ${
                  penWidth === w.value
                    ? "bg-blue-600 text-white font-semibold shadow-sm"
                    : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>

          {/* 색상 선택 */}
          <div className="flex items-center gap-1.5 ml-2 border-l pl-4 border-gray-200 dark:border-gray-700">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium mr-1">색상</span>
            {presetColors.map((c) => {
              const isWhite = c.value === "#FFFFFF";
              const isBlack = c.value === "#000000";
              return (
                <button
                  key={c.value}
                  onClick={() => setPenColor(c.value)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    penColor === c.value
                      ? "ring-2 ring-blue-500 dark:ring-blue-400 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 scale-110"
                      : "hover:scale-110"
                  } ${
                    isWhite
                      ? "border-2 border-gray-300 dark:border-gray-400"
                      : isBlack
                        ? "border-2 border-gray-400 dark:border-gray-300"
                        : "border-2 border-gray-200 dark:border-gray-600"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              );
            })}
            <input
              type="color"
              value={penColor}
              onChange={(e) => setPenColor(e.target.value)}
              className="w-5 h-5 rounded-full border border-gray-300 dark:border-gray-600 cursor-pointer overflow-hidden p-0 bg-transparent outline-none"
              title="사용자 지정 색상"
            />
          </div>

          <div className="flex-1 hidden sm:block" />

          {/* 실행취소 & 전체 지우기 */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleUndo}
              disabled={strokes.length === 0}
              className="flex-1 sm:flex-none flex justify-center items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors"
            >
              <Undo2 className="w-3.5 h-3.5" /> 되돌리기
            </button>
            <button
              onClick={handleClear}
              disabled={strokes.length === 0}
              className="flex-1 sm:flex-none flex justify-center items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" /> 지우기
            </button>
          </div>
        </div>

        {/* 캔버스 영역 */}
        <div className="p-4 sm:p-5 bg-gray-100/50 dark:bg-gray-900/50 overflow-y-auto">
          <div className="relative rounded-xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 bg-white shadow-inner w-full">
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
                <p className="text-gray-400 dark:text-gray-500 text-sm font-medium select-none">여기에 서명 또는 그림을 그려주세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 shrink-0">
          <button
            onClick={handleDownload}
            disabled={strokes.length === 0}
            className="hidden sm:flex items-center gap-1.5 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-40 transition-colors font-medium mr-auto"
          >
            <Download className="w-4 h-4 text-gray-600 dark:text-gray-300" /> 그림 다운로드
          </button>
          
          <div className="flex flex-1 sm:flex-none justify-end gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors font-medium"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={strokes.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors font-semibold shadow-sm"
            >
              <Check className="w-4 h-4" /> PDF에 삽입
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
