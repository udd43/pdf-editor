

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
        data[i]     = Math.round(data[i]     * (1 - t) + r * t);
        data[i + 1] = Math.round(data[i + 1] * (1 - t) + g * t);
        data[i + 2] = Math.round(data[i + 2] * (1 - t) + b * t);
      } else if (applyMode === "tint") {
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        data[i]     = Math.round(r * brightness * t + data[i]     * (1 - t));
        data[i + 1] = Math.round(g * brightness * t + data[i + 1] * (1 - t));
        data[i + 2] = Math.round(b * brightness * t + data[i + 2] * (1 - t));
      } else if (applyMode === "replace") {
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
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto px-4 py-6">
      <div className="w-full border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-[#C83E2B] dark:text-[#E05A47] font-bold block mb-1">
            STATION 07 &middot; INK &amp; TINT COLOR GRADING
          </span>
          <h1 className="font-editorial text-2xl sm:text-3xl font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
            색상 변경 · 인주 교정
          </h1>
        </div>
        <p className="text-xs text-[#57534E] dark:text-[#A6A096] max-w-sm sm:text-right">
          도장 인주 색상 변경, 단색 교체, 틴트 및 오버레이 블렌딩으로 이미지 색조를 정밀하게 제어합니다.
        </p>
      </div>

      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[360px] p-10 sm:p-14 border border-dashed border-[#BFB7A6] dark:border-[#3A3834] hover:border-[#161514] dark:hover:border-[#F2EFE9] bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="w-14 h-14 mb-5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] group-hover:text-[#C83E2B] flex items-center justify-center transition-colors">
            <Palette className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-[#161514] dark:text-[#F2EFE9] mb-1 text-center">
            색상을 변경할 이미지를 선택하세요
          </h3>
          <p className="font-mono text-xs text-[#8A847C] dark:text-[#6E6A63] text-center mb-6">
            MODES: TINT / OVERLAY / SOLID REPLACE
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

          {/* 색상 설정 패널 */}
          <div className="w-full mb-6 bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] p-5 transition-colors">
            <div className="flex flex-wrap gap-6 items-start">
              {/* 색상 선택 */}
              <div className="flex-1 min-w-[200px]">
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] mb-3 block">
                  01 / INK SWATCH &middot; 색상 선택
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.label}
                      className={`w-7 h-7 border-2 transition-transform cursor-pointer ${
                        selectedColor === c.hex
                          ? "border-[#161514] dark:border-[#F2EFE9] scale-110"
                          : "border-[#DCD6C8] dark:border-[#2C2B28]"
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
                      className="w-7 h-7 border border-[#DCD6C8] cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                      title="사용자 지정 색상"
                    />
                    <div
                      className="w-7 h-7 border border-dashed border-[#8A847C] flex items-center justify-center text-[#161514] text-[10px] font-mono font-bold pointer-events-none"
                      style={{
                        background: `linear-gradient(135deg, #C83E2B 0%, #161514 50%, #D97706 100%)`,
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border border-[#DCD6C8] dark:border-[#2C2B28]" style={{ backgroundColor: selectedColor }} />
                  <span className="text-xs font-mono text-[#57534E] dark:text-[#A6A096]">{selectedColor.toUpperCase()}</span>
                </div>
              </div>

              {/* 적용 모드 */}
              <div className="flex-1 min-w-[200px]">
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] mb-3 block">
                  02 / BLEND MODE &middot; 적용 방식
                </label>
                <div className="flex flex-col gap-1.5">
                  {([
                    { value: "tint", label: "틴트", desc: "명암 유지하며 색상 입히기" },
                    { value: "overlay", label: "오버레이", desc: "원본 색상과 블렌딩" },
                    { value: "replace", label: "완전 교체", desc: "단색 인주 효과로 대체" },
                  ] as const).map((m) => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`text-left px-3 py-2 border text-xs transition-colors cursor-pointer ${
                        mode === m.value
                          ? "bg-[#161514] dark:bg-[#F2EFE9] border-[#161514] dark:border-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514] font-bold"
                          : "bg-[#F6F3EA] dark:bg-[#121211] border-[#DCD6C8] dark:border-[#2C2B28] text-[#57534E] dark:text-[#A6A096] hover:border-[#161514]"
                      }`}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="ml-2 text-[10px] opacity-75">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 강도 슬라이더 */}
              <div className="flex-1 min-w-[160px]">
                <label className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] mb-3 block">
                  03 / DENSITY: <span className="text-[#C83E2B] dark:text-[#E05A47]">{opacity}%</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-[#C83E2B]"
                />
                <div className="flex justify-between font-mono text-[10px] text-[#8A847C] mt-1">
                  <span>5%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* 적용 버튼 */}
            <div className="flex justify-end mt-5 pt-4 border-t border-[#DCD6C8] dark:border-[#2C2B28]">
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#C83E2B] hover:bg-[#B03220] text-white text-xs font-bold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {isProcessing ? "적용 중..." : "색상 교정 적용"}
              </button>
            </div>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
            {/* 원본 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] font-bold text-[#57534E] dark:text-[#A6A096]">
                SOURCE IMAGE &middot; 원본
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]"
                style={{
                  backgroundImage: "linear-gradient(45deg, #e5e0d5 25%, transparent 25%), linear-gradient(-45deg, #e5e0d5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e0d5 75%), linear-gradient(-45deg, transparent 75%, #e5e0d5 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}>
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#EFECE2] dark:bg-[#22211F] border-b border-[#DCD6C8] dark:border-[#2C2B28] font-mono text-[11px] font-bold text-[#161514] dark:text-[#F2EFE9] flex justify-between items-center">
                <span>GRADED OUTPUT &middot; 교정 결과</span>
                {resultSrc && (
                  <div className="w-3.5 h-3.5 border border-[#161514] dark:border-[#F2EFE9]" style={{ backgroundColor: selectedColor }} />
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]"
                style={{
                  backgroundImage: "linear-gradient(45deg, #e5e0d5 25%, transparent 25%), linear-gradient(-45deg, #e5e0d5 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e0d5 75%), linear-gradient(-45deg, transparent 75%, #e5e0d5 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                }}>
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#C83E2B] animate-spin mb-3" />
                    <p className="text-xs font-mono font-semibold text-[#57534E] dark:text-[#A6A096]">PROCESSING...</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#8A847C] text-xs font-mono text-center">
                    SELECT SWATCH &amp; CLICK [색상 교정 적용]
                  </p>
                )}
              </div>
            </div>
          </div>

          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] border-l-4 border-l-[#C83E2B] text-[#161514] dark:text-[#F2EFE9] px-4 py-3 text-xs font-medium">
              색상 교정이 완료되었습니다. 상단 <strong>다운로드</strong> 버튼으로 PNG 이미지를 저장하거나 농도를 다시 조절해 재적용할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
