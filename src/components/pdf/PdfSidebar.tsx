import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Trash2, GripVertical } from "lucide-react";

interface ThumbnailProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  totalPages: number;
  onDragStart: (e: React.DragEvent, pageNumber: number) => void;
  onDragOver: (e: React.DragEvent, pageNumber: number) => void;
  onDrop: (e: React.DragEvent, pageNumber: number) => void;
  isDragTarget: boolean;
  dragPosition: "above" | "below" | null;
}

function Thumbnail({
  pdfDoc,
  pageNumber,
  isActive,
  onClick,
  onDelete,
  totalPages,
  onDragStart,
  onDragOver,
  onDrop,
  isDragTarget,
  dragPosition,
}: ThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isMounted = true;
    const renderThumb = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (!isMounted) return;
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport } as any).promise;
      } catch (err) {
        console.error("Thumbnail render error", err);
      }
    };
    renderThumb();
    return () => {
      isMounted = false;
    };
  }, [pdfDoc, pageNumber]);

  return (
    <div
      draggable={totalPages > 1}
      onDragStart={(e) => onDragStart(e, pageNumber)}
      onDragOver={(e) => onDragOver(e, pageNumber)}
      onDrop={(e) => onDrop(e, pageNumber)}
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${
        isActive
          ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
          : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      {isDragTarget && dragPosition === "above" && (
        <div className="absolute -top-1.5 left-1 right-1 h-[3px] bg-blue-500 rounded-full z-20 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
      )}
      {isDragTarget && dragPosition === "below" && (
        <div className="absolute -bottom-1.5 left-1 right-1 h-[3px] bg-blue-500 rounded-full z-20 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
      )}
      {totalPages > 1 && (
        <div className="absolute top-1 left-1 p-0.5 bg-white/80 dark:bg-gray-800/80 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-auto bg-white block" />
      <div
        className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold ${
          isActive
            ? "bg-blue-500 text-white"
            : "bg-gray-100/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
        }`}
      >
        {pageNumber}
      </div>
      {totalPages > 1 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 p-1 bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
          title="페이지 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

interface PdfSidebarProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy | null;
  numPages: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  onDeletePage: (page: number) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  // Page reorder
  onThumbDragStart: (e: React.DragEvent, pageNumber: number) => void;
  onThumbDragOver: (e: React.DragEvent, pageNumber: number) => void;
  onThumbDrop: (e: React.DragEvent, pageNumber: number) => void;
  dragTargetPage: number | null;
  dragPosition: "above" | "below" | null;
}

export default function PdfSidebar({
  pdfDoc,
  numPages,
  currentPage,
  setCurrentPage,
  onDeletePage,
  onDragOver,
  onDragLeave,
  onDrop,
  onThumbDragStart,
  onThumbDragOver,
  onThumbDrop,
  dragTargetPage,
  dragPosition,
}: PdfSidebarProps) {
  if (!pdfDoc || numPages <= 0) return null;

  return (
    <div
      className="w-24 shrink-0 flex flex-col bg-[#F9F6ED] dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl h-[80vh] sticky top-24 overflow-hidden transition-colors"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="bg-gray-100 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
        페이지
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {Array.from(new Array(numPages), (_, index) => (
          <Thumbnail
            key={index}
            pdfDoc={pdfDoc}
            pageNumber={index + 1}
            totalPages={numPages}
            isActive={currentPage === index + 1}
            onClick={() => setCurrentPage(index + 1)}
            onDelete={() => onDeletePage(index + 1)}
            onDragStart={onThumbDragStart}
            onDragOver={onThumbDragOver}
            onDrop={onThumbDrop}
            isDragTarget={dragTargetPage === index + 1}
            dragPosition={dragTargetPage === index + 1 ? dragPosition : null}
          />
        ))}
        <div className="pt-2 pb-4 text-center text-[10px] text-gray-400 dark:text-gray-500 font-medium">
          다른 PDF를
          <br />
          여기로 드래그하여 병합
        </div>
      </div>
    </div>
  );
}
