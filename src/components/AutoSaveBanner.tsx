import React from "react";
import { FileClock, RotateCcw, Trash2, ArrowRight } from "lucide-react";
import { AutoSaveSession, formatAutoSaveTime } from "@/lib/autoSaveStorage";

interface AutoSaveBannerProps {
  session: AutoSaveSession;
  onRestore: () => void;
  onDiscard: () => void;
}

export default function AutoSaveBanner({ session, onRestore, onDiscard }: AutoSaveBannerProps) {
  const textCount = session.textBoxes?.length || 0;
  const imageCount = session.imageOverlays?.length || 0;
  const redactCount = session.redactions?.length || 0;

  const elementsSummary = [
    textCount > 0 ? `텍스트 ${textCount}개` : null,
    imageCount > 0 ? `이미지 ${imageCount}개` : null,
    redactCount > 0 ? `블라인드 ${redactCount}개` : null,
  ].filter(Boolean).join(" · ") || "편집 내역 없음";

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 px-4">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 border border-blue-200/80 dark:border-blue-800/80 p-4 shadow-sm backdrop-blur-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-[fadeIn_200ms_ease-out]">
        
        {/* Left: Info */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-blue-500/20">
            <FileClock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-100/70 dark:bg-blue-900/50 px-2 py-0.5 rounded-full">
                자동 저장 복구
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatAutoSaveTime(session.updatedAt)}
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-md mt-0.5">
              {session.fileName}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {elementsSummary} · {session.currentPage || 1}페이지 작업 중
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
            title="저장된 작업을 삭제합니다"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-xl shadow-md shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            이어서 작업하기
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
