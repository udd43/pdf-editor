import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Eraser,
  Download,
  RotateCcw,
  Sparkles,
  Upload,
  Eye,
  FileText,
  Undo2,
  Trash2,
  Loader2,
  Sliders,
} from "lucide-react";
import toast from "react-hot-toast";
import { runInpainting } from "@/lib/inpaintEngine";
import { useAppStore } from "@/stores/appStore";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";

export default function MagicEraser() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);
  const cursorCanvasRef = useRef<HTMLCanvasElement>(null);

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [fileName, setFileName] = useState("document");
  const [brushSize, setBrushSize] = useState(28);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStatus, setProgressStatus] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [hasMask, setHasMask] = useState(false);
  const [isComparing, setIsComparing] = useState(false);

  // History stack for Undo
  const historyRef = useRef<ImageData[]>([]);
  const maskHistoryRef = useRef<ImageData[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const openPdfEditor = useAppStore((state) => state.openPdfEditor);

  // Initialize and draw base image onto canvas
  const loadImageToCanvas = useCallback((src: string, isOriginalUpload = false) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const cursorCanvas = cursorCanvasRef.current;
      if (!imgCanvas || !maskCanvas || !cursorCanvas) return;

      const w = img.width;
      const h = img.height;

      imgCanvas.width = w;
      imgCanvas.height = h;
      maskCanvas.width = w;
      maskCanvas.height = h;
      cursorCanvas.width = w;
      cursorCanvas.height = h;

      const imgCtx = imgCanvas.getContext("2d");
      if (!imgCtx) return;
      imgCtx.drawImage(img, 0, 0);

      // Clear mask
      const maskCtx = maskCanvas.getContext("2d");
      maskCtx?.clearRect(0, 0, w, h);
      setHasMask(false);

      if (isOriginalUpload) {
        historyRef.current = [imgCtx.getImageData(0, 0, w, h)];
        setCanUndo(false);
      }
    };
    img.src = src;
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const nameWithoutExt = file.name.replace(/\.[^.]+$/, "");
    setFileName(nameWithoutExt);

    // If PDF, render 1st page to image
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const toastId = toast.loading("PDF 첫 페이지를 불러오는 중...");
      try {
        const buffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas context creation failed");

        await page.render({ canvasContext: ctx, viewport }).promise;
        const dataUrl = canvas.toDataURL("image/png");

        setOriginalSrc(dataUrl);
        setImageSrc(dataUrl);
        loadImageToCanvas(dataUrl, true);
        toast.success("PDF 페이지를 불러왔습니다!", { id: toastId });
        return;
      } catch (err: any) {
        console.error("PDF 렌더 실패:", err);
        toast.error("PDF를 불러오는 데 실패했습니다.", { id: toastId });
        return;
      }
    }

    // Normal Image
    const url = URL.createObjectURL(file);
    setOriginalSrc(url);
    setImageSrc(url);
    loadImageToCanvas(url, true);
  };

  // Convert mouse/touch event coordinates to Canvas coordinates
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return { x: 0, y: 0 };

    const rect = maskCanvas.getBoundingClientRect();
    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;

    let clientX = 0;
    let clientY = 0;

    if ("touches" in e) {
      if (e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      }
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isProcessing) return;
    setIsDrawing(true);
    const pos = getCanvasCoords(e);
    lastPosRef.current = pos;

    // Save mask state for undo
    const maskCanvas = maskCanvasRef.current;
    if (maskCanvas) {
      const ctx = maskCanvas.getContext("2d");
      if (ctx) {
        maskHistoryRef.current.push(ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height));
      }
    }

    draw(e);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    const maskCanvas = maskCanvasRef.current;
    const cursorCanvas = cursorCanvasRef.current;
    if (!maskCanvas || !cursorCanvas) return;

    const pos = getCanvasCoords(e);

    // Update cursor indicator
    const cursorCtx = cursorCanvas.getContext("2d");
    if (cursorCtx) {
      cursorCtx.clearRect(0, 0, cursorCanvas.width, cursorCanvas.height);
      cursorCtx.beginPath();
      cursorCtx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      cursorCtx.fillStyle = "rgba(239, 68, 68, 0.25)";
      cursorCtx.fill();
      cursorCtx.strokeStyle = "rgba(239, 68, 68, 0.8)";
      cursorCtx.lineWidth = Math.max(1, maskCanvas.width / 500);
      cursorCtx.stroke();
    }

    if (!isDrawing) return;

    const ctx = maskCanvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(239, 68, 68, 0.55)";
    ctx.fillStyle = "rgba(239, 68, 68, 0.55)";
    ctx.lineWidth = brushSize;

    if (!lastPosRef.current) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, brushSize / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }

    lastPosRef.current = pos;
    setHasMask(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPosRef.current = null;
  };

  const handleClearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext("2d");
    ctx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setHasMask(false);
  };

  const handleUndo = () => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;

    // Undo inpainting step if available
    if (historyRef.current.length > 1) {
      historyRef.current.pop();
      const prevData = historyRef.current[historyRef.current.length - 1];
      const ctx = imgCanvas.getContext("2d");
      ctx?.putImageData(prevData, 0, 0);
      handleClearMask();
      setCanUndo(historyRef.current.length > 1);
      toast.success("이전 상태로 되돌렸습니다.");
      return;
    }

    // Or undo mask stroke
    if (maskHistoryRef.current.length > 0) {
      const prevMask = maskHistoryRef.current.pop()!;
      const mCtx = maskCanvas.getContext("2d");
      mCtx?.putImageData(prevMask, 0, 0);
      setHasMask(maskHistoryRef.current.length > 0);
    }
  };

  const handleResetToOriginal = () => {
    if (!originalSrc) return;
    loadImageToCanvas(originalSrc, true);
    toast.success("원본 이미지로 복원되었습니다.");
  };

  // Run AI Inpainting
  const handleRunInpaint = async () => {
    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas || !hasMask) {
      toast.error("지우고 싶은 부분을 브러시로 먼저 칠해주세요.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(10);
    setProgressStatus("AI 모델 준비 중...");

    try {
      const resultCanvas = await runInpainting(imgCanvas, maskCanvas, {
        padding: Math.max(64, brushSize * 2),
        maxDimension: 800,
        onProgress: (percent, status) => {
          setProgressPercent(percent);
          setProgressStatus(status);
        },
      });

      // Update base canvas with result
      const imgCtx = imgCanvas.getContext("2d");
      if (imgCtx) {
        imgCtx.drawImage(resultCanvas, 0, 0);
        // Save to history
        historyRef.current.push(imgCtx.getImageData(0, 0, imgCanvas.width, imgCanvas.height));
        setCanUndo(true);
      }

      // Clear mask
      handleClearMask();
      toast.success("AI 지우개 처리가 완료되었습니다!");
    } catch (err: any) {
      console.error("Inpaint failed:", err);
      toast.error(`지우기 실패: ${err?.message || "알 수 없는 오류"}`);
    } finally {
      setIsProcessing(false);
      setProgressPercent(0);
      setProgressStatus("");
    }
  };

  const handleDownloadPng = () => {
    const imgCanvas = imageCanvasRef.current;
    if (!imgCanvas) return;
    const link = document.createElement("a");
    link.href = imgCanvas.toDataURL("image/png");
    link.download = `${fileName}_지우개.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("PNG 파일이 다운로드되었습니다.");
  };

  const handleDownloadPdf = async () => {
    const imgCanvas = imageCanvasRef.current;
    if (!imgCanvas) return;
    const toastId = toast.loading("PDF 변환 중...");
    try {
      const dataUrl = imgCanvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const imgBytes = await res.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(imgBytes);
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
      page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}_지우개.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF가 다운로드되었습니다!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("PDF 생성 실패", { id: toastId });
    }
  };

  const handleSendToPdfEditor = async () => {
    const imgCanvas = imageCanvasRef.current;
    if (!imgCanvas) return;
    const toastId = toast.loading("PDF 편집기로 이동하는 중...");
    try {
      const dataUrl = imgCanvas.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const imgBytes = await res.arrayBuffer();

      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(imgBytes);
      const page = pdfDoc.addPage([pngImage.width, pngImage.height]);
      page.drawImage(pngImage, { x: 0, y: 0, width: pngImage.width, height: pngImage.height });

      const pdfBytes = await pdfDoc.save({ useObjectStreams: false });
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const newFile = new File([blob], `${fileName}_지우개.pdf`, { type: "application/pdf" });

      toast.success("PDF 편집기로 열립니다!", { id: toastId });
      openPdfEditor(newFile);
    } catch (err) {
      console.error(err);
      toast.error("전송 실패", { id: toastId });
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-6">
      {/* Upload Zone (when no image) */}
      {!imageSrc && (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="w-full max-w-4xl min-h-[420px] p-12 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-500 rounded-3xl bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm transition-all cursor-pointer flex flex-col items-center justify-center shadow-sm hover:shadow-xl group"
        >
          <div className="w-20 h-20 mb-6 rounded-3xl bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800/60 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 shadow-md">
            <Eraser className="w-10 h-10" />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> WebGPU 고속 가속 · 100% 로컬 연산
          </div>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white mb-2 text-center">
            AI 스마트 지우개
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm max-w-md text-center mb-8 leading-relaxed">
            문서나 사진에서 지우고 싶은 도장, 오타, 얼룩, 민감정보를 브러시로 칠하면 AI가 종이 질감을 살려 감쪽같이 지워냅니다.
          </p>
          <button className="flex items-center gap-2 px-8 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full font-bold text-sm shadow-lg shadow-purple-500/25 transition-all hover:scale-105 active:scale-95">
            <Upload className="w-4 h-4" /> 문서 또는 이미지 선택 (PDF, JPG, PNG)
          </button>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*, application/pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Editor Workspace */}
      {imageSrc && (
        <div className="w-full flex flex-col gap-4">
          {/* Top Control Bar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            {/* Left: File info + reset */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900 dark:text-white truncate max-w-xs">
                📄 {fileName}
              </span>
              <button
                onClick={handleResetToOriginal}
                className="flex items-center gap-1 text-xs px-2.5 py-1 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                title="처음 원본으로 복원"
              >
                <RotateCcw className="w-3 h-3" /> 원본 복원
              </button>
            </div>

            {/* Center: Brush Size Control */}
            <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-900/80 px-3.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-purple-500" />
                브러시 {brushSize}px
              </span>
              <input
                type="range"
                min="8"
                max="80"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value, 10))}
                className="w-24 accent-purple-600 cursor-pointer"
              />
              <div className="flex gap-1">
                {[15, 30, 55].map((s) => (
                  <button
                    key={s}
                    onClick={() => setBrushSize(s)}
                    className={`text-[10px] px-2 py-0.5 rounded-md font-bold transition-all ${
                      brushSize === s
                        ? "bg-purple-600 text-white shadow-xs"
                        : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200"
                    }`}
                  >
                    {s}px
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Brush Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleUndo}
                disabled={!canUndo && maskHistoryRef.current.length === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl disabled:opacity-40 transition-all"
                title="실행 취소"
              >
                <Undo2 className="w-3.5 h-3.5" />
                취소
              </button>
              <button
                onClick={handleClearMask}
                disabled={!hasMask}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-950/40 hover:text-red-600 rounded-xl disabled:opacity-40 transition-all"
                title="선택 마스크 모두 지우기"
              >
                <Trash2 className="w-3.5 h-3.5" />
                마스크 초기화
              </button>
              <button
                onMouseDown={() => setIsComparing(true)}
                onMouseUp={() => setIsComparing(false)}
                onTouchStart={() => setIsComparing(true)}
                onTouchEnd={() => setIsComparing(false)}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-xl transition-all select-none"
                title="누르고 있는 동안 원본을 비교합니다"
              >
                <Eye className="w-3.5 h-3.5" />
                원본 대조
              </button>
            </div>
          </div>

          {/* Interactive Canvas Area */}
          <div
            ref={containerRef}
            className="relative w-full overflow-auto bg-gray-100 dark:bg-gray-950 rounded-3xl border border-gray-200 dark:border-gray-800 p-4 flex items-center justify-center min-h-[480px] select-none"
            style={{ cursor: "crosshair" }}
          >
            <div className="relative inline-block max-w-full max-h-[72vh] shadow-2xl rounded-xl overflow-hidden bg-white">
              {/* Base Image Canvas */}
              <canvas
                ref={imageCanvasRef}
                className={`max-w-full max-h-[72vh] object-contain block transition-opacity ${
                  isComparing ? "opacity-0" : "opacity-100"
                }`}
              />

              {/* Original image underlay for instant comparison */}
              {isComparing && originalSrc && (
                <img
                  src={originalSrc}
                  alt="Original"
                  className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                />
              )}

              {/* Drawing Mask Layer */}
              <canvas
                ref={maskCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-auto"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />

              {/* Dynamic Cursor Indicator Layer */}
              <canvas
                ref={cursorCanvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
              />
            </div>

            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex flex-col items-center justify-center z-30 rounded-3xl animate-[fadeIn_150ms_ease-out]">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/90 text-white flex items-center justify-center mb-4 shadow-xl shadow-purple-500/30">
                  <Sparkles className="w-8 h-8 animate-spin" />
                </div>
                <h4 className="text-lg font-bold text-white mb-2">AI 스마트 지우개 실행 중</h4>
                <p className="text-xs text-purple-200 mb-4">{progressStatus || "연산 중..."}</p>
                {progressPercent > 0 && (
                  <div className="w-64 bg-white/20 rounded-full h-2 overflow-hidden mb-2">
                    <div
                      className="bg-purple-400 h-full transition-all duration-300"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
                <span className="text-[11px] text-gray-300">WebGPU / WASM 하드웨어 가속 구동</span>
              </div>
            )}
          </div>

          {/* Action Toolbar */}
          <div className="w-full flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500" />
              <span>지우고 싶은 부분을 브러시로 칠한 후 <strong>[지우기]</strong>를 누르세요.</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleRunInpaint}
                disabled={!hasMask || isProcessing}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md shadow-purple-500/25 transition-all hover:scale-105 active:scale-95 text-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    지우는 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    지우기 실행
                  </>
                )}
              </button>

              <div className="h-6 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

              <button
                onClick={handleDownloadPng}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-semibold rounded-xl text-xs transition-all"
              >
                <Download className="w-3.5 h-3.5" /> PNG 저장
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-600 font-semibold rounded-xl text-xs transition-all"
              >
                <FileText className="w-3.5 h-3.5" /> PDF 저장
              </button>

              <button
                onClick={handleSendToPdfEditor}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold rounded-xl text-xs transition-all"
              >
                PDF 편집기로 열기 →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
