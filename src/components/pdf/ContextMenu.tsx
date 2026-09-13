

import React, { useEffect } from "react";
import { Copy, Trash2, Scissors, Download, Type, Lock } from "lucide-react";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  selectedTextId: string | null;
  selectedImageId: string | null;
  selectedRedactionId: string | null;
  onDeleteText: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onDeleteRedaction: (id: string) => void;
  onAddText: () => void;
}

export default function ContextMenu({
  x,
  y,
  onClose,
  selectedTextId,
  selectedImageId,
  selectedRedactionId,
  onDeleteText,
  onDeleteImage,
  onDeleteRedaction,
  onAddText,
}: ContextMenuProps) {
  useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener("click", handleClickOutside);
    window.addEventListener("scroll", handleClickOutside, true);
    return () => {
      window.removeEventListener("click", handleClickOutside);
      window.removeEventListener("scroll", handleClickOutside, true);
    };
  }, [onClose]);

  const hasSelection = selectedTextId || selectedImageId || selectedRedactionId;

  return (
    <div
      style={{ left: `${x}px`, top: `${y}px` }}
      className="fixed z-50 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-1.5 min-w-[160px] text-xs font-semibold animate-in fade-in zoom-in-95 duration-100"
      onClick={(e) => e.stopPropagation()}
    >
      {selectedTextId && (
        <button
          onClick={() => {
            onDeleteText(selectedTextId);
            onClose();
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" /> 텍스트 상자 삭제
        </button>
      )}

      {selectedImageId && (
        <button
          onClick={() => {
            onDeleteImage(selectedImageId);
            onClose();
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" /> 이미지 삭제
        </button>
      )}

      {selectedRedactionId && (
        <button
          onClick={() => {
            onDeleteRedaction(selectedRedactionId);
            onClose();
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2"
        >
          <Trash2 className="w-3.5 h-3.5" /> 블라인드 삭제
        </button>
      )}

      {!hasSelection && (
        <button
          onClick={() => {
            onAddText();
            onClose();
          }}
          className="w-full text-left px-3.5 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-200 flex items-center gap-2"
        >
          <Type className="w-3.5 h-3.5 text-blue-500" /> 여기에 텍스트 추가
        </button>
      )}
    </div>
  );
}
