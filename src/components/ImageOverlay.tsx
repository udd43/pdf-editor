"use client";

import React, { useRef, useState } from "react";
import { Loader2, Scissors, Palette, Trash2, Move } from "lucide-react";
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
}

interface ImageOverlayProps {
  overlay: ImageOverlayData;
  onUpdate: (id: string, updates: Partial<ImageOverlayData>) => void;
  onDelete: (id: string) => void;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export default function ImageOverlay({
  overlay,
  onUpdate,
  onDelete,
  isSelected,
  onSelect,
}: ImageOverlayProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // 드래그 시작
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, ox: overlay.x, oy: overlay.y };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - dragStart.current.x;
      const dy = ev.clientY - dragStart.current.y;
      onUpdate(overlay.id, { x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
    };
    const handleUp = () => {
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
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: overlay.width, h: overlay.height };

    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStart.current.x;
      const dy = ev.clientY - resizeStart.current.y;
      const newW = Math.max(30, resizeStart.current.w + dx);
      const newH = Math.max(30, resizeStart.current.h + dy);
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

  // 배경 제거 (누끼)
  const handleRemoveBg = async () => {
    setIsRemovingBg(true);
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const response = await fetch(overlay.originalSrc);
      const blob = await response.blob();
      const resultBlob = await removeBackground(blob, {
        output: { format: "image/png" as const },
      });
      const resultUrl = URL.createObjectURL(resultBlob);
      onUpdate(overlay.id, { displaySrc: resultUrl, removedBgSrc: resultUrl });
    } catch (err) {
      console.error("배경 제거 실패:", err);
      alert("배경 제거에 실패했습니다.");
    } finally {
      setIsRemovingBg(false);
    }
  };

  // 색상 변경 (전경 픽셀에만 적용)
  const handleColorChange = (color: string, opacity: number) => {
    const srcImage = overlay.removedBgSrc || overlay.displaySrc;

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

  return (
    <div
      className={`absolute group ${isDragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{
        left: `${overlay.x}px`,
        top: `${overlay.y}px`,
        width: `${overlay.width}px`,
        height: `${overlay.height}px`,
        zIndex: isSelected ? 25 : 15,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(overlay.id); }}
    >
      {/* 이미지 */}
      <img
        src={overlay.displaySrc}
        alt="overlay"
        className="w-full h-full object-contain pointer-events-none select-none"
        draggable={false}
      />

      {/* 선택 시 테두리 + 컨트롤 */}
      {isSelected && (
        <>
          <div className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none" />

          {/* 상단 도구 모음 */}
          <div className="absolute -top-10 left-0 flex gap-1 bg-white rounded-lg shadow-md border p-1">
            {/* 이동 핸들 */}
            <button
              onMouseDown={handleDragStart}
              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing"
              title="이동"
            >
              <Move className="w-4 h-4" />
            </button>

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

            {/* 삭제 */}
            <button
              onClick={() => onDelete(overlay.id)}
              className="p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 rounded"
              title="삭제"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
