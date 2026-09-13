

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { exportEditedPdf, mergePdfs, deletePdfPage, reorderPdfPages } from "@/lib/pdfUtils";
import { PromptModal } from "./Modal";
import { koreanToRoman } from "@/lib/romanize";
import { ImageOverlayData } from "./ImageOverlay";
import SignaturePad from "./SignaturePad";
import { isHeicFile, convertHeicToPng, removeImageBackground } from "@/lib/imageUtils";
import { usePdfElements } from "@/hooks/usePdfElements";
import { usePdfRenderer } from "@/hooks/usePdfRenderer";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import MacroForm from "./pdf/MacroForm";
import PdfToolbar from "./pdf/PdfToolbar";
import PdfCanvas from "./pdf/PdfCanvas";
import PdfSidebar from "./pdf/PdfSidebar";
import PdfOcrPanel from "./pdf/PdfOcrPanel";

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
  const [drawingRedaction, setDrawingRedaction] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  const [romanizeModal, setRomanizeModal] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportDefaultName, setExportDefaultName] = useState("");

  const [dragPageNumber, setDragPageNumber] = useState<number | null>(null);
  const [dragTargetPage, setDragTargetPage] = useState<number | null>(null);
  const [dragPosition, setDragPosition] = useState<"above" | "below" | null>(null);

  const isCorporateDoc =
    isCorporateMode &&
    (file.name.startsWith("doc_") || file.name.includes("법인") || file.name.includes("확인서"));
  const isShareholderFile =
    isCorporateMode && (file.name === "doc_shareholder.pdf" || file.name.includes("주주명부"));
  const isCorpOwnerFile =
    isCorporateMode && (file.name === "doc_corp_owner.pdf" || file.name.includes("지배자"));
  const isPersonalRepFile =
    isCorporateMode && (file.name === "doc_personal_rep.pdf" || file.name.includes("공동대표"));
  const [isMacroFormOpen, setIsMacroFormOpen] = useState(
    isShareholderFile || isCorpOwnerFile || isPersonalRepFile
  );

  const {
    textBoxes, setTextBoxes, imageOverlays, setImageOverlays, redactions, setRedactions,
    selectedImageId, setSelectedImageId, selectedTextId, setSelectedTextId,
    selectedRedactionId, setSelectedRedactionId, nextId, setNextId,
    addRedaction, removeRedaction, undo, redo, saveHistory, resetElements,
  } = usePdfElements();

  const {
    pdfDoc, setPdfDoc, pdfBuffer, setPdfBuffer,
    currentPage, setCurrentPage, numPages, setNumPages,
    scale, handleZoom,
  } = usePdfRenderer({
    file, setStatus, setStatusMsg, setErrorDetail, resetElements, setExtractedTexts,
  });

  useKeyboardShortcuts({
    status, selectedImageId, selectedTextId, selectedRedactionId,
    imageOverlays, textBoxes, redactions,
    undo, redo, saveHistory, nextId, currentPage,
    setTextBoxes, setImageOverlays, setRedactions,
    setNextId, setSelectedImageId, setSelectedTextId, setSelectedRedactionId,
  });

  // ── Render page ──
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
        if (isMounted) {
          setStatus("error");
          setStatusMsg("렌더링 오류 발생");
          setErrorDetail(error?.message || String(error));
        }
      }
    };
    renderPage();
    return () => { isMounted = false; };
  }, [currentPage, scale, pdfDoc]);

  // ── Utility: Optimized image coordinates ──
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

  // ── Clipboard paste ──
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
                id: `paste-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
                removedBgSrc: null, x, y, width: w, height: h, pageIndex: currentPage,
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

  // ── Drag & Drop (file drop on canvas) ──
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "done") return;
    setIsDragOver(true);
  };
  const handleDragLeave = () => setIsDragOver(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status !== "done") return;
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const droppedFile = files[0];
      if (droppedFile.type === "application/pdf" || droppedFile.name.toLowerCase().endsWith(".pdf")) {
        try {
          setStatus("rendering");
          setStatusMsg("PDF 병합 중...");
          const droppedBuffer = await droppedFile.arrayBuffer();
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
      if (isHeicFile(droppedFile) || droppedFile.type.startsWith("image/")) {
        const wrapper = canvasWrapperRef.current;
        if (!wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / scale;
        const dropY = (e.clientY - rect.top) / scale;

        let fileToLoad: Blob = droppedFile;
        if (isHeicFile(droppedFile)) {
          const toastId = toast.loading("아이폰 HEIC 이미지를 변환하는 중...");
          try {
            fileToLoad = await convertHeicToPng(droppedFile);
            toast.success("HEIC 변환 완료!", { id: toastId });
          } catch (err) {
            toast.error("HEIC 이미지 변환 실패", { id: toastId });
            return;
          }
        }

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
              id: `drop-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
              removedBgSrc: null, x, y, width: w, height: h, pageIndex: currentPage,
            };
            setImageOverlays((prev) => [...prev, newOverlay]);
            setSelectedImageId(newOverlay.id);
            setStatusMsg("이미지가 드롭된 위치에 추가되었습니다!");
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(fileToLoad);
      }
    }
  };

  // ── Page management ──
  const handleDeletePage = async (pageToDelete: number) => {
    if (!pdfBuffer || numPages <= 1) return;
    const deleteProcess = async () => {
      const newBuffer = await deletePdfPage(pdfBuffer, pageToDelete - 1);
      setPdfBuffer(newBuffer);
      const loadingTask = pdfjsLib.getDocument({ data: newBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setTextBoxes((prev) =>
        prev.filter((b) => b.pageIndex !== pageToDelete).map((b) =>
          b.pageIndex > pageToDelete ? { ...b, pageIndex: b.pageIndex - 1 } : b
        )
      );
      setImageOverlays((prev) =>
        prev.filter((o) => o.pageIndex !== pageToDelete).map((o) =>
          o.pageIndex > pageToDelete ? { ...o, pageIndex: o.pageIndex - 1 } : o
        )
      );
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
    const fromIdx = dragPageNumber - 1;
    let toIdx = targetPageNumber - 1;
    if (dragPosition === "below") toIdx += 1;
    if (fromIdx < toIdx) toIdx -= 1;
    if (fromIdx === toIdx) {
      setDragPageNumber(null);
      setDragTargetPage(null);
      setDragPosition(null);
      return;
    }
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
      const pageMap = new Map<number, number>();
      order.forEach((oldIdx, newIdx) => { pageMap.set(oldIdx + 1, newIdx + 1); });
      setTextBoxes((prev) => prev.map((b) => ({ ...b, pageIndex: pageMap.get(b.pageIndex) ?? b.pageIndex })));
      setImageOverlays((prev) => prev.map((o) => ({ ...o, pageIndex: pageMap.get(o.pageIndex) ?? o.pageIndex })));
      setCurrentPage(toIdx + 1);
    };
    toast.promise(reorderProcess(), {
      loading: "페이지 순서를 변경하는 중...",
      success: "페이지 순서가 변경되었습니다!",
      error: "페이지 순서 변경 실패",
    });
  };

  // ── Text handlers ──
  const handleTextChange = useCallback((id: string, newText: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, text: newText, isEdited: true } : b)));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleDeleteBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedTextId((prev) => (prev === id ? null : prev));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions, setSelectedTextId]);

  const handleFontSizeChange = useCallback((id: string, delta: number) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) =>
      b.id === id ? { ...b, fontSize: Math.max(1, Math.min(72, b.fontSize + delta)), isEdited: true } : b
    ));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleFontFamilyChange = useCallback((id: string, fontFamily: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, fontFamily, isEdited: true } : b)));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleToggleTransparent = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, isTransparent: !b.isTransparent, isEdited: true } : b)));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  // ── OCR ──
  const handleRunOcr = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setStatus("ocr");
      setStatusMsg("이미지 노이즈를 제거하고 글자를 전처리하는 중...");
      setOcrProgress(0);

      const { preprocessCanvasForOcr } = await import("@/lib/ocrPreprocess");
      const imageDataUrl = await preprocessCanvasForOcr(canvas);

      setStatusMsg("표/양식 구조를 분석하며 글자를 추출하는 중...");
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
      setShowTextPanel(true);
      setStatus("done");
      setStatusMsg(texts.length === 0 ? "추출할 텍스트를 찾지 못했습니다." : `새롭게 ${texts.length}개의 텍스트 줄을 추출했습니다! (우측 패널 확인)`);
    } catch (error: any) {
      console.error("OCR 오류:", error);
      setStatus("done");
      setStatusMsg("텍스트 추출 실패");
      setErrorDetail(error?.message || String(error));
    }
  };

  // ── Add text ──
  const handleAddText = (isTransparent: boolean = false, initialText: string = "텍스트 입력") => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays, redactions);
    const newBox: TextBox = {
      id: `new-${nextId}`, text: initialText,
      x: 100 + (nextId % 5) * 20, y: 100 + (nextId % 5) * 20,
      width: Math.min(400, Math.max(200, initialText.length * 14)),
      height: 36 + (initialText.split("\n").length - 1) * 20,
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
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    handleAddText(true, romanized);
  };

  // ── Canvas double-click ──
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

  // ── Text drag/resize ──
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
        setTextBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, x: startBoxX + dx, y: startBoxY + dy } : b)));
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
      setTextBoxes((prev) => prev.map((b) => (b.id === boxId ? { ...b, width: newW, height: newH } : b)));
    };
    const handleUp = () => {
      setResizingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes]);

  // ── Image handlers ──
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";

    let fileToLoad: Blob = imgFile;
    if (isHeicFile(imgFile)) {
      const toastId = toast.loading("아이폰 HEIC 이미지를 PNG로 변환하는 중...");
      try {
        fileToLoad = await convertHeicToPng(imgFile);
        toast.success("HEIC 변환 완료!", { id: toastId });
      } catch (err) {
        toast.error("HEIC 이미지 변환 실패", { id: toastId });
        return;
      }
    }

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
    reader.readAsDataURL(fileToLoad);
  };

  const handleBgRemoveUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let imgFile = e.target.files?.[0];
    if (!imgFile) return;
    e.target.value = "";

    if (isHeicFile(imgFile)) {
      const toastId = toast.loading("아이폰 HEIC 이미지를 변환하는 중...");
      try {
        const pngBlob = await convertHeicToPng(imgFile);
        imgFile = new File([pngBlob], `${imgFile.name.replace(/\.[^/.]+$/, "")}.png`, {
          type: "image/png",
        });
        toast.success("HEIC 변환 완료!", { id: toastId });
      } catch (err) {
        toast.error("HEIC 이미지 변환 실패", { id: toastId });
        return;
      }
    }

    setIsRemovingBg(true);
    setStatusMsg("배경을 제거하는 중...");
    try {
      const { resultUrl, originalUrl, originalWidth, originalHeight } = await removeImageBackground(imgFile);

      const { w, h, x, y } = getOptimizedImageCoords(originalWidth, originalHeight, imageOverlays.length);
      const newOverlay: ImageOverlayData = {
        id: `img-${Date.now()}`, originalSrc: originalUrl, displaySrc: resultUrl,
        removedBgSrc: resultUrl, x, y, width: w, height: h, pageIndex: currentPage,
      };
      setImageOverlays((prev) => [...prev, newOverlay]);
      setSelectedImageId(newOverlay.id);
      setIsRemovingBg(false);
      setStatusMsg("배경 제거 완료!");
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

  // ── Export ──
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

  // ── Signature ──
  const handleSignatureSave = (dataUrl: string, width: number, height: number) => {
    const maxW = 200;
    const ratio = width / height;
    const w = Math.min(width, maxW);
    const h = w / ratio;
    const newOverlay: ImageOverlayData = {
      id: `sig-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
      removedBgSrc: null, x: 100, y: 100, width: w, height: h, pageIndex: currentPage,
    };
    setImageOverlays((prev) => [...prev, newOverlay]);
    setSelectedImageId(newOverlay.id);
    setStatusMsg("서명이 추가되었습니다! 드래그하여 원하는 위치로 이동하세요.");
  };

  // ── Macro ──
  const handleAddMacroBoxes = (newBoxes: Omit<TextBox, "id">[]) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    const boxesWithIds = newBoxes.map((b, i) => ({ ...b, id: `macro-${Date.now()}-${i}` }));
    setTextBoxes((prev) => [...prev, ...boxesWithIds]);
    setNextId((prev) => prev + boxesWithIds.length);
    toast.success("입력하신 정보가 생성되었습니다! 원하는 빈칸 위치로 드래그하세요.");
  };

  // ── Redaction drawing ──
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
    setDrawingRedaction((prev) =>
      prev ? { ...prev, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top } : null
    );
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

        <PdfSidebar
          pdfDoc={pdfDoc}
          numPages={numPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onDeletePage={handleDeletePage}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onThumbDragStart={handleThumbDragStart}
          onThumbDragOver={handleThumbDragOver}
          onThumbDrop={handleThumbDrop}
          dragTargetPage={dragTargetPage}
          dragPosition={dragPosition}
        />

        <PdfCanvas
          canvasRef={canvasRef}
          canvasWrapperRef={canvasWrapperRef}
          containerRef={containerRef}
          scale={scale}
          status={status}
          statusMsg={statusMsg}
          currentPage={currentPage}
          isRedactMode={isRedactMode}
          isDragOver={isDragOver}
          textBoxes={textBoxes}
          selectedTextId={selectedTextId}
          draggingTextId={draggingTextId}
          resizingTextId={resizingTextId}
          onSelectText={setSelectedTextId}
          onTextDragStart={handleTextDragStart}
          onTextResizeStart={handleTextResizeStart}
          onTextChange={handleTextChange}
          onTextDelete={handleDeleteBox}
          onFontSizeChange={handleFontSizeChange}
          onToggleTransparent={handleToggleTransparent}
          onFontFamilyChange={handleFontFamilyChange}
          imageOverlays={imageOverlays}
          selectedImageId={selectedImageId}
          onSelectImage={setSelectedImageId}
          onImageUpdate={handleImageUpdate}
          onImageDelete={handleImageDelete}
          onImageDragStart={() => saveHistory(textBoxes, imageOverlays, redactions)}
          redactions={redactions}
          selectedRedactionId={selectedRedactionId}
          onSelectRedaction={setSelectedRedactionId}
          onRemoveRedaction={removeRedaction}
          drawingRedaction={drawingRedaction}
          onCanvasDoubleClick={handleCanvasDoubleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onRedactMouseDown={handleRedactMouseDown}
          onRedactMouseMove={handleRedactMouseMove}
          onRedactMouseUp={handleRedactMouseUp}
        />

        <PdfOcrPanel
          extractedTexts={extractedTexts}
          showTextPanel={showTextPanel}
          setShowTextPanel={setShowTextPanel}
          onAddText={handleAddText}
        />
      </div>

      <SignaturePad
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onSave={handleSignatureSave}
      />

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
