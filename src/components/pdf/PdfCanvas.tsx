import React, { useEffect, useRef } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Image as ImageIcon, Trash2 } from "lucide-react";
import TextBoxOverlay from "../TextBoxOverlay";
import ImageOverlayComponent, { ImageOverlayData } from "../ImageOverlay";
import { TextBox } from "../PdfEditor";
import { RedactionData } from "@/hooks/usePdfElements";

interface PdfCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  canvasWrapperRef: React.RefObject<HTMLDivElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
  scale: number;
  status: string;
  statusMsg: string;
  currentPage: number;
  isRedactMode: boolean;
  isDragOver: boolean;

  // TextBox handlers
  textBoxes: TextBox[];
  selectedTextId: string | null;
  draggingTextId: string | null;
  resizingTextId: string | null;
  onSelectText: (id: string | null) => void;
  onTextDragStart: (e: React.MouseEvent, id: string, x: number, y: number) => void;
  onTextResizeStart: (e: React.MouseEvent, id: string, w: number, h: number) => void;
  onTextChange: (id: string, text: string) => void;
  onTextDelete: (id: string) => void;
  onFontSizeChange: (id: string, delta: number) => void;
  onToggleTransparent: (id: string) => void;
  onFontFamilyChange: (id: string, fontFamily: string) => void;

  // ImageOverlay handlers
  imageOverlays: ImageOverlayData[];
  selectedImageId: string | null;
  onSelectImage: (id: string | null) => void;
  onImageUpdate: (id: string, updates: Partial<ImageOverlayData>) => void;
  onImageDelete: (id: string) => void;
  onImageDragStart: () => void;

  // Redaction
  redactions: RedactionData[];
  selectedRedactionId: string | null;
  onSelectRedaction: (id: string | null) => void;
  onRemoveRedaction: (id: string) => void;
  onUpdateRedaction?: (id: string, updates: Partial<RedactionData>) => void;
  drawingRedaction: { startX: number; startY: number; currentX: number; currentY: number } | null;
  redactColor?: "black" | "white";

  // Canvas events
  onCanvasDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRedactMouseDown: (e: React.MouseEvent) => void;
  onRedactMouseMove: (e: React.MouseEvent) => void;
  onRedactMouseUp: () => void;
}

