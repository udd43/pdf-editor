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
          className="w-full max-w-xl p-12 border border-white/10 rounded-3xl bg-slate-950/30 hover:border-white/20 hover:bg-slate-950/40 backdrop-blur-xl transition-all cursor-pointer flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <ZoomIn className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 text-center group-hover:text-purple-200 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>이미지를 업로드하세요</h3>
          <p className="text-slate-400 text-xs sm:text-sm text-center mb-8">Real-ESRGAN AI로 빠른 고품질 2배 해상도 업스케일링</p>
          <button className="px-8 py-3 bg-white text-slate-950 rounded-full font-bold text-sm shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:bg-slate-100 hover:shadow-[0_4px_25px_rgba(255,255,255,0.25)] transition-all duration-300 hover:scale-105 active:scale-98">
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-slate-950/40 backdrop-blur-xl p-4 rounded-2xl border border-white/10 gap-3 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-200 truncate max-w-xs px-2" style={{ fontFamily: "Outfit, sans-serif" }}>
              📷 {fileName}
            </h3>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-full hover:bg-white/10 transition-all">
                <RotateCcw className="w-3.5 h-3.5" /> 다시하기
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-full hover:bg-white/10 transition-all">
                <Upload className="w-3.5 h-3.5" /> 다른 이미지
              </button>
              {resultSrc && (
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-500 via-indigo-500 to-sky-500 text-white text-xs font-bold rounded-full shadow-[0_4px_15px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_20px_rgba(168,85,247,0.4)] transition-all hover:scale-103 active:scale-97">
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
              )}
            </div>
          </div>

          {/* 설정 패널 */}
          <div className="w-full mb-6 flex justify-center">
            <button onClick={handleUpscale} disabled={isProcessing}
              className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold rounded-full shadow-[0_4px_20px_rgba(168,85,247,0.2)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.35)] hover:scale-103 active:scale-98 disabled:opacity-50 transition-all">
              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
              {isProcessing ? "처리 중..." : "2배 업스케일링 시작"}
            </button>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 원본 */}
            <div className="bg-slate-950/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-white/5 text-xs font-bold text-slate-400 flex justify-between items-center">
                <span>📷 원본</span>
                {originalSize.w > 0 && (
                  <span className="text-[10px] text-slate-500 font-mono bg-white/5 px-2 py-0.5 rounded-full border border-white/5">{originalSize.w} × {originalSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-md" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-slate-950/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-white/5 text-xs font-bold text-slate-400 flex justify-between items-center">
                <span>🔍 업스케일 결과</span>
                {resultSize.w > 0 && (
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/30 px-2 py-0.5 rounded-full border border-emerald-500/20">{resultSize.w} × {resultSize.h}px (2x)</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-purple-500 animate-spin mb-4" />
                    <p className="text-xs font-semibold text-slate-400">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-md animate-in fade-in duration-300" />
                ) : (
                  <p className="text-slate-500 text-xs">{progress || "업스케일링을 시작하세요"}</p>
                )}
              </div>
            </div>
          </div>

          {/* 완료 메시지 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-purple-950/20 border border-purple-500/30 text-purple-200 px-4 py-3.5 rounded-xl text-xs font-semibold text-center">
              ✨ 업스케일링 완료! ({originalSize.w}×{originalSize.h} → {resultSize.w}×{resultSize.h}) <strong>다운로드</strong>로 저장하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
