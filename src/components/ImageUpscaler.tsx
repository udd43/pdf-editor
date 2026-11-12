

import React, { useRef, useState } from "react";
import { ZoomIn, Download, Loader2, Upload, RotateCcw } from "lucide-react";
import { upscaleImage, type UpscaleModel } from "@/lib/upscale";
import { saveFile } from "@/lib/saveFile";

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

  const handleDownload = async () => {
    if (!resultSrc) return;
    try {
      await saveFile(resultSrc, `${fileName || "image"}_2x.png`, "image/png");
    } catch (err) {
      console.error("저장 실패:", err);
    }
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
      <div className="w-full border-b border-[#E2E6EE] dark:border-[#232936] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            해상도 2배 업스케일
          </h1>
          <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1">
            저해상도 스캔 문서나 흐릿한 사진을 신경망 기반으로 복원하여 2배 해상도로 선명하게 확대합니다.
          </p>
        </div>
        <span className="text-xs font-mono text-[#697586] dark:text-[#647087] shrink-0">
          Real-ESRGAN 2x
        </span>
      </div>

      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[340px] p-10 sm:p-14 rounded-xl border border-dashed border-[#CBD2E0] dark:border-[#333B4D] hover:border-[#2563EB] dark:hover:border-[#3B82F6] bg-white dark:bg-[#12151C] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <ZoomIn className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-[#0F141C] dark:text-[#F3F5F8]">
              업스케일할 이미지를 선택하세요
            </h2>
          </div>
          <p className="font-mono text-xs text-[#697586] dark:text-[#647087] mb-6">
            일반 문서, 사진, 일러스트 2배 확대 지원
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
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors cursor-pointer">
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
              )}
            </div>
          </div>

          {/* 설정 패널 */}
          <div className="w-full mb-6 p-4 rounded-xl bg-white dark:bg-[#12151C] border border-[#E2E6EE] dark:border-[#232936] flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <label className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] whitespace-nowrap">
                복원 모델
              </label>
              <select 
                value={model} 
                onChange={(e) => setModel(e.target.value as UpscaleModel)}
                className="rounded-lg bg-[#F8F9FB] dark:bg-[#181C26] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] text-xs font-medium p-2.5 min-w-[220px] outline-none focus:border-[#2563EB]"
              >
                <option value="realesrgan-x4plus">일반 사진/문서 (RealESRGAN, 권장)</option>
                <option value="realesrgan-x4plus-anime">일러스트/애니 (Anime)</option>
                <option value="realesr-animevideov3">고속/애니메이션 (AnimeVideo v3)</option>
              </select>
            </div>
            
            <button onClick={handleUpscale} disabled={isProcessing}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold disabled:opacity-50 transition-colors w-full sm:w-auto cursor-pointer">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
              {isProcessing ? "처리 중..." : "2배 업스케일링 실행"}
            </button>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 원본 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] flex justify-between items-center">
                <span>원본 이미지</span>
                {originalSize.w > 0 && (
                  <span className="font-mono text-xs text-[#0F141C] dark:text-[#F3F5F8]">{originalSize.w} × {originalSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#0F141C] dark:text-[#F3F5F8] flex justify-between items-center">
                <span>2배 확대 결과</span>
                {resultSize.w > 0 && (
                  <span className="font-mono text-xs text-[#2563EB] dark:text-[#3B82F6]">{resultSize.w} × {resultSize.h}px (2x)</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mb-3" />
                    <p className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8]">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#697586] text-xs">{progress || "업스케일링을 실행하세요"}</p>
                )}
              </div>
            </div>
          </div>

          {/* 완료 메시지 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 rounded-xl bg-white dark:bg-[#12151C] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] px-4 py-3 text-xs font-medium">
              업스케일링 완료 ({originalSize.w}×{originalSize.h} &rarr; {resultSize.w}×{resultSize.h}). 상단 <strong>다운로드</strong> 버튼으로 고해상도 이미지를 저장하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
