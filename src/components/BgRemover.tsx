"use client";

import React, { useRef, useState } from "react";
import { Scissors, Download, Loader2, Upload, RotateCcw } from "lucide-react";
import ColorPicker from "./ColorPicker";

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

    setFileName(file.name.replace(/\.[^.]+$/, ""));
    const dataUrl = URL.createObjectURL(file);
    setOriginalSrc(dataUrl);
    setResultSrc(null);

    // 바로 배경 제거 시작
    setIsProcessing(true);
    setProgress("AI 모델을 불러오는 중...");

    try {
      const { removeBackground } = await import("@imgly/background-removal");
      setProgress("배경을 분석하는 중...");
      const resultBlob = await removeBackground(file, {
        output: { format: "image/png" as const },
      });
      const resultUrl = URL.createObjectURL(resultBlob);
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
    setOriginalSrc(null);
    setResultSrc(null);
    setProgress("");
    setFileName("");
  };

  return (
    <div className={`flex flex-col items-center w-full max-w-4xl mx-auto px-4 ${!originalSrc ? "flex-1 justify-center py-12" : "py-8"}`}>
      {/* 업로드 영역 (이미지 없을 때) */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-xl p-12 border border-white/10 rounded-3xl bg-slate-950/30 hover:border-white/20 hover:bg-slate-950/40 backdrop-blur-xl transition-all cursor-pointer flex flex-col items-center justify-center shadow-2xl relative overflow-hidden group"
        >
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-pink-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="w-16 h-16 mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Scissors className="w-8 h-8 text-pink-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2 text-center group-hover:text-pink-200 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>이미지를 업로드하세요</h3>
          <p className="text-slate-400 text-xs sm:text-sm text-center mb-8">AI가 자동으로 배경을 감지하여 제거합니다</p>
          <button className="px-8 py-3 bg-white text-slate-950 rounded-full font-bold text-sm shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:bg-slate-100 hover:shadow-[0_4px_25px_rgba(255,255,255,0.25)] transition-all duration-300 hover:scale-105 active:scale-98">
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* 결과 영역 */}
      {originalSrc && (
        <>
          {/* 상단 도구 바 (글래스모피즘) */}
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
                <>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/5 border border-white/10 text-slate-200 text-xs font-semibold rounded-full hover:bg-white/10 transition-all">
                    🎨 색상 변경
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 text-white text-xs font-bold rounded-full shadow-[0_4px_15px_rgba(236,72,153,0.25)] hover:shadow-[0_4px_20px_rgba(236,72,153,0.4)] transition-all hover:scale-103 active:scale-97">
                    <Download className="w-3.5 h-3.5" /> 다운로드
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
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 원본 */}
            <div className="bg-slate-950/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-white/5 text-xs font-bold text-slate-400">📷 원본 이미지</div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-md" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-slate-950/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-xl">
              <div className="px-4 py-2.5 bg-slate-900/90 border-b border-white/5 text-xs font-bold text-slate-400">✂️ 누끼 결과</div>
              <div className="p-4 flex items-center justify-center min-h-[350px] relative"
                style={{ 
                  backgroundImage: "linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.03) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(255,255,255,0.03) 75%), linear-gradient(-45deg, transparent 75%, rgba(255,255,255,0.03) 75%)", 
                  backgroundSize: "20px 20px", 
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px" 
                }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-pink-500 animate-spin mb-4" />
                    <p className="text-xs font-semibold text-slate-400">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-slate-500 text-xs">{progress || "처리 대기 중..."}</p>
                )}
              </div>
            </div>
          </div>

          {/* 다운로드 안내 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-pink-950/20 border border-pink-500/30 text-pink-200 px-4 py-3.5 rounded-xl text-xs font-semibold text-center">
              ✨ 배경 제거 완료! <strong>다운로드</strong> 버튼으로 PNG 파일을 저장하세요. 🎨 배경 색상 변경도 가능합니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
