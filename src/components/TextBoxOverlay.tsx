import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Move, Minus, Plus, Trash2 } from 'lucide-react';
import { TextBox } from './PdfEditor';

interface TextBoxOverlayProps {
  box: TextBox;
  scale: number;
  isSelected: boolean;
  onSelect: () => void;
  isDragging: boolean;
  isResizing: boolean;
  onDragStart: (e: React.MouseEvent, id: string, startX: number, startY: number) => void;
  onResizeStart: (e: React.MouseEvent, id: string, startW: number, startH: number) => void;
  onChange: (id: string, newText: string) => void;
  onDelete: (id: string) => void;
  onFontSizeChange: (id: string, delta: number) => void;
  onToggleTransparent: (id: string) => void;
  onFontFamilyChange: (id: string, fontFamily: string) => void;
}

const TextBoxOverlay: React.FC<TextBoxOverlayProps> = ({
  box,
  scale,
  isSelected,
  onSelect,
  isDragging,
  isResizing,
  onDragStart,
  onResizeStart,
  onChange,
  onDelete,
  onFontSizeChange,
  onToggleTransparent,
  onFontFamilyChange,
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 외부 클릭 시 편집 모드 해제
  useEffect(() => {
    if (!isSelected) {
      setIsEditMode(false);
    }
  }, [isSelected]);

  // 텍스트 박스 클릭 → 드래그 이동 시작 (편집 모드가 아닐 때)
  const handleBoxMouseDown = useCallback((e: React.MouseEvent) => {
    if (isEditMode) return; // 편집 모드에서는 텍스트 선택을 위해 드래그 무시
    e.preventDefault();
    e.stopPropagation();
    onDragStart(e, box.id, box.x, box.y);
  }, [isEditMode, onDragStart, box.id, box.x, box.y]);

  // 더블클릭 → 편집 모드 진입
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditMode(true);
    onSelect();
    // 포커스를 다음 틱에 줘야 React가 상태를 반영한 후 적용됨
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
  }, [onSelect]);

  return (
    <div
      className={`absolute group transition-[box-shadow,transform,opacity] duration-150 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''} ${isDragging ? 'shadow-2xl scale-[1.02] opacity-90' : ''}`}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleBoxMouseDown}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      style={{
        left: `${box.x * scale}px`,
        top: `${box.y * scale}px`,
        width: `${box.width * scale}px`,
        height: `${box.height * scale}px`,
        zIndex: isDragging || isResizing || isSelected ? 30 : 10,
        cursor: isEditMode ? 'text' : (isDragging ? 'grabbing' : 'grab'),
      }}
    >
      {/* 상단 컨트롤 바 */}
      <div className="absolute -top-8 left-0 flex items-center gap-0.5 bg-white rounded-lg shadow-md border px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
        <select
          value={box.fontFamily || "NotoSansKR"}
          onChange={(e) => onFontFamilyChange(box.id, e.target.value)}
          className="text-[11px] font-medium border-r bg-transparent outline-none px-1.5 py-0.5 text-gray-600 hover:bg-gray-50 cursor-pointer"
        >
          <option value="NotoSansKR">기본고딕</option>
          <option value="NanumMyeongjo">명조체</option>
          <option value="Jua">주아체(둥근)</option>
        </select>
        <button
          onClick={() => onToggleTransparent(box.id)}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded text-[10px]"
        >
          {box.isTransparent ? "🔳" : "⬜"}
        </button>
        <button
          onClick={() => onFontSizeChange(box.id, -2)}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] font-mono text-gray-400 min-w-[24px] text-center select-none">
          {box.fontSize}
        </span>
        <button
          onClick={() => onFontSizeChange(box.id, 2)}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onDelete(box.id)}
          className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={box.text}
        onChange={(e) => onChange(box.id, e.target.value)}
        readOnly={!isEditMode}
        className={`w-full h-full resize-none overflow-hidden m-0 leading-snug ${
          isEditMode ? 'cursor-text' : 'cursor-grab pointer-events-none'
        }`}
        style={{
          fontSize: `${box.fontSize * scale}px`,
          fontFamily: box.fontFamily || "NotoSansKR",
          whiteSpace: "pre-wrap",
          backgroundColor: box.isTransparent ? "transparent" : "#fff",
          color: "#000",
          outline: box.isNew
            ? "2px solid rgba(34,197,94,0.6)"
            : box.isEdited
            ? "2px solid rgba(245,158,11,0.5)"
            : "1px solid rgba(59,130,246,0.3)",
          outlineOffset: "-1px",
          border: "none",
          padding: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}
        onBlur={() => setIsEditMode(false)}
      />

      <div
        onMouseDown={(e) => onResizeStart(e, box.id, box.width, box.height)}
        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity z-30"
      />

    </div>
  );
};

export default React.memo(TextBoxOverlay);
