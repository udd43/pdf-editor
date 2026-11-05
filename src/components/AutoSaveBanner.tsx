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

  const elementsSummary =
    [
      textCount > 0 ? `텍스트 ${textCount}개` : null,
      imageCount > 0 ? `이미지 ${imageCount}개` : null,
      redactCount > 0 ? `마스킹 ${redactCount}개` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "편집 요소 없음";

  return (
    <div className="w-full max-w-6xl mx-auto mb-6 px-4">
      <div className="rounded-xl border border-[#CBD2E0] dark:border-[#333B4D] bg-white dark:bg-[#12151C] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-[fadeIn_200ms_ease-out]">
        {/* Left: Info */}
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <FileClock className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-[#2563EB] dark:text-[#3B82F6]">
                자동 저장된 작업 세션
              </span>
              <span className="text-[#697586] dark:text-[#647087]">
                &middot; {formatAutoSaveTime(session.updatedAt)}
              </span>
            </div>
            <p className="text-sm font-bold text-[#0F141C] dark:text-[#F3F5F8] truncate max-w-md mt-0.5">
              {session.fileName}
            </p>
            <p className="text-xs text-[#4B5565] dark:text-[#94A0B8]">
              {elementsSummary} &middot; {session.currentPage || 1}페이지 작업 중
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-[#4B5565] dark:text-[#94A0B8] hover:text-[#DC2626] border border-[#E2E6EE] dark:border-[#232936] bg-[#F8F9FB] dark:bg-[#181C26] transition-colors cursor-pointer"
            title="저장된 작업을 삭제합니다"
          >
            <Trash2 className="w-3.5 h-3.5" />
            삭제
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-[#2563EB] hover:bg-[#1D4ED8] transition-colors cursor-pointer"
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
