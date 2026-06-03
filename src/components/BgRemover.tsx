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
    const originalDataUrl = URL.createObjectURL(file);
    setOriginalSrc(originalDataUrl);
    setResultSrc(null);

    setIsProcessing(true);
    setProgress("AI 모델 불러오는 중...");

    try {
      // 1. 원본 이미지 로드
      const img = new Image();
      img.src = originalDataUrl;
      await new Promise((resolve) => (img.onload = resolve));

      // 2. AI 처리를 위한 리사이징 (최대 800px로 축소하여 속도 5배 향상)
      const MAX_SIZE = 800;
      let width = img.width;
      let height = img.height;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const smallCanvas = document.createElement("canvas");
      smallCanvas.width = width;
      smallCanvas.height = height;
      const smallCtx = smallCanvas.getContext("2d");
      if (!smallCtx) throw new Error("Canvas context failed");
      smallCtx.drawImage(img, 0, 0, width, height);

      const smallBlob = await new Promise<Blob>((resolve) => 
        smallCanvas.toBlob((b) => resolve(b!), "image/png")
      );

      // 3. 축소된 이미지로 AI 누끼따기 (초고속 연산)
      const { removeBackground } = await import("@imgly/background-removal");
      setProgress("초고속 배경 분석 중...");
      
      const smallResultBlob = await removeBackground(smallBlob, {
        model: "isnet_quint8",
        output: { format: "image/png" as const },
        debug: false,
      });

      // 4. 결과 마스크 로드
      const maskImg = new Image();
      maskImg.src = URL.createObjectURL(smallResultBlob);
      await new Promise((resolve) => (maskImg.onload = resolve));

      // 5. 원본 해상도 캔버스에 마스크 덧씌우기 (High-res 복원)
      const finalCanvas = document.createElement("canvas");
      finalCanvas.width = img.width;
      finalCanvas.height = img.height;
      const finalCtx = finalCanvas.getContext("2d");
      if (!finalCtx) throw new Error("Canvas context failed");

      // 원본 그리기
      finalCtx.drawImage(img, 0, 0);
      // 마스크 씌우기 (투명도 적용)
      finalCtx.globalCompositeOperation = "destination-in";
      finalCtx.drawImage(maskImg, 0, 0, img.width, img.height);

      // 6. 최종 고해상도 누끼 결과 반환
      const finalUrl = finalCanvas.toDataURL("image/png");
      setResultSrc(finalUrl);
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
          className="w-full max-w-4xl min-h-[400px] sm:min-h-[500px] p-12 sm:p-20 border border-gray-200 dark:border-gray-700 rounded-3xl bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm relative overflow-hidden group"
        >
          <div className="w-24 h-24 mb-8 rounded-3xl bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Scissors className="w-12 h-12 text-blue-500 dark:text-blue-400" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-10 text-center transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>이미지를 업로드하세요</h3>
          <button className="px-8 py-3.5 bg-blue-600 text-white rounded-full font-semibold text-base shadow-sm hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* 결과 영역 */}
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
                <>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-full hover:bg-gray-50 dark:hover:bg-gray-600 transition-all shadow-sm">
                    🎨 색상 변경
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95">
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
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300">📷 원본 이미지</div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm transition-colors">
              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 text-xs font-bold text-gray-700 dark:text-gray-300">✂️ 누끼 결과</div>
              <div className="p-4 flex items-center justify-center min-h-[350px] relative"
                style={{ 
                  backgroundImage: "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)", 
                  backgroundSize: "20px 20px", 
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px" 
                }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{progress || "처리 대기 중..."}</p>
                )}
              </div>
            </div>
          </div>

          {/* 다운로드 안내 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 px-4 py-3.5 rounded-xl text-xs font-semibold text-center">
              ✨ 배경 제거 완료! <strong>다운로드</strong> 버튼으로 PNG 파일을 저장하세요. 🎨 배경 색상 변경도 가능합니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
