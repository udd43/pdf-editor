"use client";

import React, { useRef, useState } from "react";
import { Palette, Download, Loader2, Upload, RotateCcw } from "lucide-react";

const PRESET_COLORS = [
  { hex: "#EF4444", label: "빨강" },
  { hex: "#F97316", label: "주황" },
  { hex: "#EAB308", label: "노랑" },
  { hex: "#22C55E", label: "초록" },
  { hex: "#14B8A6", label: "청록" },
  { hex: "#3B82F6", label: "파랑" },
  { hex: "#6366F1", label: "남색" },
  { hex: "#A855F7", label: "보라" },
  { hex: "#EC4899", label: "핑크" },
  { hex: "#F43F5E", label: "장미" },
  { hex: "#000000", label: "검정" },
  { hex: "#FFFFFF", label: "흰색" },
];

export default function ImageColorizer() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [resultSrc, setResultSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [opacity, setOpacity] = useState(70);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<"overlay" | "tint" | "replace">("tint");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setFileName(file.name.replace(/\.[^.]+$/, ""));
    setResultSrc(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setOriginalSrc(dataUrl);

      // 원본 이미지 픽셀 데이터 캐싱
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0);
        setOriginalImageData(ctx.getImageData(0, 0, canvas.width, canvas.height));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const applyColor = (color: string, op: number, applyMode: string, imgData: ImageData) => {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    const t = op / 100;

    // 복사본 만들기
    const newData = new ImageData(
      new Uint8ClampedArray(imgData.data),
      imgData.width,
      imgData.height
    );
    const data = newData.data;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 10) continue; // 투명 픽셀 건너뜀

      if (applyMode === "overlay") {
        // 색상 오버레이: 원본 밝기를 일부 유지하며 색 블렌딩
        data[i]     = Math.round(data[i]     * (1 - t) + r * t);
        data[i + 1] = Math.round(data[i + 1] * (1 - t) + g * t);
        data[i + 2] = Math.round(data[i + 2] * (1 - t) + b * t);
      } else if (applyMode === "tint") {
        // 틴트: 픽셀의 밝기를 계산하여 선택 색상에 적용
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        data[i]     = Math.round(r * brightness * t + data[i]     * (1 - t));
        data[i + 1] = Math.round(g * brightness * t + data[i + 1] * (1 - t));
        data[i + 2] = Math.round(b * brightness * t + data[i + 2] * (1 - t));
      } else if (applyMode === "replace") {
        // 완전 교체: 알파 유지하고 색상만 바꿈
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        data[i]     = Math.round(r * brightness);
        data[i + 1] = Math.round(g * brightness);
        data[i + 2] = Math.round(b * brightness);
      }
    }

    return newData;
  };

  const handleApply = () => {
    if (!originalImageData || !originalSrc) return;
    setIsProcessing(true);

    // setTimeout으로 UI 업데이트 선행
    setTimeout(() => {
      const newData = applyColor(selectedColor, opacity, mode, originalImageData);
      const canvas = document.createElement("canvas");
      canvas.width = newData.width;
      canvas.height = newData.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { setIsProcessing(false); return; }
      ctx.putImageData(newData, 0, 0);
      setResultSrc(canvas.toDataURL("image/png"));
      setIsProcessing(false);
    }, 30);
  };

  const handleDownload = () => {
    if (!resultSrc) return;
    const link = document.createElement("a");
    link.href = resultSrc;
    link.download = `${fileName || "image"}_색변경.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleReset = () => {
    setOriginalSrc(null);
    setOriginalImageData(null);
    setResultSrc(null);
    setFileName("");
    setSelectedColor("#3B82F6");
    setOpacity(70);
    setMode("tint");
  };

  return (
    <div className={`flex flex-col items-center w-full max-w-4xl mx-auto px-4 ${!originalSrc ? "flex-1 justify-center py-12" : "py-8"}`}>
      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-4xl min-h-[400px] sm:min-h-[500px] p-12 sm:p-20 border border-gray-200 rounded-3xl bg-white hover:border-gray-300 hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm relative overflow-hidden group"
        >
          <div className="w-24 h-24 mb-8 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Palette className="w-12 h-12 text-blue-500" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center" style={{ fontFamily: "Inter, sans-serif" }}>
            이미지를 업로드하세요
          </h3>
          <p className="text-gray-500 text-sm sm:text-base text-center mb-10">
            이미지의 색상을 원하는 대로 바꿔드립니다
          </p>
          <button className="px-8 py-3.5 bg-blue-600 text-white rounded-full font-semibold text-base shadow-sm hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">
            이미지 선택
          </button>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />

      {originalSrc && (
        <>
          {/* 상단 도구 바 */}
          <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-gray-200 gap-3 shadow-sm">
            <h3 className="text-sm font-bold text-gray-900 truncate max-w-xs px-2" style={{ fontFamily: "Inter, sans-serif" }}>
              🎨 {fileName}
            </h3>
            <div className="flex gap-2 flex-wrap items-center">
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 transition-all shadow-sm">
                <RotateCcw className="w-3.5 h-3.5" /> 다시하기
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 transition-all shadow-sm">
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

          {/* 색상 설정 패널 */}
          <div className="w-full mb-6 bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
            <div className="flex flex-wrap gap-6 items-start">
              {/* 색상 선택 */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-gray-600 mb-3 block">🎨 색상 선택</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.label}
                      className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                        selectedColor === c.hex
                          ? "border-blue-500 scale-110 shadow-md"
                          : "border-gray-200"
                      }`}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                  {/* 커스텀 색상 */}
                  <div className="relative">
                    <input
                      type="color"
                      value={selectedColor}
                      onChange={(e) => setSelectedColor(e.target.value)}
                      className="w-7 h-7 rounded-full border-2 border-gray-200 cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                      title="사용자 지정 색상"
                    />
                    <div
                      className="w-7 h-7 rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center text-gray-500 text-[10px] font-bold pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, #EF4444 0%, #3B82F6 50%, #22C55E 100%)`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: selectedColor }} />
                  <span className="text-xs font-mono text-gray-500">{selectedColor.toUpperCase()}</span>
                </div>
              </div>

              {/* 적용 모드 */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-gray-600 mb-3 block">⚙️ 적용 방식</label>
                <div className="flex flex-col gap-1.5">
                  {([
                    { value: "tint", label: "틴트", desc: "밝기 유지하며 색상 입히기" },
                    { value: "overlay", label: "오버레이", desc: "원본 색상과 블렌딩" },
                    { value: "replace", label: "완전 교체", desc: "색상을 완전히 대체" },
                  ] as const).map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-all ${
                        mode === m.value
                          ? "bg-blue-50 border-blue-200 text-blue-700 font-semibold"
                          : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="ml-2 text-[10px] opacity-70">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 강도 슬라이더 */}
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-semibold text-gray-600 mb-3 block">
                  💪 색상 강도: <span className="text-blue-600">{opacity}%</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-blue-600"
                />
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>연하게</span>
                  <span>진하게</span>
                </div>
              </div>
            </div>

            {/* 적용 버튼 */}
            <div className="flex justify-center mt-5">
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white text-sm font-semibold rounded-full shadow-sm hover:bg-blue-700 hover:scale-[1.02] active:scale-95 disabled:opacity-50 transition-all"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {isProcessing ? "적용 중..." : "색상 적용하기"}
              </button>
            </div>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 원본 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700">
                📷 원본 이미지
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]"
                style={{
                  backgroundImage: "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}>
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 flex justify-between items-center">
                <span>🎨 색상 변경 결과</span>
                {resultSrc && (
                  <div className="w-4 h-4 rounded-full border border-gray-300" style={{ backgroundColor: selectedColor }} />
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]"
                style={{
                  backgroundImage: "linear-gradient(45deg, #f3f4f6 25%, transparent 25%), linear-gradient(-45deg, #f3f4f6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f3f4f6 75%), linear-gradient(-45deg, transparent 75%, #f3f4f6 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-4" />
                    <p className="text-xs font-semibold text-gray-600">색상을 적용하는 중...</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain rounded-xl shadow-sm" />
                ) : (
                  <p className="text-gray-400 text-sm text-center">
                    색상을 선택하고<br />
                    <span className="font-semibold text-blue-500">'색상 적용하기'</span>를 클릭하세요
                  </p>
                )}
              </div>
            </div>
          </div>

          {resultSrc && !isProcessing && (
            <div className="w-full mt-6 bg-blue-50 border border-blue-200 text-blue-800 px-4 py-3.5 rounded-xl text-xs font-semibold text-center">
              ✨ 색상 변경 완료! <strong>다운로드</strong>로 PNG 파일을 저장하거나, 색상을 다시 조절해 재적용할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
