

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
      <div className="w-full border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#C83E2B] dark:text-[#E05A47] font-bold block mb-1">
            STATION 04 &middot; ALPHA MATTE EXTRACTION
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
            배경 제거 (누끼)
          </h1>
        </div>
        <p className="text-xs text-[#57534E] dark:text-[#A6A096] max-w-sm sm:text-right">
          직인, 서명, 인물·사물 사진에서 배경만 정밀하게 분리하여 투명 PNG로 추출합니다.
        </p>
      </div>

      {/* 업로드 영역 (이미지 없을 때) */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[360px] p-10 sm:p-14 border border-dashed border-[#BFB7A6] dark:border-[#3A3834] hover:border-[#161514] dark:hover:border-[#F2EFE9] bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="w-14 h-14 mb-5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] group-hover:text-[#C83E2B] flex items-center justify-center transition-colors">
            <Scissors className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#161514] dark:text-[#F2EFE9] mb-1 text-center">
            배경을 분리할 이미지를 선택하세요
          </h3>
          <p className="font-mono text-xs text-[#8A847C] dark:text-[#6E6A63] mb-6">
            OUTPUT: TRANSPARENT ALPHA PNG
          </p>
          <button
            type="button"
            className="px-6 py-2.5 bg-[#161514] group-hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:group-hover:bg-[#E05A47] text-[#F9F6ED] dark:text-[#161514] dark:group-hover:text-[#F9F6ED] font-bold text-xs transition-colors"
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
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-[#FDFBF7] dark:bg-[#1A1918] p-4 border border-[#DCD6C8] dark:border-[#2C2B28] gap-3 transition-colors">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 bg-[#EFECE2] dark:bg-[#22211F] text-[#57534E] dark:text-[#A6A096] border border-[#DCD6C8] dark:border-[#2C2B28]">
                FILE
              </span>
              <h3 className="text-xs font-bold text-[#161514] dark:text-[#F2EFE9] truncate max-w-xs">
                {fileName}
              </h3>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F6F3EA] dark:bg-[#121211] border border-[#DCD6C8] dark:border-[#2C2B28] text-[#161514] dark:text-[#F2EFE9] text-xs font-semibold hover:border-[#161514] dark:hover:border-[#F2EFE9] transition-colors cursor-pointer">
                <RotateCcw className="w-3.5 h-3.5" /> 초기화
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F6F3EA] dark:bg-[#121211] border border-[#DCD6C8] dark:border-[#2C2B28] text-[#161514] dark:text-[#F2EFE9] text-xs font-semibold hover:border-[#161514] dark:hover:border-[#F2EFE9] transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> 다른 이미지
              </button>
              {resultSrc && (
                <>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-[#F6F3EA] dark:bg-[#121211] border border-[#DCD6C8] dark:border-[#2C2B28] text-[#161514] dark:text-[#F2EFE9] text-xs font-semibold hover:border-[#161514] dark:hover:border-[#F2EFE9] transition-colors cursor-pointer">
                    색상 오버레이
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-2 bg-[#161514] hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:hover:bg-[#E05A47] text-[#F9F6ED] dark:text-[#161514] dark:hover:text-[#F9F6ED] text-xs font-bold transition-colors cursor-pointer">
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
          <div className="w-full grid grid-cols-1 md:grid-cols-2 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
            {/* 원본 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] uppercase tracking-wider font-bold text-[#57534E] dark:text-[#A6A096]">
                SOURCE IMAGE &middot; 원본
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] uppercase tracking-wider font-bold text-[#161514] dark:text-[#F2EFE9]">
                ALPHA MATTE &middot; 분리 결과
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px] relative"
                style={{ 
                  backgroundImage: "linear-gradient(45deg, #e5e0d5 25%, transparent 25%), linear-gradient(-45deg, #e5e0d5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e0d5 75%), linear-gradient(-45deg, transparent 75%, #e5e0d5 75%)", 
                  backgroundSize: "20px 20px", 
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px" 
                }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#C83E2B] animate-spin mb-3" />
                    <p className="text-xs font-mono font-semibold text-[#57534E] dark:text-[#A6A096]">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#8A847C] text-xs font-mono">{progress || "WAITING..."}</p>
                )}
              </div>
            </div>
          </div>

          {/* 다운로드 안내 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] border-l-4 border-l-[#C83E2B] text-[#161514] dark:text-[#F2EFE9] px-4 py-3 text-xs font-medium">
              배경 분리가 완료되었습니다. 상단 <strong>PNG 다운로드</strong> 버튼으로 투명 이미지를 저장하거나 <strong>색상 오버레이</strong>로 단색 인주 효과를 적용할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
