"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2, Image as ImageIcon, Trash2, GripVertical } from "lucide-react";
import toast from "react-hot-toast";
import { exportEditedPdf, mergePdfs, deletePdfPage, reorderPdfPages } from "@/lib/pdfUtils";
import { PromptModal } from "./Modal";
import { koreanToRoman } from "@/lib/romanize";
import ImageOverlayComponent, { ImageOverlayData } from "./ImageOverlay";
import SignaturePad from "./SignaturePad";
import TextBoxOverlay from "./TextBoxOverlay";
import { usePdfElements } from "@/hooks/usePdfElements";
import { usePdfRenderer } from "@/hooks/usePdfRenderer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import MacroForm from "./pdf/MacroForm";
import PdfToolbar from "./pdf/PdfToolbar";

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
  isTransparent?: boolean;
  fontFamily?: string;
  pageIndex: number;
}

type Status = "idle" | "rendering" | "ocr" | "done" | "error";

interface PdfEditorProps {
  file: File;
  isCorporateMode?: boolean;
}

interface ThumbnailProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
  onDelete: () => void;
  totalPages: number;
  onDragStart: (e: React.DragEvent, pageNumber: number) => void;
  onDragOver: (e: React.DragEvent, pageNumber: number) => void;
  onDrop: (e: React.DragEvent, pageNumber: number) => void;
  isDragTarget: boolean;
  dragPosition: "above" | "below" | null;
}

