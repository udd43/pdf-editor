"use client";

import React, { useRef, useState } from "react";
import { ZoomIn, Download, Loader2, Upload, RotateCcw } from "lucide-react";

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
      const formData = new FormData();
      formData.append("image", originalFile);
      formData.append("scale", "2");
      formData.append("noise", "-1");

      setProgress("Real-ESRGAN 초고속 모델 불러오는 중... (최대 10~30초 소요)");

      const res = await fetch("/api/upscale", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업스케일링 실패");
      }

      const blob = await res.blob();
      const resultUrl = URL.createObjectURL(blob);
      setResultSrc(resultUrl);

      // 결과 크기 측정
      const img = new Image();
      img.onload = () => setResultSize({ w: img.width, h: img.height });
      img.src = resultUrl;

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
    <div className={`flex flex-col items-center w-full max-w-4xl mx-auto px-4 ${!originalSrc ? "flex-1 justify-center py-12" : "py-8"}`}>
      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-4xl min-h-[400px] sm:min-h-[500px] p-12 sm:p-20 border border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm relative overflow-hidden group"
        >
          <div className="w-24 h-24 mb-8 rounded-3xl bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <ZoomIn className="w-12 h-12 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>이미지를 업로드하세요</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base text-center mb-10">Real-ESRGAN AI로 빠른 고품질 2배 해상도 업스케일링</p>
          <button className="px-8 py-3.5 bg-blue-600 text-white rounded-full font-semibold text-base shadow-sm hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 gap-3 shadow-sm transition-colors">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-xs px-2" style={{ fontFamily: "Inter, sans-serif" }}>
              📷 {fileName}
            </h3>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm">
                <RotateCcw className="w-3.5 h-3.5" /> 다시하기
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm">
                <Upload className="w-3.5 h-3.5" /> 다른 이미지
              </button>
              {resultSrc && (
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95">
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
              )}
            </div>
          </div>

          {/* 설정 패널 */}
          <div className="w-full mb-6 flex justify-center">
            <button onClick={handleUpscale} disabled={isProcessing}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-sm hover:bg-blue-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
              {isProcessing ? "처리 중..." : "2배 업스케일링 시작"}
            </button>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 원본 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>📷 원본</span>
                {originalSize.w > 0 && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-mono bg-white dark:bg-gray-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-600">{originalSize.w} × {originalSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300 flex justify-between items-center">
                <span>🔍 업스케일 결과</span>
                {resultSize.w > 0 && (
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">{resultSize.w} × {resultSize.h}px (2x)</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm animate-in fade-in duration-300" />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{progress || "업스케일링을 시작하세요"}</p>
                )}
              </div>
            </div>
          </div>

          {/* 완료 메시지 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-3.5 rounded-xl text-xs font-semibold text-center">
              ✨ 업스케일링 완료! ({originalSize.w}×{originalSize.h} → {resultSize.w}×{resultSize.h}) <strong>다운로드</strong>로 저장하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
