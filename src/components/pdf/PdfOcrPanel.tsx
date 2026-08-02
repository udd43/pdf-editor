import React from "react";
import toast from "react-hot-toast";

interface PdfOcrPanelProps {
  extractedTexts: string[];
  showTextPanel: boolean;
  setShowTextPanel: (v: boolean) => void;
  onAddText: (isTransparent: boolean, text: string) => void;
}

export default function PdfOcrPanel({
  extractedTexts,
  showTextPanel,
  setShowTextPanel,
  onAddText,
}: PdfOcrPanelProps) {
  if (extractedTexts.length === 0) return null;

  return (
    <>
      {!showTextPanel && (
        <button
          onClick={() => setShowTextPanel(true)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 px-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-l-xl shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ writingMode: "vertical-rl" }}
        >
          📑 텍스트 ({extractedTexts.length})
        </button>
      )}

      <div
        className={`absolute right-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
          showTextPanel ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="w-72 h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl">
          <div className="bg-[#F9F6ED] dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
              📑 추출된 텍스트 ({extractedTexts.length})
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(extractedTexts.join("\n"));
                  toast.success("클립보드에 전체 텍스트가 복사되었습니다!");
                }}
                className="text-[10px] px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-all"
              >
                전체 복사
              </button>
              <button
                onClick={() => setShowTextPanel(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-gray-800">
            {extractedTexts.map((text, idx) => (
              <div
                key={idx}
                onDoubleClick={() => onAddText(true, text)}
                title="더블클릭하여 PDF에 텍스트 상자로 추가"
                className="p-2.5 bg-[#F9F6ED] dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-200 dark:hover:border-blue-700 transition-all group"
              >
                {text}
                <div className="text-[9px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 mt-1 font-bold transition-opacity">
                  ✨ 더블클릭으로 추가
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showTextPanel && (
        <div
          className="absolute inset-0 bg-black/20 z-40 rounded-lg"
          onClick={() => setShowTextPanel(false)}
        />
      )}
    </>
  );
}
