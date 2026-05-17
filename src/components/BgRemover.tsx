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
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto py-8 px-4">
      {/* 업로드 영역 (이미지 없을 때) */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-2xl p-16 border-4 border-dashed border-amber-300 rounded-2xl bg-amber-50/50 hover:bg-amber-50 hover:border-amber-400 transition-all cursor-pointer flex flex-col items-center justify-center"
        >
          <Scissors className="w-16 h-16 text-amber-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">이미지를 업로드하세요</h3>
          <p className="text-gray-500 mb-6">AI가 자동으로 배경을 제거합니다</p>
          <button className="px-6 py-2.5 bg-amber-500 text-white rounded-lg shadow hover:bg-amber-600 transition-colors font-medium">
            <Upload className="w-4 h-4 inline mr-2" />
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {/* 결과 영역 */}
      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-3">
            <h3 className="text-lg font-bold text-gray-800 truncate max-w-xs">{fileName}</h3>
            <div className="flex gap-2 flex-wrap">
              <button onClick={handleReset}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                <RotateCcw className="w-4 h-4" /> 다시하기
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100">
                <Upload className="w-4 h-4" /> 다른 이미지
              </button>
              {resultSrc && (
                <>
                  <button onClick={() => setShowColorPicker(!showColorPicker)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100">
                    🎨 색상 변경
                  </button>
                  <button onClick={handleDownload}
                    className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700">
                    <Download className="w-4 h-4" /> 다운로드
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
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600">📷 원본</div>
              <div className="p-4 flex items-center justify-center min-h-[300px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[500px] object-contain rounded" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600">✂️ 누끼 결과</div>
              <div className="p-4 flex items-center justify-center min-h-[300px]"
                style={{ backgroundImage: "linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)", backgroundSize: "20px 20px", backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px" }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-amber-500 animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-600">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[500px] object-contain" />
                ) : (
                  <p className="text-gray-400 text-sm">{progress || "처리 대기 중..."}</p>
                )}
              </div>
            </div>
          </div>

          {/* 다운로드 안내 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm font-medium text-center">
              ✅ 배경 제거 완료! <strong>다운로드</strong> 버튼으로 PNG 파일을 저장하세요. 🎨 색상 변경도 가능합니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
