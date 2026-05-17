"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { Download, Loader2, Plus, Image as ImageIcon, Scissors, Trash2, Move, Minus, ZoomIn } from "lucide-react";
import { exportEditedPdf } from "@/lib/pdfUtils";
import ImageOverlayComponent, { ImageOverlayData } from "./ImageOverlay";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isEdited: boolean;
  isNew?: boolean;
}

type Status = "idle" | "rendering" | "ocr" | "done" | "error";

interface PdfEditorProps {
  file: File;
}

export default function PdfEditor({ file }: PdfEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgRemoveInputRef = useRef<HTMLInputElement>(null);
  const upscaleInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("rendering");
  const [statusMsg, setStatusMsg] = useState("PDF를 렌더링하는 중...");
  const [errorDetail, setErrorDetail] = useState("");
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlayData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        setStatus("rendering");
        setStatusMsg("PDF 파일을 읽는 중...");
        const arrayBuffer = await file.arrayBuffer();
        if (!isMounted) return;
        const bufferCopy = arrayBuffer.slice(0);
        setPdfBuffer(bufferCopy);

        setStatusMsg("PDF 문서를 파싱하는 중...");
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas를 찾을 수 없습니다.");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D Context 생성 실패");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        setStatusMsg("PDF 페이지를 렌더링하는 중...");
        await page.render({ canvasContext: context, viewport } as any).promise;
        if (!isMounted) return;

        setStatus("ocr");
        setStatusMsg("OCR 엔진을 초기화하는 중...");
        setOcrProgress(0);
        const imageDataUrl = canvas.toDataURL("image/png");

        const worker = await Tesseract.createWorker("kor+eng", 1, {
          logger: (m) => {
            if (isMounted && m.status === "recognizing text") {
              const pct = Math.round(m.progress * 100);
              setOcrProgress(pct);
              setStatusMsg(`글자를 인식하는 중... ${pct}%`);
            }
          },
        });

        const ret = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
        await worker.terminate();
        if (!isMounted) return;

        const ocrBlocks: any[] = (ret.data as any)?.blocks || [];
        const boxes: TextBox[] = [];
        let idx = 0;
        for (const block of ocrBlocks) {
          for (const para of block?.paragraphs || []) {
            for (const line of para?.lines || []) {
              if (line.text?.trim().length > 0 && line.bbox) {
                const h = line.bbox.y1 - line.bbox.y0;
                boxes.push({
                  id: `line-${idx}`, text: line.text.trim(),
                  x: line.bbox.x0, y: line.bbox.y0,
                  width: line.bbox.x1 - line.bbox.x0, height: h,
                  fontSize: Math.max(10, Math.round(h * 0.75)),
                  isEdited: false,
                });
                idx++;
              }
            }
          }
        }
        if (!isMounted) return;
        setTextBoxes(boxes);
        setNextId(idx);
        setStatus("done");
        setStatusMsg(boxes.length === 0
          ? "텍스트를 감지하지 못했습니다."
          : `${boxes.length}개의 텍스트 영역을 감지했습니다.`);
      } catch (error: any) {
        console.error("PDF/OCR 오류:", error);
        if (isMounted) { setStatus("error"); setStatusMsg("오류 발생"); setErrorDetail(error?.message || String(error)); }
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [file, scale]);

  const handleTextChange = (id: string, newText: string) => {
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, text: newText, isEdited: true } : b));
  };
  const handleDeleteBox = (id: string) => {
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
  };

  // 폰트 크기 변경
  const handleFontSizeChange = (id: string, delta: number) => {
    setTextBoxes((prev) => prev.map((b) =>
      b.id === id ? { ...b, fontSize: Math.max(8, Math.min(72, b.fontSize + delta)), isEdited: true } : b
    ));
  };

  // 텍스트 추가 버튼
  const handleAddText = () => {
    if (status !== "done") return;
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: 100, y: 100, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setNextId((prev) => prev + 1);
  };

  // 더블클릭으로 텍스트 추가
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: x - 50, y: y - 12, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setNextId((prev) => prev + 1);
    setSelectedImageId(null);
  };

  // 텍스트 박스 드래그 이동
  const handleTextDragStart = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const box = textBoxes.find((b) => b.id === boxId);
    if (!box) return;
    setDraggingTextId(boxId);
    const container = containerRef.current;
    if (!container) return;
    const cr = container.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - cr.left - box.x + container.scrollLeft,
      y: e.clientY - cr.top - box.y + container.scrollTop,
    };
    const handleMove = (ev: MouseEvent) => {
      const r = container.getBoundingClientRect();
      const newX = ev.clientX - r.left - dragOffset.current.x + container.scrollLeft;
      const newY = ev.clientY - r.top - dragOffset.current.y + container.scrollTop;
      setTextBoxes((prev) => prev.map((b) => b.id === boxId ? { ...b, x: newX, y: newY } : b));
    };
    const handleUp = () => {
      setDraggingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // 텍스트 박스 리사이즈
  const handleTextResizeStart = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const box = textBoxes.find((b) => b.id === boxId);
    if (!box) return;
    setResizingTextId(boxId);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: box.width, h: box.height };
    const handleMove = (ev: MouseEvent) => {
      const dx = ev.clientX - resizeStart.current.x;
      const dy = ev.clientY - resizeStart.current.y;
      const newW = Math.max(60, resizeStart.current.w + dx);
      const newH = Math.max(20, resizeStart.current.h + dy);
      setTextBoxes((prev) => prev.map((b) => b.id === boxId ? { ...b, width: newW, height: newH } : b));
    };
    const handleUp = () => {
      setResizingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  };

  // 이미지 추가
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxW = 300;
        const ratio = img.width / img.height;
        const w = Math.min(img.width, maxW);
        const h = w / ratio;
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
          removedBgSrc: null, x: 50, y: 50, width: w, height: h,
        };
        setImageOverlays((prev) => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
    e.target.value = "";
  };

  // 누끼따기
  const handleBgRemoveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";
    setIsRemovingBg(true);
    setStatusMsg("배경을 제거하는 중...");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const resultBlob = await removeBackground(imgFile, {
        output: { format: "image/png" as const },
      });
      const resultUrl = URL.createObjectURL(resultBlob);
      const originalUrl = URL.createObjectURL(imgFile);
      const img = new Image();
      img.onload = () => {
        const maxW = 300;
        const ratio = img.width / img.height;
        const w = Math.min(img.width, maxW);
        const h = w / ratio;
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: originalUrl, displaySrc: resultUrl,
          removedBgSrc: resultUrl, x: 50, y: 50, width: w, height: h,
        };
        setImageOverlays((prev) => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
        setIsRemovingBg(false);
        setStatusMsg("배경 제거 완료!");
      };
      img.src = resultUrl;
    } catch (err) {
      console.error("배경 제거 실패:", err);
      setIsRemovingBg(false);
      setStatusMsg("배경 제거 실패");
    }
  };

  // 이미지 업스케일링 (서버 API 사용)
  const handleUpscaleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";
    setIsUpscaling(true);
    setStatusMsg("이미지를 업스케일링하는 중...");
    try {
      const formData = new FormData();
      formData.append("image", imgFile);
      formData.append("scale", "2");
      formData.append("noise", "1");
      const res = await fetch("/api/upscale", { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "업스케일링 실패");
      }
      const blob = await res.blob();
      const resultUrl = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const ratio = img.width / img.height;
        const w = Math.min(img.width, maxW);
        const h = w / ratio;
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: resultUrl, displaySrc: resultUrl,
          removedBgSrc: null, x: 50, y: 50, width: w, height: h,
        };
        setImageOverlays((prev) => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
        setIsUpscaling(false);
        setStatusMsg("업스케일링 완료! 이미지가 추가되었습니다.");
      };
      img.src = resultUrl;
    } catch (err: any) {
      console.error("업스케일 실패:", err);
      setIsUpscaling(false);
      setStatusMsg(`업스케일링 실패: ${err.message}`);
    }
  };

  const handleImageUpdate = (id: string, updates: Partial<ImageOverlayData>) => {
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };
  const handleImageDelete = (id: string) => {
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const handleExport = async () => {
    if (!pdfBuffer) return;
    setStatus("rendering");
    setStatusMsg("새 PDF를 생성하는 중...");
    try {
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, scale);
      setStatus("done");
      setStatusMsg("PDF가 다운로드되었습니다!");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setStatusMsg("PDF 내보내기 실패");
      setErrorDetail(e?.message || String(e));
    }
  };

  const isLoading = status === "rendering" || status === "ocr";
  const hasContent = textBoxes.length > 0 || imageOverlays.length > 0;

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto py-8">
      {/* 툴바 */}
      <div className="w-full flex flex-wrap justify-between items-center mb-4 bg-white p-3 rounded-xl shadow-sm border gap-2">
        <h2 className="text-lg font-bold text-gray-800 truncate max-w-xs">{file.name}</h2>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">축소</button>
          <button onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-3 py-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm">확대</button>
          <div className="w-px bg-gray-200 mx-1" />
          <button onClick={handleAddText} disabled={status !== "done"}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 disabled:opacity-50">
            <Plus className="w-4 h-4" /> 텍스트 추가
          </button>
          <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"}
            className="flex items-center gap-1 px-3 py-1.5 bg-purple-50 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-100 disabled:opacity-50">
            <ImageIcon className="w-4 h-4" /> 이미지 추가
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button onClick={() => bgRemoveInputRef.current?.click()} disabled={status !== "done" || isRemovingBg}
            className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-100 disabled:opacity-50">
            {isRemovingBg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Scissors className="w-4 h-4" />}
            누끼따기
          </button>
          <input ref={bgRemoveInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgRemoveUpload} />
          <button onClick={() => upscaleInputRef.current?.click()} disabled={status !== "done" || isUpscaling}
            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-700 text-sm font-medium rounded-lg hover:bg-indigo-100 disabled:opacity-50">
            {isUpscaling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ZoomIn className="w-4 h-4" />}
            업스케일링
          </button>
          <input ref={upscaleInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpscaleUpload} />
          <div className="w-px bg-gray-200 mx-1" />
          <button onClick={handleExport} disabled={isLoading || !hasContent}
            className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700 disabled:opacity-50">
            <Download className="w-4 h-4" /> 내보내기
          </button>
        </div>
      </div>

      {/* 상태 메시지 */}
      <div className={`w-full mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
        status === "error" ? "bg-red-50 border border-red-200 text-red-800"
        : status === "done" && hasContent ? "bg-green-50 border border-green-200 text-green-800"
        : status === "done" ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
        : "bg-blue-50 border border-blue-200 text-blue-800"
      }`}>
        {isLoading && <span className="inline-block mr-2 animate-spin">⏳</span>}
        {status === "done" && hasContent && "✏️ "}
        {status === "error" && "❌ "}
        {statusMsg}
        {status === "done" && (
          <span className="ml-2 text-gray-500 text-xs">
            드래그: 이동 | 우하단: 크기 조절 | A+/A-: 폰트 크기 | 더블클릭: 추가
          </span>
        )}
        {status === "error" && errorDetail && (
          <span className="block mt-1 text-xs text-red-600 font-mono">{errorDetail}</span>
        )}
      </div>

      {status === "ocr" && (
        <div className="w-full mb-4 bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
        </div>
      )}

      {isRemovingBg && (
        <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> AI로 배경을 제거하는 중입니다...
        </div>
      )}

      {/* PDF 캔버스 + 오버레이 */}
      <div className="relative border shadow-2xl bg-white overflow-auto rounded-lg mx-auto"
        ref={containerRef} onDoubleClick={handleCanvasDoubleClick}
        onClick={() => setSelectedImageId(null)}>
        <canvas ref={canvasRef} className="block" />

        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-semibold text-gray-700">{statusMsg}</p>
          </div>
        )}

        {/* 텍스트 오버레이 */}
        {status === "done" && textBoxes.map((box) => (
          <div key={box.id} className="absolute group"
            style={{
              left: `${box.x}px`, top: `${box.y}px`,
              width: `${box.width}px`, height: `${box.height}px`,
              zIndex: draggingTextId === box.id || resizingTextId === box.id ? 30 : 10,
            }}>

            {/* 상단 컨트롤 바 (hover 시 표시) */}
            <div className="absolute -top-8 left-0 flex items-center gap-0.5 bg-white rounded-lg shadow-md border px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
              {/* 이동 핸들 */}
              <div onMouseDown={(e) => handleTextDragStart(e, box.id)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing" title="이동">
                <Move className="w-3.5 h-3.5" />
              </div>
              {/* 폰트 축소 */}
              <button onClick={() => handleFontSizeChange(box.id, -2)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="폰트 축소">
                <Minus className="w-3.5 h-3.5" />
              </button>
              {/* 폰트 크기 표시 */}
              <span className="text-[10px] font-mono text-gray-400 min-w-[24px] text-center select-none">{box.fontSize}</span>
              {/* 폰트 확대 */}
              <button onClick={() => handleFontSizeChange(box.id, 2)}
                className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="폰트 확대">
                <Plus className="w-3.5 h-3.5" />
              </button>
              {/* 삭제 */}
              <button onClick={() => handleDeleteBox(box.id)}
                className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded" title="삭제">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 텍스트 입력 영역 - 흰색 배경 */}
            <textarea value={box.text}
              onChange={(e) => handleTextChange(box.id, e.target.value)}
              className="w-full h-full resize-none overflow-hidden p-1 m-0 leading-snug cursor-pointer focus:cursor-text rounded-sm"
              style={{
                fontSize: `${box.fontSize}px`,
                fontFamily: "sans-serif",
                whiteSpace: "pre-wrap",
                backgroundColor: "#fff",
                color: "#000",
                border: box.isNew
                  ? "2px solid rgba(34,197,94,0.6)"
                  : box.isEdited
                  ? "2px solid rgba(245,158,11,0.5)"
                  : "1px solid rgba(59,130,246,0.3)",
                outline: "none",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              }}
              onFocus={(e) => {
                e.currentTarget.style.border = "2px solid #3b82f6";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.2)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = box.isNew
                  ? "2px solid rgba(34,197,94,0.6)"
                  : box.isEdited
                  ? "2px solid rgba(245,158,11,0.5)"
                  : "1px solid rgba(59,130,246,0.3)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
              }}
            />

            {/* 리사이즈 핸들 (우하단) */}
            <div onMouseDown={(e) => handleTextResizeStart(e, box.id)}
              className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity z-30" />
          </div>
        ))}

        {/* 이미지 오버레이 */}
        {status === "done" && imageOverlays.map((overlay) => (
          <ImageOverlayComponent key={overlay.id} overlay={overlay}
            onUpdate={handleImageUpdate} onDelete={handleImageDelete}
            isSelected={selectedImageId === overlay.id} onSelect={setSelectedImageId} />
        ))}
      </div>
    </div>
  );
}
