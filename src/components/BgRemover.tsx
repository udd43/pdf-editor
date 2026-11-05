

import React, { useRef, useState } from "react";
import { Scissors, Download, Loader2, Upload, RotateCcw } from "lucide-react";
import ColorPicker from "./ColorPicker";
import { removeImageBackground } from "@/lib/imageUtils";

export default function BgRemover() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    // 기존 URL 리소스 정리
    if (originalSrc?.startsWith("blob:")) URL.revokeObjectURL(originalSrc);
    if (resultSrc?.startsWith("blob:")) URL.revokeObjectURL(resultSrc);

    setFileName(file.name.replace(/\.[^.]+$/, ""));
    const originalDataUrl = URL.createObjectURL(file);
    setOriginalSrc(originalDataUrl);
    setResultSrc(null);

    setIsProcessing(true);
    setProgress("AI 배경 제거 처리 중...");

    try {
      const { resultUrl } = await removeImageBackground(file);
      setResultSrc(resultUrl);
      setProgress("");
    } catch (err) {
      console.error("배경 제거 실패:", err);
      setProgress("배경 제거에 실패했습니다. 다시 시도해 주세요.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultSrc) return;
    const link = document.createElement("a");
    link.href = resultSrc;
    link.download = `${fileName || "image"}_누끼.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleColorChange = (color: string, opacity: number) => {
    if (!resultSrc) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 10) {
          data[i] = data[i] * (1 - opacity) + r * opacity;
          data[i + 1] = data[i + 1] * (1 - opacity) + g * opacity;
          data[i + 2] = data[i + 2] * (1 - opacity) + b * opacity;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const newUrl = canvas.toDataURL("image/png");
      setResultSrc(newUrl);
    };
    img.src = resultSrc;
    setShowColorPicker(false);
  };

  const handleReset = () => {
    if (originalSrc?.startsWith("blob:")) URL.revokeObjectURL(originalSrc);
    if (resultSrc?.startsWith("blob:")) URL.revokeObjectURL(resultSrc);
    setOriginalSrc(null);
    setResultSrc(null);
    setProgress("");
    setFileName("");
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6">
      <div className="w-full border-b border-[#E2E6EE] dark:border-[#232936] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            배경 제거 (누끼)
          </h1>
          <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1">
            직인, 서명, 인물·사물 사진에서 배경만 정밀하게 분리하여 투명 PNG로 추출합니다.
          </p>
        </div>
        <span className="text-xs font-mono text-[#697586] dark:text-[#647087] shrink-0">
          투명 알파 채널 PNG 추출
        </span>
      </div>

      {/* 업로드 영역 (이미지 없을 때) */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[340px] p-10 sm:p-14 rounded-xl border border-dashed border-[#CBD2E0] dark:border-[#333B4D] hover:border-[#2563EB] dark:hover:border-[#3B82F6] bg-white dark:bg-[#12151C] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Scissors className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-[#0F141C] dark:text-[#F3F5F8]">
              배경을 분리할 이미지를 선택하세요
            </h2>
          </div>
          <p className="font-mono text-xs text-[#697586] dark:text-[#647087] mb-6">
            JPG, PNG, WEBP 지원
          </p>
          <button
            type="button"
            className="px-5 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-semibold text-xs transition-colors"
          >
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* 결과 영역 */}
      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white dark:bg-[#12151C] p-4 rounded-xl border border-[#E2E6EE] dark:border-[#232936] gap-3 transition-colors">
            <h2 className="text-sm font-bold text-[#0F141C] dark:text-[#F3F5F8] truncate max-w-xs">
              {fileName}
            </h2>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F8F9FB] dark:bg-[#181C26] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] text-xs font-semibold hover:border-[#2563EB] transition-colors cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> 초기화
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F8F9FB] dark:bg-[#181C26] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] text-xs font-semibold hover:border-[#2563EB] transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> 다른 이미지
              </button>
              {resultSrc && (
                <>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#F8F9FB] dark:bg-[#181C26] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] text-xs font-semibold hover:border-[#2563EB] transition-colors cursor-pointer">
                    색상 오버레이
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors cursor-pointer">
                    <Download className="w-3.5 h-3.5" /> PNG 다운로드
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 색상 피커 */}
          {showColorPicker && resultSrc && (
            <div className="w-full flex justify-end mb-4">
              <ColorPicker onColorChange={handleColorChange} onClose={() => setShowColorPicker(false)} />
            </div>
          )}

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 원본 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8]">
                원본 이미지
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#0F141C] dark:text-[#F3F5F8]">
                배경 분리 결과
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px] relative">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mb-3" />
                    <p className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8]">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#697586] text-xs">{progress || "대기 중..."}</p>
                )}
              </div>
            </div>
          </div>

          {/* 다운로드 안내 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 rounded-xl bg-white dark:bg-[#12151C] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] px-4 py-3 text-xs font-medium">
              배경 분리가 완료되었습니다. 상단 <strong>PNG 다운로드</strong> 버튼으로 투명 이미지를 저장하거나 <strong>색상 오버레이</strong>로 단색 인주 효과를 적용할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
