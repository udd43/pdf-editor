

import React, { useRef, useState } from "react";
import { Palette, Download, Loader2, Upload, RotateCcw } from "lucide-react";
import { saveFile } from "@/lib/saveFile";

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

  const handleDownload = async () => {
    if (!resultSrc) return;
    try {
      await saveFile(resultSrc, `${fileName || "image"}_색변경.png`, "image/png");
    } catch (err) {
      console.error("저장 실패:", err);
    }
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
      <div className="w-full border-b border-[#E2E6EE] dark:border-[#232936] pb-5 mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            색상 변경 · 인주 교정
          </h1>
          <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1">
            도장 인주 색상 변경, 단색 교체, 틴트 및 오버레이 블렌딩으로 이미지 색조를 정밀하게 제어합니다.
          </p>
        </div>
        <span className="text-xs font-mono text-[#697586] dark:text-[#647087] shrink-0">
          틴트 &middot; 오버레이 &middot; 단색 교체
        </span>
      </div>

      {/* 업로드 영역 */}
      {!originalSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full min-h-[340px] p-10 sm:p-14 rounded-xl border border-dashed border-[#CBD2E0] dark:border-[#333B4D] hover:border-[#2563EB] dark:hover:border-[#3B82F6] bg-white dark:bg-[#12151C] transition-colors cursor-pointer flex flex-col items-center justify-center group"
        >
          <div className="flex items-center gap-2.5 mb-2">
            <Palette className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6]" />
            <h2 className="text-lg font-bold text-[#0F141C] dark:text-[#F3F5F8]">
              색상을 변경할 이미지를 선택하세요
            </h2>
          </div>
          <p className="font-mono text-xs text-[#697586] dark:text-[#647087] text-center mb-6">
            도장, 서명, 아이콘, 일반 이미지 지원
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

          {/* 색상 설정 패널 */}
          <div className="w-full mb-6 bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] p-5 transition-colors">
            <div className="flex flex-wrap gap-6 items-start">
              {/* 색상 선택 */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] mb-3 block">
                  색상 선택
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setSelectedColor(c.hex)}
                      title={c.label}
                      className={`w-7 h-7 rounded-md border-2 transition-transform cursor-pointer ${
                        selectedColor === c.hex
                          ? "border-[#2563EB] scale-110"
                          : "border-[#E2E6EE] dark:border-[#232936]"
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
                      className="w-7 h-7 rounded-md border border-[#E2E6EE] cursor-pointer overflow-hidden opacity-0 absolute inset-0"
                      title="사용자 지정 색상"
                    />
                    <div className="w-7 h-7 rounded-md border border-dashed border-[#697586] bg-[#F1F3F7] dark:bg-[#181C26] flex items-center justify-center text-[#0F141C] dark:text-[#F3F5F8] text-xs font-mono font-bold pointer-events-none">
                      +
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-xs border border-[#E2E6EE] dark:border-[#232936]" style={{ backgroundColor: selectedColor }} />
                  <span className="text-xs font-mono text-[#4B5565] dark:text-[#94A0B8]">{selectedColor.toUpperCase()}</span>
                </div>
              </div>

              {/* 적용 모드 */}
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] mb-3 block">
                  적용 방식
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
                      className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                        mode === m.value
                          ? "bg-[#2563EB] border-[#2563EB] text-white font-semibold"
                          : "bg-[#F8F9FB] dark:bg-[#181C26] border-[#E2E6EE] dark:border-[#232936] text-[#4B5565] dark:text-[#94A0B8] hover:border-[#2563EB]"
                      }`}
                    >
                      <span className="font-semibold">{m.label}</span>
                      <span className="ml-2 text-xs opacity-80">{m.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 강도 슬라이더 */}
              <div className="flex-1 min-w-[160px]">
                <label className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] mb-3 block">
                  색상 농도: <span className="text-[#2563EB] dark:text-[#3B82F6]">{opacity}%</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={100}
                  value={opacity}
                  onChange={(e) => setOpacity(Number(e.target.value))}
                  className="w-full accent-[#2563EB]"
                />
                <div className="flex justify-between font-mono text-xs text-[#697586] mt-1">
                  <span>5%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            {/* 적용 버튼 */}
            <div className="flex justify-end mt-5 pt-4 border-t border-[#E2E6EE] dark:border-[#232936]">
              <button
                onClick={handleApply}
                disabled={isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold disabled:opacity-50 transition-colors cursor-pointer"
              >
                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                {isProcessing ? "적용 중..." : "색상 교정 적용"}
              </button>
            </div>
          </div>

          {/* 비교 뷰 */}
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 원본 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8]">
                원본 이미지
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                <img src={originalSrc} alt="원본" className="max-w-full max-h-[450px] object-contain" />
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white dark:bg-[#12151C] rounded-xl border border-[#E2E6EE] dark:border-[#232936] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F1F3F7] dark:bg-[#181C26] border-b border-[#E2E6EE] dark:border-[#232936] text-xs font-semibold text-[#0F141C] dark:text-[#F3F5F8] flex justify-between items-center">
                <span>색상 교정 결과</span>
                {resultSrc && (
                  <div className="w-3.5 h-3.5 rounded-xs border border-[#CBD2E0]" style={{ backgroundColor: selectedColor }} />
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[350px]">
                {isProcessing ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="w-8 h-8 text-[#2563EB] animate-spin mb-3" />
                    <p className="text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8]">처리 중...</p>
                  </div>
                ) : resultSrc ? (
                  <img src={resultSrc} alt="결과" className="max-w-full max-h-[450px] object-contain" />
                ) : (
                  <p className="text-[#697586] text-xs text-center">
                    색상을 선택하고 [색상 교정 적용]을 누르세요
                  </p>
                )}
              </div>
            </div>
          </div>

          {resultSrc && !isProcessing && (
            <div className="w-full mt-4 rounded-xl bg-white dark:bg-[#12151C] border border-[#E2E6EE] dark:border-[#232936] text-[#0F141C] dark:text-[#F3F5F8] px-4 py-3 text-xs font-medium">
              색상 교정이 완료되었습니다. 상단 <strong>다운로드</strong> 버튼으로 PNG 이미지를 저장하거나 농도를 다시 조절해 재적용할 수 있습니다.
            </div>
          )}
        </>
      )}
    </div>
  );
}