export default function PdfCanvas({
  canvasRef,
  canvasWrapperRef,
  containerRef,
  scale,
  status,
  statusMsg,
  currentPage,
  isRedactMode,
  isDragOver,
  textBoxes,
  selectedTextId,
  draggingTextId,
  resizingTextId,
  onSelectText,
  onTextDragStart,
  onTextResizeStart,
  onTextChange,
  onTextDelete,
  onFontSizeChange,
  onToggleTransparent,
  onFontFamilyChange,
  imageOverlays,
  selectedImageId,
  onSelectImage,
  onImageUpdate,
  onImageDelete,
  onImageDragStart,
  redactions,
  selectedRedactionId,
  onSelectRedaction,
  onRemoveRedaction,
  onUpdateRedaction,
  drawingRedaction,
  redactColor = "black",
  onCanvasDoubleClick,
  onDragOver,
  onDragLeave,
  onDrop,
  onRedactMouseDown,
  onRedactMouseMove,
  onRedactMouseUp,
}: PdfCanvasProps) {
  const isLoading = status === "rendering" || status === "ocr";

  return (
    <div
      ref={containerRef}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`border border-gray-300 dark:border-gray-600 shadow-2xl bg-gray-100 dark:bg-gray-900 overflow-auto rounded-lg flex-1 min-w-0 transition-all ${
        isDragOver ? "ring-4 ring-indigo-500 ring-offset-2 scale-[1.01]" : ""
      }`}
      style={{ minHeight: "600px" }}
    >
      <div
        ref={canvasWrapperRef}
        onDoubleClick={onCanvasDoubleClick}
        onMouseDown={onRedactMouseDown}
        onMouseMove={onRedactMouseMove}
        onMouseUp={onRedactMouseUp}
        onMouseLeave={onRedactMouseUp}
        className={`relative mx-auto w-max bg-white ${isRedactMode ? "cursor-crosshair" : ""}`}
      >
        <canvas ref={canvasRef} className="block" />

        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-semibold text-gray-700">{statusMsg}</p>
          </div>
        )}

        {isDragOver && (
          <div className="absolute inset-0 bg-indigo-500/20 border-4 border-dashed border-indigo-600 flex flex-col items-center justify-center z-40 backdrop-blur-[1px] pointer-events-none animate-pulse">
            <ImageIcon className="w-16 h-16 text-indigo-700 mb-2" />
            <p className="text-lg font-bold text-indigo-900">여기에 이미지를 드롭하여 추가</p>
          </div>
        )}

        {/* TextBox Overlays */}
        {status === "done" &&
          textBoxes
            .filter((box) => box.pageIndex === currentPage)
            .map((box) => (
              <TextBoxOverlay
                key={box.id}
                box={box}
                scale={scale}
                isSelected={selectedTextId === box.id}
                onSelect={() => {
                  onSelectText(box.id);
                  onSelectImage(null);
                }}
                isDragging={draggingTextId === box.id}
                isResizing={resizingTextId === box.id}
                onDragStart={onTextDragStart}
                onResizeStart={onTextResizeStart}
                onChange={onTextChange}
                onDelete={onTextDelete}
                onFontSizeChange={onFontSizeChange}
                onToggleTransparent={onToggleTransparent}
                onFontFamilyChange={onFontFamilyChange}
              />
            ))}

        {/* Image Overlays */}
        {status === "done" &&
          imageOverlays
            .filter((overlay) => overlay.pageIndex === currentPage)
            .map((overlay) => (
              <ImageOverlayComponent
                key={overlay.id}
                overlay={overlay}
                scale={scale}
                onUpdate={onImageUpdate}
                onDelete={onImageDelete}
                isSelected={selectedImageId === overlay.id}
                onSelect={(id) => {
                  onSelectImage(id);
                  onSelectText(null);
                }}
                onDragStart={onImageDragStart}
              />
            ))}

        {/* Empty state hint */}
        {status === "done" &&
          textBoxes.length === 0 &&
          imageOverlays.length === 0 &&
          redactions.length === 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900/80 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm pointer-events-none animate-bounce z-50">
              💡 빈 공간을 더블클릭하여 텍스트를 추가하세요
            </div>
          )}

        {/* Redactions */}
        {status === "done" &&
          redactions
            .filter((r) => r.pageIndex === currentPage)
            .map((r) => {
              const isWhite = r.color === "#FFFFFF" || r.color === "white";
              return (
                <div
                  key={r.id}
                  className={`absolute z-10 group transition-[border-color,box-shadow] ${
                    isWhite
                      ? "bg-white border border-gray-300 dark:border-gray-600 shadow-xs hover:border-blue-400"
                      : "bg-gray-900"
                  } ${selectedRedactionId === r.id ? "ring-2 ring-blue-500" : ""}`}
                  style={{
                    left: r.x * scale,
                    top: r.y * scale,
                    width: r.width * scale,
                    height: r.height * scale,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectRedaction(r.id);
                  }}
                >
                  {/* Delete button */}
                  <button
                    className={`absolute -top-3 -right-3 bg-white dark:bg-gray-800 rounded-full p-1 shadow-md text-red-500 hover:text-red-700 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all z-20 ${
                      selectedRedactionId === r.id ? "opacity-100" : ""
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRedaction(r.id);
                    }}
                    onMouseEnter={() => onSelectRedaction(r.id)}
                    onMouseLeave={() => onSelectRedaction(null)}
                    title="블라인드 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Color toggle button */}
                  {onUpdateRedaction && (
                    <button
                      className={`absolute -top-3 -left-3 bg-white dark:bg-gray-800 rounded-full p-1 shadow-md text-gray-600 hover:text-gray-900 dark:text-gray-300 opacity-0 group-hover:opacity-100 hover:scale-110 transition-all z-20 ${
                        selectedRedactionId === r.id ? "opacity-100" : ""
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateRedaction(r.id, { color: isWhite ? "#111827" : "#FFFFFF" });
                      }}
                      onMouseEnter={() => onSelectRedaction(r.id)}
                      onMouseLeave={() => onSelectRedaction(null)}
                      title={isWhite ? "검은색 블라인드로 변경" : "흰색 블라인드로 변경"}
                    >
                      <div className={`w-3.5 h-3.5 rounded-full border border-gray-400 ${isWhite ? "bg-gray-900" : "bg-white"}`} />
                    </button>
                  )}
                </div>
              );
            })}

        {/* Drawing Redaction */}
        {isRedactMode && drawingRedaction && (
          <div
            className={`absolute z-20 pointer-events-none ${
              redactColor === "white"
                ? "bg-white/90 border-2 border-dashed border-gray-600 shadow-md"
                : "bg-gray-900/80 border-2 border-gray-900"
            }`}
            style={{
              left: Math.min(drawingRedaction.startX, drawingRedaction.currentX),
              top: Math.min(drawingRedaction.startY, drawingRedaction.currentY),
              width: Math.abs(drawingRedaction.currentX - drawingRedaction.startX),
              height: Math.abs(drawingRedaction.currentY - drawingRedaction.startY),
            }}
          />
        )}
      </div>
    </div>
  );
}
