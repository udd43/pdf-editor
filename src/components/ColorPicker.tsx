"use client";

import React, { useState } from "react";

interface ColorPickerProps {
  onColorChange: (color: string, opacity: number) => void;
  onClose: () => void;
}

const PRESET_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#6366F1", "#A855F7", "#EC4899", "#F43F5E",
  "#000000", "#FFFFFF",
];

export default function ColorPicker({ onColorChange, onClose }: ColorPickerProps) {
  const [color, setColor] = useState("#EF4444");
  const [opacity, setOpacity] = useState(80);

  const handleApply = () => {
    onColorChange(color, opacity / 100);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border p-4 w-64">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-bold text-gray-800">색상 변경</h4>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
      </div>

      {/* 프리셋 컬러 */}
      <div className="grid grid-cols-6 gap-2 mb-3">
        {PRESET_COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
              color === c ? "border-blue-500 scale-110" : "border-gray-200"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* 커스텀 컬러 */}
      <div className="flex items-center gap-2 mb-3">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-10 h-8 rounded cursor-pointer border-0"
        />
        <span className="text-xs text-gray-500 font-mono">{color}</span>
      </div>

      {/* 투명도 */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 mb-1 block">투명도: {opacity}%</label>
        <input
          type="range"
          min={10}
          max={100}
          value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))}
          className="w-full"
        />
      </div>

      {/* 미리보기 & 적용 */}
      <div className="flex gap-2">
        <div
          className="w-10 h-10 rounded-lg border border-gray-200"
          style={{ backgroundColor: color, opacity: opacity / 100 }}
        />
        <button
          onClick={handleApply}
          className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          적용
        </button>
      </div>
    </div>
  );
}
