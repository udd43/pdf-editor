import React from "react";
import { FileClock, RotateCcw, Trash2, ArrowUpRight } from "lucide-react";
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
      textCount > 0 ? `텍스트 ${textCount}` : null,
      imageCount > 0 ? `이미지 ${imageCount}` : null,
      redactCount > 0 ? `마스킹 ${redactCount}` : null,
    ]
      .filter(Boolean)
      .join(" · ") || "편집 요소 없음";

  return (
    <div className="w-full max-w-6xl mx-auto mb-6 px-2 sm:px-4">
      <div className="border border-[#C8C1B0] dark:border-[#34322E] border-l-4 border-l-[#C83E2B] bg-[#FDFBF7] dark:bg-[#1A1918] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-[fadeIn_200ms_ease-out]">
        {/* Left: Info */}
        <div className="flex items-start sm:items-center gap-3.5 min-w-0">
          <div className="w-9 h-9 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#C83E2B] flex items-center justify-center shrink-0">
            <FileClock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider">
              <span className="font-bold text-[#C83E2B] dark:text-[#E05A47]">
                SESSION RECOVERY
              </span>
              <span className="text-[#8A847C] dark:text-[#6E6A63]">
                / {formatAutoSaveTime(session.updatedAt)}
              </span>
            </div>
            <p className="text-sm font-bold text-[#161514] dark:text-[#F2EFE9] truncate max-w-md mt-0.5">
              {session.fileName}
            </p>
            <p className="text-xs font-mono text-[#57534E] dark:text-[#A6A096]">
              {elementsSummary} · P.{session.currentPage || 1}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            onClick={onDiscard}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#57534E] dark:text-[#A6A096] hover:text-[#C83E2B] border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] transition-colors cursor-pointer"
            title="저장된 작업을 폐기합니다"
          >
            <Trash2 className="w-3.5 h-3.5" />
            세션 폐기
          </button>
          <button
            onClick={onRestore}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-[#F9F6ED] dark:text-[#161514] bg-[#161514] hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:hover:bg-[#E05A47] dark:hover:text-[#F9F6ED] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            작업 복구
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