const Thumbnail = ({ pdfDoc, pageNumber, isActive, onClick, onDelete, totalPages, onDragStart, onDragOver, onDrop, isDragTarget, dragPosition }: ThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let isMounted = true;
    const renderThumb = async () => {
      try {
        const page = await pdfDoc.getPage(pageNumber);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const context = canvas.getContext("2d");
        if (!context) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport } as any).promise;
      } catch (err) {
        console.error("Thumbnail render error", err);
      }
    };
    renderThumb();
    return () => { isMounted = false; };
  }, [pdfDoc, pageNumber]);

  return (
    <div
      draggable={totalPages > 1}
      onDragStart={(e) => onDragStart(e, pageNumber)}
      onDragOver={(e) => onDragOver(e, pageNumber)}
      onDrop={(e) => onDrop(e, pageNumber)}
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${
        isActive ? "border-blue-500 shadow-md ring-2 ring-blue-500/20" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      {/* Drop indicator line */}
      {isDragTarget && dragPosition === "above" && (
        <div className="absolute -top-1.5 left-1 right-1 h-[3px] bg-blue-500 rounded-full z-20 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
      )}
      {isDragTarget && dragPosition === "below" && (
        <div className="absolute -bottom-1.5 left-1 right-1 h-[3px] bg-blue-500 rounded-full z-20 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
      )}
      {/* Drag handle */}
      {totalPages > 1 && (
        <div className="absolute top-1 left-1 p-0.5 bg-white/80 dark:bg-gray-800/80 rounded opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-gray-400" />
        </div>
      )}
      <canvas ref={canvasRef} className="w-full h-auto bg-white block" />
      <div className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold ${
        isActive ? "bg-blue-500 text-white" : "bg-gray-100/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
      }`}>
        {pageNumber}
      </div>
      {totalPages > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-1 right-1 p-1 bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-10"
          title="페이지 삭제"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

export default function PdfEditor({ file, isCorporateMode = false }: PdfEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [status, setStatus] = useState<Status>("rendering");
  const [statusMsg, setStatusMsg] = useState("PDF를 렌더링하는 중...");
  const [errorDetail, setErrorDetail] = useState("");
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isRedactMode, setIsRedactMode] = useState(false);
  const [drawingRedaction, setDrawingRedaction] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);

  // Custom modal states (replacing window.prompt)
  const [romanizeModal, setRomanizeModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportDefaultName, setExportDefaultName] = useState("");

  // Drag-and-drop page reorder state
  const [dragPageNumber, setDragPageNumber] = useState<number | null>(null);
  const [dragTargetPage, setDragTargetPage] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<"above" | "below" | null>(null);

  // 자동 채우기 폼 상태
  const isCorporateDoc = isCorporateMode && (file.name.startsWith("doc_") || file.name.includes("법인") || file.name.includes("확인서"));
  const isShareholderFile = isCorporateMode && (file.name === "doc_shareholder.pdf" || file.name.includes("주주명부"));
  const isCorpOwnerFile = isCorporateMode && (file.name === "doc_corp_owner.pdf" || file.name.includes("지배자"));
  const isPersonalRepFile = isCorporateMode && (file.name === "doc_personal_rep.pdf" || file.name.includes("공동대표"));
  const [isMacroFormOpen, setIsMacroFormOpen] = useState(isShareholderFile || isCorpOwnerFile || isPersonalRepFile);
  
  // Custom hook for element state management
  const {
    textBoxes, setTextBoxes, imageOverlays, setImageOverlays, redactions, setRedactions, selectedImageId, setSelectedImageId,
    selectedTextId, setSelectedTextId, selectedRedactionId, setSelectedRedactionId, nextId, setNextId, addTextBox, updateTextBox, removeTextBox,
    addImageOverlay, updateImageOverlay, removeImageOverlay, addRedaction, updateRedaction, removeRedaction, undo, redo, saveHistory, resetElements,
  } = usePdfElements();

  const {
    pdfDoc, setPdfDoc, pdfBuffer, setPdfBuffer, currentPage, setCurrentPage, numPages, setNumPages, scale, handleZoom
  } = usePdfRenderer({
    file, setStatus, setStatusMsg, setErrorDetail, resetElements, setExtractedTexts
  });

  useKeyboardShortcuts({
    status, selectedImageId, selectedTextId, selectedRedactionId, imageOverlays, textBoxes, redactions,
    undo, redo, saveHistory, nextId, currentPage, setTextBoxes, setImageOverlays, setRedactions, setNextId, setSelectedImageId, setSelectedTextId, setSelectedRedactionId
  });

  useEffect(() => {
    let isMounted = true;
    const renderPage = async () => {
      if (!pdfDoc) return;
      try {
        setStatus("rendering");
        setStatusMsg(`PDF 페이지 ${currentPage}/${numPages} 렌더링 중...`);
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas를 찾을 수 없습니다.");
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D Context 생성 실패");
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport } as any).promise;
        if (!isMounted) return;

        setStatus("done");
        setStatusMsg("PDF 로딩 완료! 필요한 곳을 더블클릭하거나 텍스트를 추가하세요.");
      } catch (error: any) {
        console.error("PDF 렌더링 오류:", error);
        if (isMounted) { setStatus("error"); setStatusMsg("렌더링 오류 발생"); setErrorDetail(error?.message || String(error)); }
      }
    };
    renderPage();
    return () => { isMounted = false; };
  }, [currentPage, scale, pdfDoc]);

  const getOptimizedImageCoords = (imgW: number, imgH: number, currentImagesCount: number) => {
    const canvas = canvasRef.current;
    const canvasW = canvas ? canvas.width / scale : 500;
    const canvasH = canvas ? canvas.height / scale : 700;
    const maxW = Math.min(300, canvasW * 0.4);
    const maxH = Math.min(300, canvasH * 0.4);
    let w = imgW;
    let h = imgH;
    const ratio = imgW / imgH;

    if (w > maxW) { w = maxW; h = w / ratio; }
    if (h > maxH) { h = maxH; w = h * ratio; }

    const offset = (currentImagesCount % 5) * 25;
    const x = Math.max(10, Math.min(canvasW - w - 10, (canvasW - w) / 2 + offset));
    const y = Math.max(10, Math.min(canvasH - h - 10, (canvasH - h) / 2 + offset));

    return { w, h, x, y };
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (status !== "done") return;
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = (ev) => {
            const dataUrl = ev.target?.result as string;
            const img = new Image();
            img.onload = () => {
              const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);
              const newOverlay: ImageOverlayData = {
                id: `paste-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl, removedBgSrc: null,
                x, y, width: w, height: h, pageIndex: currentPage,
              };
              setImageOverlays((prev) => [...prev, newOverlay]);
              setSelectedImageId(newOverlay.id);
              setStatusMsg("클립보드에서 이미지가 붙여넣기되었습니다!");
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [status, imageOverlays.length, scale]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "done") return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => { setIsDragOver(false); };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status !== "done") return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        try {
          setStatus("rendering");
          setStatusMsg("PDF 병합 중...");
          const droppedBuffer = await file.arrayBuffer();
          const mergedBuffer = await mergePdfs(pdfBuffer!, droppedBuffer);
          setPdfBuffer(mergedBuffer);
          
          const loadingTask = pdfjsLib.getDocument({ data: mergedBuffer });
          const pdf = await loadingTask.promise;
          setPdfDoc(pdf);
          setNumPages(pdf.numPages);
          
          setStatus("done");
          setStatusMsg("PDF가 성공적으로 병합되었습니다!");
        } catch (err: any) {
          console.error("PDF 병합 오류:", err);
          setStatus("error");
          setStatusMsg("PDF 병합 실패");
          setErrorDetail(err?.message || String(err));
        }
        return;
      }

      if (file.type.startsWith("image/")) {
        const wrapper = canvasWrapperRef.current;
        if (!wrapper) return;

        const rect = wrapper.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / scale;
        const dropY = (e.clientY - rect.top) / scale;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            const canvas = canvasRef.current;
            const canvasW = canvas ? canvas.width / scale : 500;
            const canvasH = canvas ? canvas.height / scale : 700;

            const maxW = Math.min(300, canvasW * 0.4);
            const maxH = Math.min(300, canvasH * 0.4);

            let w = img.width;
            let h = img.height;
            const ratio = img.width / img.height;

            if (w > maxW) { w = maxW; h = w / ratio; }
            if (h > maxH) { h = maxH; w = h * ratio; }

            const x = Math.max(10, Math.min(canvasW - w - 10, dropX - w / 2));
            const y = Math.max(10, Math.min(canvasH - h - 10, dropY - h / 2));

            const newOverlay: ImageOverlayData = {
              id: `drop-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl, removedBgSrc: null,
              x, y, width: w, height: h, pageIndex: currentPage,
            };
            setImageOverlays((prev) => [...prev, newOverlay]);
            setSelectedImageId(newOverlay.id);
            setStatusMsg("이미지가 드롭된 위치에 추가되었습니다!");
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleDeletePage = async (pageToDelete: number) => {
    if (!pdfBuffer || numPages <= 1) return;
    
    // 네이티브 confirm 대신 즉시 삭제하되, 토스트로 알림
    const deleteProcess = async () => {
      const newBuffer = await deletePdfPage(pdfBuffer, pageToDelete - 1);
      setPdfBuffer(newBuffer);
      
      const loadingTask = pdfjsLib.getDocument({ data: newBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      
      // Update overlays/texts
      setTextBoxes(prev => prev.filter(b => b.pageIndex !== pageToDelete).map(b => 
        b.pageIndex > pageToDelete ? { ...b, pageIndex: b.pageIndex - 1 } : b
      ));
      setImageOverlays(prev => prev.filter(o => o.pageIndex !== pageToDelete).map(o => 
        o.pageIndex > pageToDelete ? { ...o, pageIndex: o.pageIndex - 1 } : o
      ));
      
      if (currentPage >= pageToDelete) {
        setCurrentPage(Math.max(1, currentPage - 1));
      }
    };

    toast.promise(deleteProcess(), {
      loading: `${pageToDelete}페이지 삭제 중...`,
      success: `${pageToDelete}페이지가 삭제되었습니다.`,
      error: "페이지 삭제 실패",
    });
  };

  // ── Page reorder via drag-and-drop ──
  const handleThumbDragStart = (e: React.DragEvent, pageNumber: number) => {
    setDragPageNumber(pageNumber);
    e.dataTransfer.effectAllowed = "move";
    // Set a minimal transparent drag image
    const ghost = document.createElement("div");
    ghost.style.width = "1px";
    ghost.style.height = "1px";
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleThumbDragOver = (e: React.DragEvent, pageNumber: number) => {
    e.preventDefault();
    if (dragPageNumber === null || dragPageNumber === pageNumber) {
      setDragTargetPage(null);
      setDragPosition(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos = e.clientY < midY ? "above" : "below";
    setDragTargetPage(pageNumber);
    setDragPosition(pos);
  };

  const handleThumbDrop = async (e: React.DragEvent, targetPageNumber: number) => {
    e.preventDefault();
    if (dragPageNumber === null || dragPageNumber === targetPageNumber || !pdfBuffer) {
      setDragPageNumber(null);
      setDragTargetPage(null);
      setDragPosition(null);
      return;
    }

    const fromIdx = dragPageNumber - 1; // 0-based
    let toIdx = targetPageNumber - 1;   // 0-based
    if (dragPosition === "below") toIdx += 1;
    // Adjust if dragging from before the target
    if (fromIdx < toIdx) toIdx -= 1;

    if (fromIdx === toIdx) {
      setDragPageNumber(null);
      setDragTargetPage(null);
      setDragPosition(null);
      return;
    }

    // Build new order array
    const order = Array.from({ length: numPages }, (_, i) => i);
    const [removed] = order.splice(fromIdx, 1);
    order.splice(toIdx, 0, removed);

    setDragPageNumber(null);
    setDragTargetPage(null);
    setDragPosition(null);

    const reorderProcess = async () => {
      const newBuffer = await reorderPdfPages(pdfBuffer, order);
      setPdfBuffer(newBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: newBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);

      // Update element pageIndex mappings
      const pageMap = new Map<number, number>();
      order.forEach((oldIdx, newIdx) => {
        pageMap.set(oldIdx + 1, newIdx + 1); // 1-based
      });

      setTextBoxes(prev => prev.map(b => ({
        ...b,
        pageIndex: pageMap.get(b.pageIndex) ?? b.pageIndex,
      })));
      setImageOverlays(prev => prev.map(o => ({
        ...o,
        pageIndex: pageMap.get(o.pageIndex) ?? o.pageIndex,
      })));

      // Follow the dragged page
      setCurrentPage(toIdx + 1);
    };

    toast.promise(reorderProcess(), {
      loading: "페이지 순서를 변경하는 중...",
      success: "페이지 순서가 변경되었습니다!",
      error: "페이지 순서 변경 실패",
    });
  };

  const handleTextChange = useCallback((id: string, newText: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, text: newText, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleDeleteBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedTextId((prev) => prev === id ? null : prev);
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, setSelectedTextId]);

  const handleFontSizeChange = useCallback((id: string, delta: number) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) =>
      b.id === id ? { ...b, fontSize: Math.max(8, Math.min(72, b.fontSize + delta)), isEdited: true } : b
    ));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleFontFamilyChange = useCallback((id: string, fontFamily: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, fontFamily, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleRunOcr = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setStatus("ocr");
      setStatusMsg("표/양식 구조를 분석하며 글자를 추출하는 중...");
      setOcrProgress(0);
      const imageDataUrl = canvas.toDataURL("image/png");

      const Tesseract = await import("tesseract.js");
      const worker = await Tesseract.createWorker("kor+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            const pct = Math.round(m.progress * 100);
            setOcrProgress(pct);
            setStatusMsg(`글자를 추출하는 중... ${pct}%`);
          }
        },
      });
      
      await worker.setParameters({ tessedit_pageseg_mode: "11" as any });

      const ret = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
      await worker.terminate();

      const ocrBlocks: any[] = (ret.data as any)?.blocks || [];
      const texts: string[] = [];
      for (const block of ocrBlocks) {
        for (const para of block?.paragraphs || []) {
          for (const line of para?.lines || []) {
            if (line.text?.trim().length > 0) texts.push(line.text.trim());
          }
        }
      }
      
      setExtractedTexts(texts);
      setStatus("done");
      setStatusMsg(texts.length === 0 ? "추출할 텍스트를 찾지 못했습니다." : `새롭게 ${texts.length}개의 텍스트 줄을 추출했습니다! (우측 패널 확인)`);
    } catch (error: any) {
      console.error("OCR 오류:", error);
      setStatus("done");
      setStatusMsg("텍스트 추출 실패");
      setErrorDetail(error?.message || String(error));
    }
  };

  const handleAddText = (isTransparent: boolean = false, initialText: string = "텍스트 입력") => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays, redactions);
    const newBox: TextBox = {
      id: `new-${nextId}`, text: initialText,
      x: 100 + (nextId % 5) * 20, y: 100 + (nextId % 5) * 20, 
      width: Math.min(400, Math.max(200, initialText.length * 14)), 
      height: 36 + (initialText.split('\n').length - 1) * 20,
      fontSize: 16, isEdited: true, isNew: true, isTransparent, fontFamily: "NotoSansKR",
      pageIndex: currentPage,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setSelectedTextId(newBox.id);
    setSelectedImageId(null);
    setNextId((prev) => prev + 1);
  };

  const handleAddRomanizedName = () => {
    if (status !== "done") return;
    setRomanizeModal(true);
  };

  const handleRomanizeConfirm = (koreanName: string) => {
    setRomanizeModal(false);
    if (!koreanName || koreanName.trim() === "") return;
    
    const romanized = koreanToRoman(koreanName.trim())
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    handleAddText(true, romanized);
  };

  const handleToggleTransparent = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, isTransparent: !b.isTransparent, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays, redactions);
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: x - 100, y: y - 18, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true, fontFamily: "NotoSansKR",
      pageIndex: currentPage,
    };
    setTextBoxes((prev) => [...prev, newBox]);
    setSelectedTextId(newBox.id);
    setSelectedImageId(null);
    setNextId((prev) => prev + 1);
  };

  const handleTextDragStart = useCallback((e: React.MouseEvent, boxId: string, startBoxX: number, startBoxY: number) => {
    e.preventDefault();
    e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setSelectedTextId(boxId);
    setSelectedImageId(null);
    setDraggingTextId(boxId);
    
    const startX = e.clientX;
    const startY = e.clientY;

    let rafId: number | null = null;
    const handleMove = (ev: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = (ev.clientX - startX) / scale;
        const dy = (ev.clientY - startY) / scale;
        setTextBoxes((prev) => prev.map((b) => b.id === boxId ? { ...b, x: startBoxX + dx, y: startBoxY + dy } : b));
      });
    };
    const handleUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      setDraggingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes]);

  const handleTextResizeStart = useCallback((e: React.MouseEvent, boxId: string, startW: number, startH: number) => {
    e.preventDefault();
    e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setSelectedTextId(boxId);
    setSelectedImageId(null);
    setResizingTextId(boxId);
    
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const newW = Math.max(20, startW + dx);
      const newH = Math.max(10, startH + dy);
      setTextBoxes((prev) => prev.map((b) => b.id === boxId ? { ...b, width: newW, height: newH } : b));
    };
    const handleUp = () => {
      setResizingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
          removedBgSrc: null, x, y, width: w, height: h, pageIndex: currentPage,
        };
        setImageOverlays((prev) => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
    e.target.value = "";
  };

  const handleBgRemoveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";
    setIsRemovingBg(true);
    setStatusMsg("배경을 제거하는 중...");
    try {
      const { removeBackground } = await import("@imgly/background-removal");
      const resultBlob = await removeBackground(imgFile, { model: "isnet_quint8", output: { format: "image/png" as const } });
      const resultUrl = URL.createObjectURL(resultBlob);
      const originalUrl = URL.createObjectURL(imgFile);
      const img = new Image();
      img.onload = () => {
        const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: originalUrl, displaySrc: resultUrl,
          removedBgSrc: resultUrl, x, y, width: w, height: h, pageIndex: currentPage,
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

  const handleUpscaleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";
    setIsUpscaling(true);
    setStatusMsg("Real-ESRGAN 초고속 모델 불러오는 중... (최대 10~30초 소요)");
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
        const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: resultUrl, displaySrc: resultUrl,
          removedBgSrc: null, x, y, width: w, height: h, pageIndex: currentPage,
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
    saveHistory(textBoxes, imageOverlays, redactions);
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  const handleExport = async () => {
    if (!pdfBuffer) return;
    let defaultName = file.name;
    if (defaultName.toLowerCase().endsWith(".pdf")) defaultName = defaultName.slice(0, -4);
    setExportDefaultName(defaultName);
    setExportModal(true);
  };

  const handleExportConfirm = async (exportName: string) => {
    setExportModal(false);
    if (!pdfBuffer) return;
    const finalFileName = exportName.trim() === "" ? file.name : `${exportName.trim()}.pdf`;

    setStatus("rendering");
    setStatusMsg("새 PDF를 생성하는 중 (백그라운드 처리 중)...");
    const toastId = toast.loading("PDF를 병합하고 있습니다. 잠시만 기다려주세요...");

    try {
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, redactions, 1, finalFileName);
      setStatus("done");
      setStatusMsg("PDF가 다운로드되었습니다!");
      toast.success("성공적으로 다운로드되었습니다!", { id: toastId });
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setStatusMsg("PDF 내보내기 실패");
      setErrorDetail(e?.message || String(e));
      toast.error("다운로드에 실패했습니다.", { id: toastId });
    }
  };

  const handleSignatureSave = (dataUrl: string, width: number, height: number) => {
    const maxW = 200;
    const ratio = width / height;
    const w = Math.min(width, maxW);
    const h = w / ratio;
    const newOverlay: ImageOverlayData = {
      id: `sig-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl, removedBgSrc: null,
      x: 100, y: 100, width: w, height: h, pageIndex: currentPage,
    };
    setImageOverlays((prev) => [...prev, newOverlay]);
    setSelectedImageId(newOverlay.id);
    setStatusMsg("서명이 추가되었습니다! 드래그하여 원하는 위치로 이동하세요.");
  };

  const handleAddMacroBoxes = (newBoxes: Omit<TextBox, "id">[]) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    const boxesWithIds = newBoxes.map((b, i) => ({ ...b, id: `macro-${Date.now()}-${i}` }));
    setTextBoxes(prev => [...prev, ...boxesWithIds]);
    setNextId(prev => prev + boxesWithIds.length);
    toast.success("입력하신 정보가 생성되었습니다! 원하는 빈칸 위치로 드래그하세요.");
  };

  const handleRedactMouseDown = (e: React.MouseEvent) => {
    if (!isRedactMode) return;
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setDrawingRedaction({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handleRedactMouseMove = (e: React.MouseEvent) => {
    if (!isRedactMode || !drawingRedaction) return;
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawingRedaction(prev => prev ? { ...prev, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top } : null);
  };

  const handleRedactMouseUp = () => {
    if (!isRedactMode || !drawingRedaction) return;
    const { startX, startY, currentX, currentY } = drawingRedaction;
    const x = Math.min(startX, currentX) / scale;
    const y = Math.min(startY, currentY) / scale;
    const w = Math.abs(currentX - startX) / scale;
    const h = Math.abs(currentY - startY) / scale;
    
    if (w > 5 && h > 5) {
      addRedaction({ pageIndex: currentPage, x, y, width: w, height: h });
    }
    setDrawingRedaction(null);
  };

  const isLoading = status === "rendering" || status === "ocr";
  const hasContent = textBoxes.length > 0 || imageOverlays.length > 0;

  return (
    <div className="flex flex-col h-full w-full max-w-full">
      <PdfToolbar 
        status={status}
        statusMsg={statusMsg}
        handleRunOcr={handleRunOcr}
        handleAddText={handleAddText}
        handleAddRomanizedName={handleAddRomanizedName}
        isCorporateDoc={!!isCorporateDoc}
        isMacroFormOpen={isMacroFormOpen}
        setIsMacroFormOpen={setIsMacroFormOpen}
        handleImageUpload={handleImageUpload}
        isRemovingBg={isRemovingBg}
        handleBgRemoveUpload={handleBgRemoveUpload}
        isUpscaling={isUpscaling}
        handleUpscaleUpload={handleUpscaleUpload}
        setIsSignatureOpen={setIsSignatureOpen}
        isRedactMode={isRedactMode}
        setIsRedactMode={setIsRedactMode}
        numPages={numPages}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        handleZoom={handleZoom}
        scale={scale}
        handleExport={handleExport}
        isLoading={isLoading}
        hasContent={hasContent}
      />

      {isMacroFormOpen && (
        <MacroForm 
          isCorporateDoc={!!isCorporateDoc}
          isShareholderFile={!!isShareholderFile}
          isCorpOwnerFile={!!isCorpOwnerFile}
          isPersonalRepFile={!!isPersonalRepFile}
          currentPage={currentPage}
          onAddBoxes={handleAddMacroBoxes}
        />
      )}

      <div className="flex flex-1 gap-6 min-h-0 w-full overflow-hidden relative">
        {isRemovingBg && (
        <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> AI로 배경을 제거하는 중입니다...
        </div>
        )}
        
        {pdfDoc && numPages > 0 && (
          <div className="w-24 shrink-0 flex flex-col bg-[#F9F6ED] dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl h-[80vh] sticky top-24 overflow-hidden transition-colors"
               onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
            <div className="bg-gray-100 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
              페이지
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {Array.from(new Array(numPages), (el, index) => (
                <Thumbnail 
                  key={index} pdfDoc={pdfDoc} pageNumber={index + 1} totalPages={numPages}
                  isActive={currentPage === index + 1} onClick={() => setCurrentPage(index + 1)} 
                  onDelete={() => handleDeletePage(index + 1)}
                  onDragStart={handleThumbDragStart}
                  onDragOver={handleThumbDragOver}
                  onDrop={handleThumbDrop}
                  isDragTarget={dragTargetPage === index + 1}
                  dragPosition={dragTargetPage === index + 1 ? dragPosition : null}
                />
              ))}
              <div className="pt-2 pb-4 text-center text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                다른 PDF를<br/>여기로 드래그하여 병합
              </div>
            </div>
          </div>
        )}

        <div 
          ref={containerRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          className={`border border-gray-300 dark:border-gray-600 shadow-2xl bg-gray-100 dark:bg-gray-900 overflow-auto rounded-lg flex-1 min-w-0 transition-all ${
            isDragOver ? "ring-4 ring-indigo-500 ring-offset-2 scale-[1.01]" : ""
          }`}
          style={{ minHeight: "600px" }}
        >
          <div 
            ref={canvasWrapperRef} 
            onDoubleClick={handleCanvasDoubleClick} 
            onMouseDown={handleRedactMouseDown}
            onMouseMove={handleRedactMouseMove}
            onMouseUp={handleRedactMouseUp}
            onMouseLeave={handleRedactMouseUp}
            className={`relative mx-auto w-max bg-white ${isRedactMode ? "cursor-crosshair" : ""}`}
          >
            <canvas ref={canvasRef} className="block" />

          {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-semibold text-gray-700">{statusMsg}</p>
            </div>
          )}

          {isDragOver && (
            <div className="absolute inset-0 bg-indigo-500/20 border-4 border-dashed border-indigo-600 flex flex-col items-center justify-center z-40 backdrop-blur-[1px] pointer-events-none animate-pulse">
              <ImageIcon className="w-16 h-16 text-indigo-700 mb-2" />
              <p className="text-lg font-bold text-indigo-900">여기에 이미지를 드롭하여 추가</p>
            </div>
          )}

          {status === "done" && textBoxes.filter(box => box.pageIndex === currentPage).map((box) => (
            <TextBoxOverlay
              key={box.id} box={box} scale={scale}
              isSelected={selectedTextId === box.id}
              onSelect={() => { setSelectedTextId(box.id); setSelectedImageId(null); }}
              isDragging={draggingTextId === box.id}
              isResizing={resizingTextId === box.id}
              onDragStart={handleTextDragStart}
              onResizeStart={handleTextResizeStart}
              onChange={handleTextChange}
              onDelete={handleDeleteBox}
              onFontSizeChange={handleFontSizeChange}
              onToggleTransparent={handleToggleTransparent}
              onFontFamilyChange={handleFontFamilyChange}
            />
          ))}

          {status === "done" && imageOverlays.filter(overlay => overlay.pageIndex === currentPage).map((overlay) => (
            <ImageOverlayComponent key={overlay.id} overlay={overlay} scale={scale}
              onUpdate={handleImageUpdate} onDelete={handleImageDelete}
              isSelected={selectedImageId === overlay.id} 
              onSelect={(id) => { setSelectedImageId(id); setSelectedTextId(null); }} 
              onDragStart={() => saveHistory(textBoxes, imageOverlays, redactions)} />
          ))}

          {status === "done" && textBoxes.length === 0 && imageOverlays.length === 0 && redactions.length === 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900/80 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm pointer-events-none animate-bounce z-50">
              💡 빈 공간을 더블클릭하여 텍스트를 추가하세요
            </div>
          )}

          {/* Render Redactions */}
          {status === "done" && redactions.filter(r => r.pageIndex === currentPage).map(r => (
            <div key={r.id} className="absolute bg-gray-900 z-10" style={{ left: r.x * scale, top: r.y * scale, width: r.width * scale, height: r.height * scale }}>
              <button 
                className={`absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md text-red-500 hover:text-red-700 opacity-0 hover:opacity-100 transition-opacity ${selectedRedactionId === r.id ? 'opacity-100' : ''}`}
                onClick={() => removeRedaction(r.id)}
                onMouseEnter={() => setSelectedRedactionId(r.id)}
                onMouseLeave={() => setSelectedRedactionId(null)}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* Render Drawing Redaction */}
          {isRedactMode && drawingRedaction && (
            <div 
              className="absolute bg-gray-900/80 border-2 border-gray-900 z-20"
              style={{
                left: Math.min(drawingRedaction.startX, drawingRedaction.currentX),
                top: Math.min(drawingRedaction.startY, drawingRedaction.currentY),
                width: Math.abs(drawingRedaction.currentX - drawingRedaction.startX),
                height: Math.abs(drawingRedaction.currentY - drawingRedaction.startY),
              }}
            />
          )}
          </div>
        </div>

        {extractedTexts.length > 0 && (
          <>
            {!showTextPanel && (
              <button onClick={() => setShowTextPanel(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 px-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-l-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ writingMode: 'vertical-rl' }}>
                📑 텍스트 ({extractedTexts.length})
              </button>
            )}

            <div className={`absolute right-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
              showTextPanel ? 'translate-x-0' : 'translate-x-full'
            }`}>
              <div className="w-72 h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl">
                <div className="bg-[#F9F6ED] dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">📑 추출된 텍스트 ({extractedTexts.length})</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(extractedTexts.join('\n'));
                        toast.success('클립보드에 전체 텍스트가 복사되었습니다!');
                      }}
                      className="text-[10px] px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-all"
                    >
                      전체 복사
                    </button>
                    <button onClick={() => setShowTextPanel(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-gray-800">
                  {extractedTexts.map((text, idx) => (
                    <div key={idx} onDoubleClick={() => handleAddText(true, text)} title="더블클릭하여 PDF에 텍스트 상자로 추가"
                      className="p-2.5 bg-[#F9F6ED] dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-200 dark:hover:border-blue-700 transition-all group"
                    >
                      {text}
                      <div className="text-[9px] text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 mt-1 font-bold transition-opacity">
                        ✨ 더블클릭으로 추가
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {showTextPanel && (
              <div className="absolute inset-0 bg-black/20 z-40 rounded-lg" onClick={() => setShowTextPanel(false)} />
            )}
          </>
        )}
      </div>

      <SignaturePad
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onSave={handleSignatureSave}
      />

      {/* Custom Modals */}
      <PromptModal
        isOpen={romanizeModal}
        title="영문명 변환"
        message="영문으로 변환할 한글 이름을 입력하세요"
        placeholder="예: 홍길동"
        confirmLabel="변환"
        onConfirm={handleRomanizeConfirm}
        onCancel={() => setRomanizeModal(false)}
      />
      <PromptModal
        isOpen={exportModal}
        title="PDF 내보내기"
        message="저장할 파일 이름을 입력하세요 (확장자 제외)"
        placeholder="파일 이름"
        defaultValue={exportDefaultName}
        confirmLabel="다운로드"
        onConfirm={handleExportConfirm}
        onCancel={() => setExportModal(false)}
      />
    </div>
  );
}
