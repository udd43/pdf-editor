"use client";

import React, { useRef, useState, useCallback } from "react";
import { Loader2, Scissors, Palette, Trash2, Move, Download } from "lucide-react";
import toast from "react-hot-toast";
import ColorPicker from "./ColorPicker";

export interface ImageOverlayData {
  id: string;
  originalSrc: string;    // 원본 이미지
  displaySrc: string;     // 화면에 보이는 이미지 (누끼/색변경 적용됨)
  removedBgSrc: string | null; // 배경 제거된 이미지
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  rotation?: number; // 0 ~ 360 degrees
}

interface ImageOverlayProps {
  overlay: ImageOverlayData;
  scale: number;
  onUpdate: (id: string, updates: Partial<ImageOverlayData>) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onDragStart?: () => void;
}

export default function ImageOverlay({
  overlay,
  scale,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
  onDragStart,
}: ImageOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // 이미지 중심점 계산 (화면 좌표)
  const getCenterPoint = useCallback(() => {
    const el = containerRef.current;
    if (!el) return { cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }, []);

  // 드래그 시작
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragStart) onDragStart();
    setIsDragging(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startBoxX = overlay.x;
    const startBoxY = overlay.y;

    let rafId: number | null = null;
    const handleMove = (ev: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        onUpdate(overlay.id, { x: startBoxX + dx, y: startBoxY + dy });
      });
    };
    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // 리사이즈 시작
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragStart) onDragStart();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = overlay.width;
    const startH = overlay.height;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const newW = Math.max(30, startW + dx);
      const newH = Math.max(30, startH + dy);
      onUpdate(overlay.id, { width: newW, height: newH });
    };
    const handleUp = () => {
      setIsResizing(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // 회전 핸들 드래그 - 마우스로 직접 돌리기
  const handleRotateStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDragStart) onDragStart();
    setIsRotating(true);

    const { cx, cy } = getCenterPoint();
    // 드래그 시작 시점의 각도
    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx) * (180 / Math.PI);
    const startRotation = overlay.rotation || 0;

    const handleMove = (ev: MouseEvent) => {
      const currentAngle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI);
      let delta = currentAngle - startAngle;
      let newRotation = startRotation + delta;
      // 정규화 0~360
      newRotation = ((newRotation % 360) + 360) % 360;
      // Shift 키를 누르면 15° 스냅
      if (ev.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }
      onUpdate(overlay.id, { rotation: Math.round(newRotation) });
    };
    const handleUp = () => {
      setIsRotating(false);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // 배경 제거 (누끼)
  const handleRemoveBg = async () => {
    setIsRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const response = await fetch(overlay.originalSrc);
      const blob = await response.blob();
      const resultBlob = await removeBackground(blob, {
        model: "isnet_quint8",
        output: { format: "image/png" as const },
      });
      const resultUrl = URL.createObjectURL(resultBlob);
      onUpdate(overlay.id, { displaySrc: resultUrl, removedBgSrc: resultUrl });
    } catch (err) {
      console.error("배경 제거 실패:", err);
      toast.error("배경 제거에 실패했습니다.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  // 색상 변경 (전경 픽셀에만 적용)
  const handleColorChange = (color: string, opacity: number) => {
    const srcImage = overlay.removedBgSrc || overlay.originalSrc;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 원본 이미지 그리기
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 색상 파싱
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // 투명하지 않은 픽셀(전경)에만 색상 오버레이
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) { // alpha > 10 인 픽셀만 (전경)
          data[i] = data[i] * (1 - opacity) + r * opacity;
          data[i + 1] = data[i + 1] * (1 - opacity) + g * opacity;
          data[i + 2] = data[i + 2] * (1 - opacity) + b * opacity;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const resultUrl = canvas.toDataURL("image/png");
      onUpdate(overlay.id, { displaySrc: resultUrl });
    };
    img.src = srcImage;
    setShowColorPicker(false);
  };

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = overlay.displaySrc;
    link.download = `overlay-${overlay.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const rotation = overlay.rotation || 0;

  return (
    <div
      ref={containerRef}
      className={`absolute group transition-[box-shadow,opacity] duration-150 ${isDragging ? "cursor-grabbing shadow-2xl opacity-90" : "cursor-grab"}`}
      style={{
        left: `${overlay.x * scale}px`,
        top: `${overlay.y * scale}px`,
        width: `${overlay.width * scale}px`,
        height: `${overlay.height * scale}px`,
        zIndex: isSelected ? 25 : 15,
      }}
      onMouseDown={handleDragStart}
      onClick={(e) => { e.stopPropagation(); onSelect(overlay.id); }}
    >
      {/* 이미지 (회전 적용) */}
      <img
        src={overlay.displaySrc}
        alt="overlay"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
        style={{ transform: `rotate(${rotation}deg)` }}
      />

      {/* 선택 시 테두리 + 컨트롤 */}
      {isSelected && (
        <>
          <div className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none" />

          {/* 회전 핸들: 우측 상단 */}
          <div
            className="absolute pointer-events-none"
            style={{ top: "-14px", right: "-14px", zIndex: 62 }}
          >
            <div
              onMouseDown={handleRotateStart}
              className={`pointer-events-auto flex items-center justify-center w-7 h-7 rounded-full border-2 shadow-md cursor-grab active:cursor-grabbing transition-colors ${
                isRotating ? "bg-blue-500 border-blue-600 text-white" : "bg-white border-blue-500 text-blue-500 hover:bg-blue-50"
              }`}
              title={`회전: ${rotation}° (Shift 누르면 15° 단위)`}
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" className="currentColor">
                <path d="M9.5 3.5C8.7 2.3 7.4 1.5 6 1.5C3.5 1.5 1.5 3.5 1.5 6C1.5 8.5 3.5 10.5 6 10.5C7.9 10.5 9.5 9.3 10.2 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                <path d="M10 1.5V4H7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* 회전 각도 표시 툴팁 제거 (사용자 요청) */}

          {/* 상단 도구 모음 */}
          <div className="absolute -top-10 left-0 flex flex-nowrap w-max gap-1 bg-white rounded-lg shadow-md border p-1" style={{ zIndex: 60 }}>
            {/* 이동 핸들은 마우스 드래그로 대체되므로 삭제함 */}

            {/* 배경 제거 */}
            <button
              onClick={handleRemoveBg}
              disabled={isRemovingBg}
              className="p-1.5 text-gray-600 hover:bg-green-50 hover:text-green-600 rounded disabled:opacity-50"
              title="배경 제거 (누끼)"
            >
              {isRemovingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            </button>

            {/* 색상 변경 */}
            <button
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="p-1.5 text-gray-600 hover:bg-purple-50 hover:text-purple-600 rounded"
              title="색상 변경"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* 다운로드 */}
            <button
              onClick={handleDownload}
              className="p-1.5 text-gray-600 hover:bg-blue-50 hover:text-blue-600 rounded"
              title="다운로드"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* 삭제 */}
            <button
              onClick={() => onDelete(overlay.id)}
              className="p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {/* 현재 각도 리셋 */}
            {rotation !== 0 && (
              <>
                <div className="w-px bg-gray-200 mx-0.5" />
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(overlay.id, { rotation: 0 }); }}
                  className="px-1.5 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="회전 초기화"
                >
                  회전 초기화 ✕
                </button>
              </>
            )}
          </div>

          {/* 컬러 피커 팝업 */}
          {showColorPicker && (
            <div className="absolute -top-10 left-40 z-50">
              <ColorPicker
                onColorChange={handleColorChange}
                onClose={() => setShowColorPicker(false)}
              />
            </div>
          )}

          {/* 리사이즈 핸들 (우하단) */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute -bottom-2 -right-2 w-5 h-5 bg-blue-500 rounded-full cursor-se-resize border-2 border-white shadow"
          />
        </>
      )}

      {/* 배경 제거 로딩 */}
      {isRemovingBg && (
        <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center rounded backdrop-blur-sm">
          <Loader2 className="w-8 h-8 text-green-600 animate-spin mb-2" />
          <span className="text-xs font-semibold text-gray-700">배경 제거 중...</span>
        </div>
      )}
    </div>
  );
}
