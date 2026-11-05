

import React, { useRef, useState } from "react";
import { ZoomIn, Download, Loader2, Upload, RotateCcw } from "lucide-react";
import { upscaleImage, type UpscaleModel } from "@/lib/upscale";

export default function ImageUpscaler() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalSize, setOriginalSize] = useState({ w: 0, h: 0 });
  const [resultSize, setResultSize] = useState({ w: 0, h: 0 });
  const [model, setModel] = useState<UpscaleModel>("realesrgan-x4plus");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setOriginalFile(file);
    setResultSrc(null);

    const dataUrl = URL.createObjectURL(file);
    setOriginalSrc(dataUrl);

    // 원본 크기 측정
    const img = new Image();
    img.onload = () => setOriginalSize({ w: img.width, h: img.height });
    img.src = dataUrl;
  };

  const handleUpscale = async () => {
    if (!originalFile) return;

    setIsProcessing(true);
    setProgress("서버에 이미지를 전송하는 중...");
    setResultSrc(null);

    try {
      setProgress("AI 모델로 업스케일링 중... (최대 10~30초 소요)");

      const { blob, width, height } = await upscaleImage(originalFile, { model, scale: 2 });
      const resultUrl = URL.createObjectURL(blob);
      setResultSrc(resultUrl);
      setResultSize({ w: width, h: height });

      setProgress("");
    } catch (err: any) {
      console.error("업스케일 실패:", err);
      setProgress(err.message || "업스케일링에 실패했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownload = () => {
    if (!resultSrc) return;
    const link = document.createElement("a");
    link.href = resultSrc;
    link.download = `${fileName || "image"}_2x.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setOriginalSrc(null);
    setResultSrc(null);
    setOriginalFile(null);
    setProgress("");
    setFileName("");
    setOriginalSize({ w: 0, h: 0 });
    setResultSize({ w: 0, h: 0 });
  };

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6">
      <div className="w-full border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#C83E2B] dark:text-[#E05A47] font-bold block mb-1">
            STATION 05 &middot; REAL-ESRGAN SUPER RESOLUTION
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
            해상도 2배 업스케일
          </h1>
        </div>
        <p className="text-xs text-[#57534E] dark:text-[#A6A096] max-w-sm sm:text-right">
          저해상도 스캔 문서나 흐릿한 사진을 신경망 기반으로 복원하여 2배 해상도로 선명하게 확대합니다.
        </p>
      </div>

      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[360px] p-10 sm:p-14 border border-dashed border-[#BFB7A6] dark:border-[#3A3834] hover:border-[#161514] dark:hover:border-[#F2EFE9] bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="w-14 h-14 mb-5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] group-hover:text-[#C83E2B] flex items-center justify-center transition-colors">
            <ZoomIn className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#161514] dark:text-[#F2EFE9] mb-1 text-center">
            업스케일할 이미지를 선택하세요
          </h3>
          <p className="font-mono text-xs text-[#8A847C] dark:text-[#6E6A63] mb-6">
            ENGINE: REAL-ESRGAN X4PLUS (2X OUTPUT)
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
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2 bg-[#161514] hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:hover:bg-[#E05A47] text-[#F9F6ED] dark:text-[#161514] dark:hover:text-[#F9F6ED] text-xs font-bold transition-colors cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
              )}
            </div>
          </div>

          {/* 설정 패널 */}
          <div className="w-full mb-6 p-4 bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="font-mono text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] whitespace-nowrap">
                MODEL
              </label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value as UpscaleModel)}
                className="bg-[#F6F3EA] dark:bg-[#121211] border border-[#DCD6C8] dark:border-[#2C2B28] text-[#161514] dark:text-[#F2EFE9] text-xs font-medium p-2.5 min-w-[220px] outline-none focus:border-[#161514]"
              >
                <option value="realesrgan-x4plus">일반 사진/문서 (RealESRGAN, 권장)</option>
                <option value="realesrgan-x4plus-anime">일러스트/애니 (Anime)</option>
                <option value="realesr-animevideov3">고속/애니메이션 (AnimeVideo v3)</option>
              </select>
            </div>
            
            <button onClick={handleUpscale} disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[#C83E2B] hover:bg-[#B03220] text-white text-xs font-bold disabled:opacity-50 transition-colors w-full sm:w-auto cursor-pointer">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
              {isProcessing ? "처리 중..." : "2배 업스케일링 실행"}
            </button>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
            {/* 원본 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] font-bold text-[#57534E] dark:text-[#A6A096] flex justify-between items-center">
                <span>SOURCE &middot; 원본</span>
                {originalSize.w > 0 && (
                  <span className="text-[10px] text-[#161514] dark:text-[#F2EFE9] bg-[#FDFBF7] dark:bg-[#1A1918] px-2 py-0.5 border border-[#DCD6C8] dark:border-[#2C2B28]">{originalSize.w} × {originalSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] font-bold text-[#161514] dark:text-[#F2EFE9] flex justify-between items-center">
                <span>UPSCALED &middot; 2X 결과</span>
                {resultSize.w > 0 && (
                  <span className="text-[10px] text-[#C83E2B] dark:text-[#E05A47] bg-[#FDFBF7] dark:bg-[#1A1918] px-2 py-0.5 border border-[#C83E2B]/40">{resultSize.w} × {resultSize.h}px (2X)</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#C83E2B] animate-spin mb-3" />
                    <p className="text-xs font-mono font-semibold text-[#57534E] dark:text-[#A6A096]">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#8A847C] text-xs font-mono">{progress || "READY FOR 2X UPSCALE"}</p>
                )}
              </div>
            </div>
          </div>

          {/* 완료 메시지 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] border-l-4 border-l-[#C83E2B] text-[#161514] dark:text-[#F2EFE9] px-4 py-3 text-xs font-medium">
              업스케일링 완료 ({originalSize.w}×{originalSize.h} &rarr; {resultSize.w}×{resultSize.h}). 상단 <strong>다운로드</strong> 버튼으로 고해상도 이미지를 저장하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
