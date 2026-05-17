"use client";

import React, { useRef, useState } from "react";
import { ZoomIn, Download, Loader2, Upload, RotateCcw, Settings } from "lucide-react";

export default function ImageUpscaler() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState("");
  const [fileName, setFileName] = useState("");
  const [scale, setScale] = useState(2);
  const [noise, setNoise] = useState(1);
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
      formData.append("scale", String(scale));
      formData.append("noise", String(noise));

      setProgress("waifu2x로 업스케일링 중... (최대 2분 소요)");

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
    link.download = `${fileName || "image"}_${scale}x.png`;
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
    <div className={`flex flex-col items-center w-full max-w-4xl mx-auto px-4 ${!originalSrc ? "flex-1 justify-center" : "py-8"}`}>
      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-2xl p-16 border-4 border-dashed border-indigo-300 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 hover:border-indigo-400 transition-all cursor-pointer flex flex-col items-center justify-center"
        >
          <ZoomIn className="w-16 h-16 text-indigo-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">이미지를 업로드하세요</h3>
          <p className="text-gray-500 mb-6">waifu2x AI로 고품질 업스케일링</p>
          <button className="px-6 py-2.5 bg-indigo-500 text-white rounded-lg shadow hover:bg-indigo-600 transition-colors font-medium">
            <Upload className="w-4 h-4 inline mr-2" />
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-xl shadow-sm border gap-3">
            <h3 className="text-lg font-bold text-gray-800 truncate max-w-xs">{fileName}</h3>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200">
                <RotateCcw className="w-4 h-4" /> 다시하기
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100">
                <Upload className="w-4 h-4" /> 다른 이미지
              </button>
              {resultSrc && (
                <button onClick={handleDownload}
                  className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700">
                  <Download className="w-4 h-4" /> 다운로드
                </button>
              )}
            </div>
          </div>

          {/* 설정 패널 */}
          <div className="w-full mb-6 bg-white p-4 rounded-xl shadow-sm border">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium text-gray-700">
              <Settings className="w-4 h-4" /> 업스케일링 설정
            </div>
            <div className="flex flex-wrap gap-6">
              {/* 배율 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">배율</label>
                <div className="flex gap-1">
                  {[2, 4].map((s) => (
                    <button key={s} onClick={() => setScale(s)}
                      className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        scale === s ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}>
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
              {/* 노이즈 제거 */}
              <div>
                <label className="text-xs text-gray-500 mb-1 block">노이즈 제거</label>
                <div className="flex gap-1">
                  {[-1, 0, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setNoise(n)}
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        noise === n ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}>
                      {n === -1 ? "없음" : n}
                    </button>
                  ))}
                </div>
              </div>
              {/* 실행 버튼 */}
              <div className="flex items-end">
                <button onClick={handleUpscale} disabled={isProcessing}
                  className="flex items-center gap-2 px-6 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg shadow hover:bg-indigo-700 disabled:opacity-50">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
                  {isProcessing ? "처리 중..." : "업스케일링 시작"}
                </button>
              </div>
            </div>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 원본 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600 flex justify-between">
                <span>📷 원본</span>
                {originalSize.w > 0 && (
                  <span className="text-xs text-gray-400">{originalSize.w} × {originalSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[300px] bg-gray-50">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[500px] object-contain rounded" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b text-sm font-medium text-gray-600 flex justify-between">
                <span>🔍 업스케일 결과</span>
                {resultSize.w > 0 && (
                  <span className="text-xs text-green-600 font-semibold">{resultSize.w} × {resultSize.h}px</span>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[300px] bg-gray-50">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
                    <p className="text-sm font-medium text-gray-600">{progress}</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[500px] object-contain rounded" />
                ) : (
                  <p className="text-gray-400 text-sm">{progress || "설정 후 업스케일링을 시작하세요"}</p>
                )}
              </div>
            </div>
          </div>

          {/* 완료 메시지 */}
          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm font-medium text-center">
              ✅ 업스케일링 완료! ({originalSize.w}×{originalSize.h} → {resultSize.w}×{resultSize.h}) <strong>다운로드</strong>로 저장하세요.
            </div>
          )}
        </>
      )}
    </div>
  );
}
