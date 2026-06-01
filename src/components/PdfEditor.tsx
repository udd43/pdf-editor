"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { Download, Loader2, Plus, Image as ImageIcon, Scissors, Trash2, Move, Minus, ZoomIn, Pen, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { exportEditedPdf, mergePdfs } from "@/lib/pdfUtils";
import { koreanToRoman } from "@/lib/romanize";
import ImageOverlayComponent, { ImageOverlayData } from "./ImageOverlay";
import SignaturePad from "./SignaturePad";
import TextBoxOverlay from "./TextBoxOverlay";
import { usePdfElements } from "@/hooks/usePdfElements";

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
}

const Thumbnail = ({ pdfDoc, pageNumber, isActive, onClick }: { pdfDoc: pdfjsLib.PDFDocumentProxy, pageNumber: number, isActive: boolean, onClick: () => void }) => {
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
      onClick={onClick}
      className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all group ${
        isActive ? "border-blue-500 shadow-md ring-2 ring-blue-500/20" : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
      }`}
    >
      <canvas ref={canvasRef} className="w-full h-auto bg-white block" />
      <div className={`absolute bottom-0 left-0 right-0 py-1 text-center text-[10px] font-bold ${
        isActive ? "bg-blue-500 text-white" : "bg-gray-100/90 dark:bg-gray-800/90 text-gray-600 dark:text-gray-300 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
      }`}>
        {pageNumber}
      </div>
    </div>
  );
};

export default function PdfEditor({ file }: PdfEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgRemoveInputRef = useRef<HTMLInputElement>(null);
  const upscaleInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>("rendering");
  const [statusMsg, setStatusMsg] = useState("PDF를 렌더링하는 중...");
  const [errorDetail, setErrorDetail] = useState("");
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [showTextPanel, setShowTextPanel] = useState(false);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  
  // Custom hook for element state management
  const {
    textBoxes,
    setTextBoxes,
    imageOverlays,
    setImageOverlays,
    selectedImageId,
    setSelectedImageId,
    selectedTextId,
    setSelectedTextId,
    nextId,
    setNextId,
    addTextBox,
    updateTextBox,
    removeTextBox,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
    undo,
    redo,
    saveHistory,
    resetElements,
  } = usePdfElements();
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const pressedKeys = useRef<Set<string>>(new Set());
  
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        setStatus("rendering");
        setStatusMsg("PDF 파일을 읽는 중...");
        
        // Reset states to prevent state leakage from previous PDF
        setTextBoxes([]);
        setImageOverlays([]);
        setSelectedImageId(null);
        setNextId(0);
        setExtractedTexts([]);

        const arrayBuffer = await file.arrayBuffer();
        if (!isMounted) return;
        const bufferCopy = arrayBuffer.slice(0);
        setPdfBuffer(bufferCopy);

        setStatusMsg("PDF 문서를 파싱하는 중...");
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        if (!isMounted) return;
        
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (error: any) {
        console.error("PDF 파싱 오류:", error);
        if (isMounted) { setStatus("error"); setStatusMsg("오류 발생"); setErrorDetail(error?.message || String(error)); }
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [file]);

  // 자동 채우기 폼 상태
  const isCorporateDoc = file.name.startsWith("doc_") || file.name.includes("법인") || file.name.includes("확인서");
  const isShareholderFile = file.name === "doc_shareholder.pdf" || file.name.includes("주주명부");
  const isCorpOwnerFile = file.name === "doc_corp_owner.pdf" || file.name.includes("지배자");

  const [isMacroFormOpen, setIsMacroFormOpen] = useState(isShareholderFile || isCorpOwnerFile);
  const [autoFillCompany, setAutoFillCompany] = useState("");
  const [autoFillCeo, setAutoFillCeo] = useState("");
  const [autoFillDate, setAutoFillDate] = useState("");

  // 주주명부 전용 상태 (배열로 7줄 관리)
  const [shareholders, setShareholders] = useState(
    Array(7).fill(null).map(() => ({ name: "", engName: "", gender: "", birth: "", nationality: "", shares: "", ownership: "" }))
  );
  const [shareholderCommon, setShareholderCommon] = useState({
    pricePerShare: "", totalShares: "", totalOwnership: "",
    today: "", company: "", address: "", repName: ""
  });

  // 지배자 확인서 전용 상태
  const [corpOwnerData, setCorpOwnerData] = useState({
    korName: "", engName: "", birth: "", nationality: "", gender: "", ownership: "", checkV: "V",
    year: "", monthDay: "", signName: ""
  });

  const handleShareholderAutoFill = () => {
    saveHistory(textBoxes, imageOverlays);
    
    const newBoxes: TextBox[] = [];
    // 컬럼별 정확한 x, w 지정 (전체적으로 좌측으로 치우쳐 있어서 우측으로 20px씩 이동)
    const baseFields = [
      { key: 'name', x: 65, y: 205, w: 85, h: 30 },
      { key: 'engName', x: 152, y: 205, w: 64, h: 30 },
      { key: 'gender', x: 218, y: 205, w: 28, h: 30 },
      { key: 'birth', x: 248, y: 205, w: 58, h: 30 },
      { key: 'nationality', x: 308, y: 205, w: 46, h: 30 },
      { key: 'shares', x: 356, y: 205, w: 64, h: 30 },
      { key: 'ownership', x: 422, y: 205, w: 58, h: 30 },
    ];

    // 1~7줄 (주주 1~7) 추가
    shareholders.forEach((sh, i) => {
      baseFields.forEach(f => {
        const val = sh[f.key as keyof typeof sh];
        if (val) {
          // row 1은 205, row 2부터는 정확히 +37 간격으로 증가해야 5,6,7번째 줄이 칸을 벗어나지 않음
          const actualY = i === 0 ? f.y : 205 + i * 37;
          newBoxes.push({
            id: `shareholder-${i}-${f.key}-${Date.now()}`, text: val,
            x: f.x, y: actualY, width: f.w, height: f.h, fontSize: 13,
            isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
            pageIndex: currentPage,
          });
        }
      });
    });

    // 공통 / 기타 정보 (전체 x축 20px 우측 이동)
    const commonFields = [
      { key: 'pricePerShare', x: 365, y: 140, w: 60, h: 20 },
      { key: 'totalShares', x: 356, y: 466, w: 64, h: 32 },
      { key: 'totalOwnership', x: 422, y: 466, w: 58, h: 32 },
      { key: 'today', x: 268, y: 567, w: 119, h: 20 },
      { key: 'company', x: 285, y: 597, w: 119, h: 20 },
      { key: 'address', x: 285, y: 625, w: 119, h: 20 },
      { key: 'repName', x: 285, y: 653, w: 80, h: 20 },
    ];

    commonFields.forEach(f => {
      const val = shareholderCommon[f.key as keyof typeof shareholderCommon];
      if (val) {
        newBoxes.push({
          id: `shareholder-common-${f.key}-${Date.now()}`, text: val,
          x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 13,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: currentPage,
        });
      }
    });

    if (newBoxes.length === 0) {
      toast.error("하나 이상의 정보를 입력해주세요.");
      return;
    }

    setTextBoxes(prev => [...prev, ...newBoxes]);
    toast.success("입력하신 주주 정보가 일괄 생성되었습니다!");
    setNextId(prev => prev + newBoxes.length);
  };

  const handleCorpOwnerAutoFill = () => {
    saveHistory(textBoxes, imageOverlays);
    
    const newBoxes: TextBox[] = [];
    const fields = [
      { key: 'korName', x: 131, y: 192, w: 60, h: 20 },
      { key: 'engName', x: 179, y: 192, w: 65, h: 20 },
      { key: 'birth', x: 247, y: 193, w: 60, h: 20 },
      { key: 'nationality', x: 293, y: 193, w: 60, h: 20 },
      { key: 'gender', x: 344, y: 194, w: 60, h: 20 },
      { key: 'ownership', x: 376, y: 195, w: 60, h: 20 },
      { key: 'checkV', x: 431, y: 190, w: 60, h: 20 },
      { key: 'year', x: 73, y: 620, w: 60, h: 20 },
      { key: 'monthDay', x: 135, y: 621, w: 60, h: 20 },
      { key: 'signName', x: 340, y: 618, w: 109, h: 20 },
    ];
    
    fields.forEach(f => {
      const val = corpOwnerData[f.key as keyof typeof corpOwnerData];
      if (val) {
        newBoxes.push({
          id: `corpowner-${f.key}-${Date.now()}`, text: val,
          x: f.x, y: f.y, width: f.w, height: f.h, fontSize: 13,
          isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
          pageIndex: currentPage,
        });
      }
    });

    if (newBoxes.length === 0) {
      toast.error("하나 이상의 정보를 입력해주세요.");
      return;
    }

    setTextBoxes(prev => [...prev, ...newBoxes]);
    toast.success("입력하신 지배자 정보가 일괄 생성되었습니다!");
    setNextId(prev => prev + newBoxes.length);
  };

  const handleAutoFill = () => {
    if (!autoFillCompany && !autoFillCeo && !autoFillDate) {
      toast.error("하나 이상의 정보를 입력해주세요.");
      return;
    }
    
    saveHistory(textBoxes, imageOverlays);
    
    const newBoxes: TextBox[] = [];
    let currentY = 150;
    
    if (autoFillCompany) {
      newBoxes.push({
        id: `auto-${Date.now()}-1`, text: autoFillCompany,
        x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
        pageIndex: currentPage,
      });
      currentY += 40;
    }
    if (autoFillCeo) {
      newBoxes.push({
        id: `auto-${Date.now()}-2`, text: autoFillCeo,
        x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
        pageIndex: currentPage,
      });
      currentY += 40;
    }
    if (autoFillDate) {
      newBoxes.push({
        id: `auto-${Date.now()}-3`, text: autoFillDate,
        x: 100, y: currentY, width: 200, height: 36, fontSize: 16,
        isEdited: true, isNew: true, isTransparent: true, fontFamily: "NotoSansKR",
        pageIndex: currentPage,
      });
    }

    setTextBoxes(prev => [...prev, ...newBoxes]);
    toast.success("입력하신 정보가 생성되었습니다! 원하는 빈칸 위치로 드래그하세요.");
    setNextId(prev => prev + newBoxes.length);
  };

  useEffect(() => {
    let isMounted = true;
    const renderPage = async () => {
      const pdf = pdfDoc;
      if (!pdf) return;
      try {
        setStatus("rendering");
        setStatusMsg(`PDF 페이지 ${currentPage}/${numPages} 렌더링 중...`);
        const page = await pdf.getPage(currentPage);
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

  // 이미지 추가 시 적절한 크기와 겹치지 않는 위치를 계산하는 헬퍼 함수
  const getOptimizedImageCoords = (imgW: number, imgH: number, currentImagesCount: number) => {
    const canvas = canvasRef.current;
    const canvasW = canvas ? canvas.width / scale : 500;
    const canvasH = canvas ? canvas.height / scale : 700;

    // 캔버스 가로/세로의 최대 40% 크기로 제한
    const maxW = Math.min(300, canvasW * 0.4);
    const maxH = Math.min(300, canvasH * 0.4);

    let w = imgW;
    let h = imgH;
    const ratio = imgW / imgH;

    if (w > maxW) {
      w = maxW;
      h = w / ratio;
    }
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }

    // 겹치지 않게 계단식 오프셋 추가
    const offset = (currentImagesCount % 5) * 25;
    const x = Math.max(10, Math.min(canvasW - w - 10, (canvasW - w) / 2 + offset));
    const y = Math.max(10, Math.min(canvasH - h - 10, (canvasH - h) / 2 + offset));

    return { w, h, x, y };
  };

  // 클립보드 붙여넣기로 이미지 추가 (Ctrl+V / Cmd+V)
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
              // 최적화된 위치와 크기 계산
              const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);

              const newOverlay: ImageOverlayData = {
                id: `paste-${Date.now()}`,
                originalSrc: dataUrl,
                displaySrc: dataUrl,
                removedBgSrc: null,
                x,
                y,
                width: w,
                height: h,
                pageIndex: currentPage,
              };
              setImageOverlays((prev) => [...prev, newOverlay]);
              setSelectedImageId(newOverlay.id);
              setStatusMsg("클립보드에서 이미지가 붙여넣기되었습니다!");
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(blob);
          break; // 첫 번째 이미지만 처리
        }
      }
    };

    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [status, imageOverlays.length, scale]);

  // 확대 / 축소 핸들러
  const handleZoom = (type: "in" | "out" | "reset") => {
    if (type === "in") {
      setScale((prev) => Math.min(3.0, prev + 0.25));
    } else if (type === "out") {
      setScale((prev) => Math.max(0.5, prev - 0.25));
    } else {
      setScale(1.5);
    }
  };

  // 드래그 앤 드롭 파일 탐색기 연동
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (status !== "done") return;
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status !== "done") return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      // PDF 병합 처리
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
        const container = containerRef.current;
        if (!container) return;

        // 드롭된 상대 마우스 좌표를 PDF 포인트 단위로 계산
        const rect = container.getBoundingClientRect();
        const dropX = (e.clientX - rect.left) / scale;
        const dropY = (e.clientY - rect.top) / scale;

        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const img = new Image();
          img.onload = () => {
            // 최적 크기 계산
            const canvas = canvasRef.current;
            const canvasW = canvas ? canvas.width / scale : 500;
            const canvasH = canvas ? canvas.height / scale : 700;

            const maxW = Math.min(300, canvasW * 0.4);
            const maxH = Math.min(300, canvasH * 0.4);

            let w = img.width;
            let h = img.height;
            const ratio = img.width / img.height;

            if (w > maxW) {
              w = maxW;
              h = w / ratio;
            }
            if (h > maxH) {
              h = maxH;
              w = h * ratio;
            }

            // 드롭된 위치의 중심부에 이미지가 놓이도록 위치 설정
            const x = Math.max(10, Math.min(canvasW - w - 10, dropX - w / 2));
            const y = Math.max(10, Math.min(canvasH - h - 10, dropY - h / 2));

            const newOverlay: ImageOverlayData = {
              id: `drop-${Date.now()}`,
              originalSrc: dataUrl,
              displaySrc: dataUrl,
              removedBgSrc: null,
              x,
              y,
              width: w,
              height: h,
              pageIndex: currentPage,
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

  const handleTextChange = useCallback((id: string, newText: string) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, text: newText, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleDeleteBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedTextId((prev) => prev === id ? null : prev);
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, setSelectedTextId]);

  // 폰트 크기 변경
  const handleFontSizeChange = useCallback((id: string, delta: number) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.map((b) =>
      b.id === id ? { ...b, fontSize: Math.max(8, Math.min(72, b.fontSize + delta)), isEdited: true } : b
    ));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  const handleFontFamilyChange = useCallback((id: string, fontFamily: string) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, fontFamily, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  // 수동 OCR 실행 (표 내부 텍스트 인식률 향상을 위해 PSM 11 사용)
  const handleRunOcr = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setStatus("ocr");
      setStatusMsg("표/양식 구조를 분석하며 글자를 추출하는 중...");
      setOcrProgress(0);
      const imageDataUrl = canvas.toDataURL("image/png");

      const worker = await Tesseract.createWorker("kor+eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            const pct = Math.round(m.progress * 100);
            setOcrProgress(pct);
            setStatusMsg(`글자를 추출하는 중... ${pct}%`);
          }
        },
      });
      
      // PSM 11: Sparse text (표 안의 흩어진 텍스트를 찾는데 더 유리함)
      await worker.setParameters({
        tessedit_pageseg_mode: "11" as any,
      });

      const ret = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
      await worker.terminate();

      const ocrBlocks: any[] = (ret.data as any)?.blocks || [];
      const texts: string[] = [];
      for (const block of ocrBlocks) {
        for (const para of block?.paragraphs || []) {
          for (const line of para?.lines || []) {
            if (line.text?.trim().length > 0) {
              texts.push(line.text.trim());
            }
          }
        }
      }
      
      setExtractedTexts(texts);
      setStatus("done");
      setStatusMsg(texts.length === 0
        ? "추출할 텍스트를 찾지 못했습니다."
        : `새롭게 ${texts.length}개의 텍스트 줄을 추출했습니다! (우측 패널 확인)`);
    } catch (error: any) {
      console.error("OCR 오류:", error);
      setStatus("done");
      setStatusMsg("텍스트 추출 실패");
      setErrorDetail(error?.message || String(error));
    }
  };

  // 텍스트 추가 버튼
  const handleAddText = (isTransparent: boolean = false, initialText: string = "텍스트 입력") => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays);
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

  // 영문명 변환 추가 버튼
  const handleAddRomanizedName = () => {
    if (status !== "done") return;
    const koreanName = window.prompt("영문으로 변환할 한글 이름을 입력하세요 (예: 홍길동):", "");
    if (!koreanName || koreanName.trim() === "") return;
    
    // 로마자 변환 후 단어 첫 글자를 대문자로
    const romanized = koreanToRoman(koreanName.trim())
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    handleAddText(true, romanized);
  };

  const handleToggleTransparent = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, isTransparent: !b.isTransparent, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays]);

  // 더블클릭으로 텍스트 추가
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
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

  // 텍스트 박스 드래그 이동
  const handleTextDragStart = useCallback((e: React.MouseEvent, boxId: string, startBoxX: number, startBoxY: number) => {
    e.preventDefault();
    e.stopPropagation();
    saveHistory(textBoxes, imageOverlays);
    setSelectedTextId(boxId);
    setSelectedImageId(null);
    setDraggingTextId(boxId);
    
    const startX = e.clientX;
    const startY = e.clientY;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      setTextBoxes((prev) => prev.map((b) => b.id === boxId ? { ...b, x: startBoxX + dx, y: startBoxY + dy } : b));
    };
    const handleUp = () => {
      setDraggingTextId(null);
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes]);

  // 텍스트 박스 리사이즈
  const handleTextResizeStart = useCallback((e: React.MouseEvent, boxId: string, startW: number, startH: number) => {
    e.preventDefault();
    e.stopPropagation();
    saveHistory(textBoxes, imageOverlays);
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

  // 이미지 추가
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

  // 이미지 업스케일링 (서버 API 사용)
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
    // We shouldn't save history on EVERY pixel of drag. ImageOverlayComponent needs to handle dragStart differently.
    // For now, if we use handleImageUpdate on drag, it doesn't save history to avoid spam.
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  };
  const handleImageDelete = (id: string) => {
    saveHistory(textBoxes, imageOverlays);
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // 단축키 지원 (삭제, 복사, 붙여넣기, Undo/Redo, 정밀이동, 매크로)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== "done") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      pressedKeys.current.add(e.code);

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // 방향키 정밀 이동
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (selectedTextId || selectedImageId) {
          e.preventDefault();
          saveHistory(textBoxes, imageOverlays);
          const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
          const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          
          if (selectedTextId) {
            setTextBoxes(prev => prev.map(b => b.id === selectedTextId ? { ...b, x: b.x + dx, y: b.y + dy } : b));
          } else if (selectedImageId) {
            setImageOverlays(prev => prev.map(o => o.id === selectedImageId ? { ...o, x: o.x + dx, y: o.y + dy } : o));
          }
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedImageId) {
          saveHistory(textBoxes, imageOverlays);
          setImageOverlays((prev) => prev.filter((o) => o.id !== selectedImageId));
          setSelectedImageId(null);
        } else if (selectedTextId) {
          saveHistory(textBoxes, imageOverlays);
          setTextBoxes((prev) => prev.filter((b) => b.id !== selectedTextId));
          setSelectedTextId(null);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedImageId) {
          const target = imageOverlays.find(o => o.id === selectedImageId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "image", data: target }));
        } else if (selectedTextId) {
          const target = textBoxes.find(b => b.id === selectedTextId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "text", data: target }));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const copied = sessionStorage.getItem("pdfitor_clipboard_overlay");
        if (copied) {
          const parsed = JSON.parse(copied);
          saveHistory(textBoxes, imageOverlays);
          if (parsed.type === "image") {
            const target = parsed.data as ImageOverlayData;
            const newOverlay: ImageOverlayData = { ...target, id: `copy-${Date.now()}`, x: target.x + 20, y: target.y + 20, pageIndex: currentPage };
            setImageOverlays(prev => [...prev, newOverlay]);
            setSelectedImageId(newOverlay.id);
            setSelectedTextId(null);
          } else if (parsed.type === "text") {
            const target = parsed.data as TextBox;
            const newBox: TextBox = { ...target, id: `new-${nextId}`, x: target.x + 20, y: target.y + 20, pageIndex: currentPage };
            setTextBoxes(prev => [...prev, newBox]);
            setNextId(prev => prev + 1);
            setSelectedTextId(newBox.id);
            setSelectedImageId(null);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [status, selectedImageId, selectedTextId, imageOverlays, textBoxes, undo, redo, saveHistory, nextId, file, pdfBuffer, currentPage, setTextBoxes]);

  const handleExport = async () => {
    if (!pdfBuffer) return;
    
    let defaultName = file.name;
    if (defaultName.toLowerCase().endsWith(".pdf")) {
      defaultName = defaultName.slice(0, -4);
    }
    
    const exportName = window.prompt("저장할 파일 이름을 입력하세요 (확장자 제외):", defaultName);
    if (exportName === null) return; 
    
    const finalFileName = exportName.trim() === "" ? file.name : `${exportName.trim()}.pdf`;

    setStatus("rendering");
    setStatusMsg("새 PDF를 생성하는 중 (백그라운드 처리 중)...");
    
    // Toast를 이용해 내보내기 진행 상태 표시
    const toastId = toast.loading("PDF를 병합하고 있습니다. 잠시만 기다려주세요...");

    try {
      // 이제 Web Worker가 메인 스레드 프리징 없이 PDF를 만듭니다.
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, 1, finalFileName);
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

  // 서명/그리기 저장 핸들러
  const handleSignatureSave = (dataUrl: string, width: number, height: number) => {
    const maxW = 200;
    const ratio = width / height;
    const w = Math.min(width, maxW);
    const h = w / ratio;
    const newOverlay: ImageOverlayData = {
      id: `sig-${Date.now()}`,
      originalSrc: dataUrl,
      displaySrc: dataUrl,
      removedBgSrc: null,
      x: 100,
      y: 100,
      width: w,
      height: h,
      pageIndex: currentPage,
    };
    setImageOverlays((prev) => [...prev, newOverlay]);
    setSelectedImageId(newOverlay.id);
    setStatusMsg("서명이 추가되었습니다! 드래그하여 원하는 위치로 이동하세요.");
  };

  const isLoading = status === "rendering" || status === "ocr";
  const hasContent = textBoxes.length > 0 || imageOverlays.length > 0;

  return (
    <div className="flex flex-col h-full w-full max-w-full">
      {/* 툴바 */}
      <div className="flex flex-col gap-1.5 mb-2">
        {/* 상태 표시 */}
        <div className="flex items-center gap-2 px-3 py-1">
          <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${status === "done" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : status === "error" ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
            {statusMsg}
          </span>
        </div>
        <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full overflow-x-auto custom-scrollbar">
      
          <style>{`
            @font-face { font-family: "NotoSansKR"; src: url("/NotoSansKR-Regular.otf"); }
            @font-face { font-family: "NanumMyeongjo"; src: url("/NanumMyeongjo.ttf"); }
            @font-face { font-family: "Jua"; src: url("/Jua.ttf"); }
          `}</style>

          <button onClick={handleRunOcr} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"
            title="문서 내의 글자를 자동으로 인식하여 편집 가능한 박스로 만듭니다">
            📝 텍스트 추출
          </button>
          <button onClick={() => handleAddText(false)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            텍스트(흰배경)
          </button>
          <button onClick={() => handleAddText(true)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            텍스트(투명)
          </button>
          <button onClick={handleAddRomanizedName} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-[11px] font-bold rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"
            title="한글 이름을 입력하면 소리나는 대로 영문으로 변환하여 추가합니다">
            영문명 변환
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

          {isCorporateDoc && (
            <>
              {/* 매크로 토글 버튼 */}
              <button onClick={() => setIsMacroFormOpen(!isMacroFormOpen)} disabled={status !== "done"}
                className={`flex items-center gap-1 px-2.5 py-1.5 border text-[11px] font-bold rounded-md transition-all shadow-sm whitespace-nowrap flex-shrink-0 ${
                  isMacroFormOpen 
                  ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300' 
                  : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
                title="매크로 양식을 열거나 닫습니다">
                🏢 매크로 폼
              </button>
              <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
            </>
          )}

          <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            <ImageIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> 이미지
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button onClick={() => bgRemoveInputRef.current?.click()} disabled={status !== "done" || isRemovingBg}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            {isRemovingBg ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" /> : <Scissors className="w-3.5 h-3.5 text-pink-500" />}
            누끼따기
          </button>
          <input ref={bgRemoveInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgRemoveUpload} />
          <button onClick={() => upscaleInputRef.current?.click()} disabled={status !== "done" || isUpscaling}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            {isUpscaling ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <ZoomIn className="w-3.5 h-3.5 text-purple-500" />}
            업스케일링
          </button>
          <input ref={upscaleInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpscaleUpload} />
          <button onClick={() => setIsSignatureOpen(true)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            <Pen className="w-3.5 h-3.5 text-emerald-500" /> 서명/그리기
          </button>
          
          <div className="flex-1" />

          {numPages > 1 && (
            <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1 || status !== "done"}
                className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
                이전
              </button>
              <span className="text-[10px] font-mono px-2 py-1 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 select-none">
                {currentPage}/{numPages}
              </span>
              <button onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))} disabled={currentPage >= numPages || status !== "done"}
                className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-600">
                다음
              </button>
            </div>
          )}
          
          <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
            <button onClick={() => handleZoom("out")} disabled={status !== "done" || scale <= 0.5}
              className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300" title="축소">
              <Minus className="w-3 h-3" />
            </button>
            <span onClick={() => handleZoom("reset")} 
              className="text-[10px] font-mono px-1.5 py-1 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border-x border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 select-none font-bold" title="원래 크기 (1.5x)">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => handleZoom("in")} disabled={status !== "done" || scale >= 3.0}
              className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300" title="확대">
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <button onClick={handleExport} disabled={isLoading || !hasContent}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-[11px] font-semibold rounded-md shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>
        </div>

        {/* 주주명부 매크로 폼 */}
        {isMacroFormOpen && isShareholderFile && status === "done" && (
          <div className="flex flex-col gap-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl w-full">
            <div className="flex justify-between items-center">
              <div className="text-sm font-bold text-indigo-700 dark:text-indigo-300">주주명부 일괄 생성기 (자동 위치 지정)</div>
              <button
                onClick={handleShareholderAutoFill}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
              >
                텍스트 일괄 생성하기
              </button>
            </div>
            
            <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {/* 주주 1~7 동적 렌더링 */}
              {shareholders.map((sh, idx) => {
                const yBase = idx === 0 ? 205 : 242 + (idx - 1) * 40;
                return (
                  <div key={idx} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                    <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">주주 {idx + 1} (y: {yBase})</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                      {[
                        { label: '성명', key: 'name' }, { label: '영문명', key: 'engName' },
                        { label: '성별', key: 'gender' }, { label: '생년월일', key: 'birth' },
                        { label: '국적', key: 'nationality' }, { label: '주식수', key: 'shares' },
                        { label: '지분율', key: 'ownership' },
                      ].map(f => (
                        <div key={f.key} className="flex flex-col">
                          <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                          <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                            value={sh[f.key as keyof typeof sh]} 
                            onChange={(e) => {
                              const newSh = [...shareholders];
                              newSh[idx] = { ...newSh[idx], [f.key]: e.target.value };
                              setShareholders(newSh);
                            }} />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* 공통 정보 */}
              <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-indigo-100 dark:border-indigo-800/30">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-300 mb-2">공통/기타 정보</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {[
                    { label: '1주 당 금액', key: 'pricePerShare' }, { label: '총주식수', key: 'totalShares' },
                    { label: '총지분율', key: 'totalOwnership' }, { label: '금일 날짜', key: 'today' },
                    { label: '상호', key: 'company' }, { label: '주소', key: 'address' },
                    { label: '이름(대표)', key: 'repName' },
                  ].map(f => (
                    <div key={f.key} className="flex flex-col">
                      <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                      <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-indigo-500"
                        value={(shareholderCommon as any)[f.key]} onChange={(e) => setShareholderCommon({ ...shareholderCommon, [f.key]: e.target.value })} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 지배자 확인서 매크로 폼 */}
        {isMacroFormOpen && isCorpOwnerFile && status === "done" && (
          <div className="flex flex-col gap-4 p-4 bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-800/50 rounded-xl w-full">
            <div className="flex justify-between items-center">
              <div className="text-sm font-bold text-teal-700 dark:text-teal-300">법인 소유 지배자 확인서 생성기</div>
              <button
                onClick={handleCorpOwnerAutoFill}
                className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
              >
                지배자 정보 생성하기
              </button>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-teal-100 dark:border-teal-800/30">
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                {[
                  { label: '한글성명', key: 'korName' }, { label: '영문성명', key: 'engName' },
                  { label: '생년월일', key: 'birth' }, { label: '국적', key: 'nationality' },
                  { label: '성별', key: 'gender' }, { label: '지분율', key: 'ownership' },
                  { label: 'V체크', key: 'checkV' }, { label: '작성 년도', key: 'year' },
                  { label: '월 일', key: 'monthDay' }, { label: '서명 성명', key: 'signName' },
                ].map(f => (
                  <div key={f.key} className="flex flex-col">
                    <label className="text-[10px] font-semibold text-gray-500 mb-1">{f.label}</label>
                    <input type="text" className="w-full text-xs px-2 py-1.5 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 focus:ring-1 focus:ring-teal-500"
                      value={(corpOwnerData as any)[f.key]} 
                      onChange={(e) => setCorpOwnerData({ ...corpOwnerData, [f.key]: e.target.value })} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 일반 법인 서류 자동 채우기 폼 */}
        {isMacroFormOpen && !isShareholderFile && !isCorpOwnerFile && isCorporateDoc && status === "done" && (
          <div className="flex flex-wrap items-end gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl w-full">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">회사명</label>
              <input 
                type="text" 
                placeholder="(주)회사이름" 
                className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                value={autoFillCompany}
                onChange={e => setAutoFillCompany(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">대표자명</label>
              <input 
                type="text" 
                placeholder="홍길동" 
                className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                value={autoFillCeo}
                onChange={e => setAutoFillCeo(e.target.value)}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 mb-1">날짜</label>
              <input 
                type="text" 
                placeholder="2026. 05. 30." 
                className="w-full text-sm px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                value={autoFillDate}
                onChange={e => setAutoFillDate(e.target.value)}
              />
            </div>
            <button
              onClick={handleAutoFill}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm transition-colors whitespace-nowrap shadow-sm h-[38px]"
            >
              텍스트 일괄 생성하기
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-1 gap-6 min-h-0 w-full overflow-hidden relative">
        {isRemovingBg && (
        <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> AI로 배경을 제거하는 중입니다...
        </div>
        )}
        
        {/* 좌측 썸네일 사이드바 */}
        {pdfDoc && numPages > 0 && (
          <div className="w-24 shrink-0 flex flex-col bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl h-[80vh] sticky top-24 overflow-hidden transition-colors"
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               onDrop={handleDrop}
          >
            <div className="bg-gray-100 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs font-bold text-gray-700 dark:text-gray-300">
              페이지
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {Array.from(new Array(numPages), (el, index) => (
                <Thumbnail 
                  key={index} 
                  pdfDoc={pdfDoc} 
                  pageNumber={index + 1} 
                  isActive={currentPage === index + 1}
                  onClick={() => setCurrentPage(index + 1)} 
                />
              ))}
              <div className="pt-2 pb-4 text-center text-[10px] text-gray-400 dark:text-gray-500 font-medium">
                다른 PDF를<br/>여기로 드래그하여 병합
              </div>
            </div>
          </div>
        )}

        {/* PDF 컨테이너 */}
        <div 
          ref={containerRef}
          onDoubleClick={handleCanvasDoubleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border border-gray-300 dark:border-gray-600 shadow-2xl bg-white overflow-auto rounded-lg flex-1 min-w-0 transition-all ${
            isDragOver ? "ring-4 ring-indigo-500 ring-offset-2 scale-[1.01]" : ""
          }`}
          style={{ minHeight: "600px" }}
        >
          <canvas ref={canvasRef} className="block mx-auto" />

          {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-lg font-semibold text-gray-700">{statusMsg}</p>
            </div>
          )}

          {/* 드래그 오버 상태의 오버레이 */}
          {isDragOver && (
            <div className="absolute inset-0 bg-indigo-500/20 border-4 border-dashed border-indigo-600 flex flex-col items-center justify-center z-40 backdrop-blur-[1px] pointer-events-none animate-pulse">
              <ImageIcon className="w-16 h-16 text-indigo-700 mb-2" />
              <p className="text-lg font-bold text-indigo-900">여기에 이미지를 드롭하여 추가</p>
            </div>
          )}

          {/* 텍스트 오버레이 */}
          {status === "done" && textBoxes.filter(box => box.pageIndex === currentPage).map((box) => (
            <TextBoxOverlay
              key={box.id}
              box={box}
              scale={scale}
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

          {/* 이미지 오버레이 */}
          {status === "done" && imageOverlays.filter(overlay => overlay.pageIndex === currentPage).map((overlay) => (
            <ImageOverlayComponent key={overlay.id} overlay={overlay} scale={scale}
              onUpdate={handleImageUpdate} onDelete={handleImageDelete}
              isSelected={selectedImageId === overlay.id} 
              onSelect={(id) => { setSelectedImageId(id); setSelectedTextId(null); }} 
              onDragStart={() => saveHistory(textBoxes, imageOverlays)} />
          ))}
        </div>

        {/* 추출 텍스트 플로팅 버튼 + 오버레이 서랍 */}
        {extractedTexts.length > 0 && (
          <>
            {/* 플로팅 토글 버튼 */}
            {!showTextPanel && (
              <button
                onClick={() => setShowTextPanel(true)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-1.5 px-2 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-l-xl shadow-lg transition-all hover:scale-105 active:scale-95"
                style={{ writingMode: 'vertical-rl' }}
              >
                📑 텍스트 ({extractedTexts.length})
              </button>
            )}

            {/* 오버레이 서랍 */}
            <div className={`absolute right-0 top-0 h-full z-50 transition-transform duration-300 ease-in-out ${
              showTextPanel ? 'translate-x-0' : 'translate-x-full'
            }`}>
              <div className="w-72 h-full flex flex-col bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-2xl">
                <div className="bg-gray-50 dark:bg-gray-900 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">📑 추출된 텍스트 ({extractedTexts.length})</span>
                  <div className="flex items-center gap-1.5">
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(extractedTexts.join('\n'));
                        alert('클립보드에 전체 텍스트가 복사되었습니다!');
                      }}
                      className="text-[10px] px-2 py-1 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 font-semibold transition-all"
                    >
                      전체 복사
                    </button>
                    <button
                      onClick={() => setShowTextPanel(false)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white dark:bg-gray-800">
                  {extractedTexts.map((text, idx) => (
                    <div key={idx} 
                      onDoubleClick={() => handleAddText(true, text)}
                      title="더블클릭하여 PDF에 텍스트 상자로 추가"
                      className="p-2.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-100 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:border-blue-200 dark:hover:border-blue-700 transition-all group"
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

            {/* 배경 딤 */}
            {showTextPanel && (
              <div 
                className="absolute inset-0 bg-black/20 z-40 rounded-lg"
                onClick={() => setShowTextPanel(false)}
              />
            )}
          </>
        )}
      </div>

      {/* 서명/그리기 모달 */}
      <SignaturePad
        isOpen={isSignatureOpen}
        onClose={() => setIsSignatureOpen(false)}
        onSave={handleSignatureSave}
      />
    </div>
  );
}
