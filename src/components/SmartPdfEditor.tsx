import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, Sparkles, Download, Trash2, Loader2, Minus, Plus, Pen, Image as ImageIcon, Scissors, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getFontBuffers } from '@/lib/fontCache';
import { exportEditedPdf } from '@/lib/pdfUtils';
import ImageOverlayComponent, { ImageOverlayData } from './ImageOverlay';
import SignaturePad from './SignaturePad';
import TextBoxOverlay from './TextBoxOverlay';
import { usePdfElements } from '@/hooks/usePdfElements';
import { PromptModal } from './Modal';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// 스마트 편집 시 추출된 PDF 요소
interface SmartElement {
  id: string;
  type: 'text' | 'rect';
  text?: string;
  pdfX: number;
  pdfY: number;
  width: number;
  height: number;
  isDeleted: boolean;
  pageIndex: number;
}

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

export default function SmartPdfEditor() {
  // === 파일 상태 ===
  const [file, setFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // === 페이지/줌 상태 ===
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);

  // === 스마트 추출 요소 ===
  const [smartElements, setSmartElements] = useState<SmartElement[]>([]);

  // === 에디터 상태 ===
  const [status, setStatus] = useState<"idle" | "rendering" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // === 기존 PdfEditor 기능: 텍스트/이미지/블라인드 ===
  const {
    textBoxes, setTextBoxes, imageOverlays, setImageOverlays, redactions, setRedactions,
    selectedImageId, setSelectedImageId, selectedTextId, setSelectedTextId,
    selectedRedactionId, setSelectedRedactionId, nextId, setNextId,
    addRedaction, removeRedaction, saveHistory, resetElements,
  } = usePdfElements();

  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
  const [isRedactMode, setIsRedactMode] = useState(false);
  const [drawingRedaction, setDrawingRedaction] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const [exportModal, setExportModal] = useState(false);
  const [exportDefaultName, setExportDefaultName] = useState("");

  // === Refs ===
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ==============================================
  // 파일 업로드 핸들러
  // ==============================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || selected.type !== "application/pdf") {
      if (selected) toast.error("PDF 파일만 업로드 가능합니다.");
      return;
    }
    setFile(selected);
    setIsProcessing(true);
    setStatusMsg("PDF 구조 분석 중...");
    try {
      const buffer = await selected.arrayBuffer();
      setPdfBuffer(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await loadingTask.promise;
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      resetElements();

      await extractSmartElements(doc);
      setStatus("done");
      setStatusMsg("스마트 분석 완료! 텍스트를 클릭해서 수정하거나 삭제하세요.");
    } catch (err) {
      console.error(err);
      toast.error("PDF 파싱 실패");
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  // ==============================================
  // 스마트 요소 추출 (텍스트 + 표/칸)
  // ==============================================
  const extractSmartElements = async (doc: any) => {
    const newElements: SmartElement[] = [];
    let elementId = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      
      // 텍스트 추출
      const textContent = await page.getTextContent();
      const pageTexts: any[] = [];
      textContent.items.forEach((item: any) => {
        if (!item.str || item.str.trim() === '') return;
        const fontSize = Math.sqrt(item.transform[2] * item.transform[2] + item.transform[3] * item.transform[3]);
        pageTexts.push({
          text: item.str, x: item.transform[4], y: item.transform[5],
          width: item.width, height: item.height || fontSize
        });
      });

      // 같은 줄 텍스트 머지
      const lines: any[] = [];
      pageTexts.forEach(item => {
        const match = lines.find(l => Math.abs(l.y - item.y) < 3);
        if (match) match.items.push(item);
        else lines.push({ y: item.y, items: [item] });
      });

      lines.forEach(line => {
        line.items.sort((a: any, b: any) => a.x - b.x);
        let mergedText = "";
        let startX = line.items[0].x;
        let totalWidth = 0;
        let maxHeight = 0;
        line.items.forEach((item: any, idx: number) => {
          if (idx > 0) {
            const prev = line.items[idx - 1];
            const gap = item.x - (prev.x + prev.width);
            if (gap > prev.height * 0.3) mergedText += " ";
          }
          mergedText += item.text;
          totalWidth = (item.x + item.width) - startX;
          if (item.height > maxHeight) maxHeight = item.height;
        });
        if (mergedText.trim()) {
          newElements.push({
            id: `smart_${elementId++}`, type: 'text', text: mergedText,
            pdfX: startX, pdfY: line.y, width: totalWidth, height: maxHeight,
            isDeleted: false, pageIndex: pageNum - 1
          });
        }
      });

      // 사각형/표 추출
      const opList = await page.getOperatorList();
      const pageRects: any[] = [];
      let currentTransform = [1, 0, 0, 1, 0, 0];
      let transformStack: number[][] = [];
      let lastX: number | null = null, lastY: number | null = null;
      let subpathStartX: number | null = null, subpathStartY: number | null = null;
      const segments: any[] = [];

      const applyTransform = (p: number[], m: number[]) => [
        p[0] * m[0] + p[1] * m[2] + m[4], p[0] * m[1] + p[1] * m[3] + m[5]
      ];
      const transformMatrix = (m1: number[], m2: number[]) => [
        m1[0]*m2[0]+m1[2]*m2[1], m1[1]*m2[0]+m1[3]*m2[1],
        m1[0]*m2[2]+m1[2]*m2[3], m1[1]*m2[2]+m1[3]*m2[3],
        m1[0]*m2[4]+m1[2]*m2[5]+m1[4], m1[1]*m2[4]+m1[3]*m2[5]+m1[5]
      ];

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];
        if (fn === 10) transformStack.push([...currentTransform]);
        else if (fn === 11 && transformStack.length) currentTransform = transformStack.pop()!;
        else if (fn === 12) currentTransform = transformMatrix(currentTransform, args);
        else if (fn === 13) {
          const p = applyTransform([args[0], args[1]], currentTransform);
          lastX = p[0]; lastY = p[1]; subpathStartX = p[0]; subpathStartY = p[1];
        }
        else if (fn === 14) {
          const p = applyTransform([args[0], args[1]], currentTransform);
          if (lastX !== null && lastY !== null) segments.push({ x1: lastX, y1: lastY, x2: p[0], y2: p[1] });
          lastX = p[0]; lastY = p[1];
        }
        else if (fn === 18) {
          if (lastX !== null && lastY !== null && subpathStartX !== null && subpathStartY !== null) {
            segments.push({ x1: lastX, y1: lastY, x2: subpathStartX, y2: subpathStartY });
            lastX = subpathStartX; lastY = subpathStartY;
          }
        }
        else if (fn === 19) {
          const p1 = applyTransform([args[0], args[1]], currentTransform);
          const p3 = applyTransform([args[0]+args[2], args[1]+args[3]], currentTransform);
          const x = Math.min(p1[0], p3[0]), y = Math.min(p1[1], p3[1]);
          const w = Math.abs(p3[0]-p1[0]), h = Math.abs(p3[1]-p1[1]);
          if (w > 20 && h > 10 && h < 300) pageRects.push({ x, y, width: w, height: h });
        }
      }

      // 선 교차점 기반 셀 감지
      const hLines: any[] = [], vLines: any[] = [];
      segments.forEach(seg => {
        const x1 = Math.min(seg.x1, seg.x2), x2 = Math.max(seg.x1, seg.x2);
        const y1 = Math.min(seg.y1, seg.y2), y2 = Math.max(seg.y1, seg.y2);
        if (y2 - y1 < 2) hLines.push({ x1, x2, y: (y1+y2)/2 });
        else if (x2 - x1 < 2) vLines.push({ y1, y2, x: (x1+x2)/2 });
      });

      const uniqueXs = Array.from(new Set(vLines.map(v => Math.round(v.x)))).sort((a,b) => a-b);
      const uniqueYs = Array.from(new Set(hLines.map(h => Math.round(h.y)))).sort((a,b) => a-b);

      for (let i = 0; i < uniqueXs.length-1; i++) {
        for (let j = i+1; j < uniqueXs.length; j++) {
          const x1 = uniqueXs[i], x2 = uniqueXs[j], w = x2-x1;
          if (w < 20) continue;
          const validHLines = hLines.filter(h => h.x1-3 <= x1 && h.x2+3 >= x2);
          if (validHLines.length < 2) continue;
          for (let k = 0; k < uniqueYs.length-1; k++) {
            for (let m = k+1; m < uniqueYs.length; m++) {
              const y1 = uniqueYs[k], y2 = uniqueYs[m], h = Math.abs(y2-y1);
              if (h < 10 || h > 300) continue;
              const hasTop = validHLines.some(hL => Math.abs(hL.y-y1) < 3);
              const hasBottom = validHLines.some(hL => Math.abs(hL.y-y2) < 3);
              if (!hasTop || !hasBottom) continue;
              const hasLeft = vLines.some(v => Math.abs(v.x-x1)<3 && v.y1-3<=Math.min(y1,y2) && v.y2+3>=Math.max(y1,y2));
              const hasRight = vLines.some(v => Math.abs(v.x-x2)<3 && v.y1-3<=Math.min(y1,y2) && v.y2+3>=Math.max(y1,y2));
              if (hasLeft && hasRight) {
                const hasInternalH = hLines.some(hL => hL.y>Math.min(y1,y2)+3 && hL.y<Math.max(y1,y2)-3 && hL.x1<x2-3 && hL.x2>x1+3);
                const hasInternalV = vLines.some(v => v.x>x1+3 && v.x<x2-3 && v.y1<Math.max(y1,y2)-3 && v.y2>Math.min(y1,y2)+3);
                if (!hasInternalH && !hasInternalV) {
                  pageRects.push({ x: x1, y: Math.min(y1,y2), width: w, height: h });
                }
              }
            }
          }
        }
      }

      // 중복 제거
      const filteredRects: any[] = [];
      pageRects.forEach(rect => {
        const isDup = filteredRects.some(f => Math.abs(f.x-rect.x)<3 && Math.abs(f.y-rect.y)<3 && Math.abs(f.width-rect.width)<3 && Math.abs(f.height-rect.height)<3);
        if (!isDup) filteredRects.push(rect);
      });

      filteredRects.forEach(rect => {
        newElements.push({
          id: `smart_${elementId++}`, type: 'rect',
          pdfX: rect.x, pdfY: rect.y, width: rect.width, height: rect.height,
          isDeleted: false, pageIndex: pageNum - 1
        });
      });
    }
    setSmartElements(newElements);
  };

  // ==============================================
  // 페이지 렌더링 (캔버스 + 화이트아웃)
  // ==============================================
  useEffect(() => {
    if (!pdfDoc || status !== "done") return;
    let isMounted = true;
    
    const renderPage = async () => {
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport } as any).promise;
        if (!isMounted) return;

        // 스마트 요소 화이트아웃 (삭제된 것만)
        ctx.fillStyle = 'white';
        smartElements.filter(el => el.pageIndex === currentPage - 1 && el.isDeleted).forEach(el => {
          const [cx, cy] = pdfjsLib.Util.transform(viewport.transform, [el.pdfX, el.pdfY]);
          const cw = el.width * scale;
          const ch = el.height * scale;
          ctx.fillRect(cx - 2, cy - ch - 2, cw + 4, ch + 4);
        });
      } catch (err) {
        console.error("렌더링 오류:", err);
      }
    };
    renderPage();
    return () => { isMounted = false; };
  }, [pdfDoc, currentPage, scale, status, smartElements]);

  // ==============================================
  // 스마트 요소 편집 핸들러
  // ==============================================
  const updateSmartText = (id: string, newText: string) => {
    setSmartElements(prev => prev.map(el => el.id === id ? { ...el, text: newText } : el));
  };

  const deleteSmartElement = (id: string) => {
    setSmartElements(prev => prev.map(el => el.id === id ? { ...el, isDeleted: true } : el));
  };

  // ==============================================
  // 기존 PdfEditor 기능 핸들러들
  // ==============================================
  const handleZoom = (type: "in" | "out" | "reset") => {
    if (type === "in") setScale(prev => Math.min(3.0, prev + 0.25));
    else if (type === "out") setScale(prev => Math.max(0.5, prev - 0.25));
    else setScale(1.5);
  };

  // 텍스트 박스 (기존 PDF 편집기와 동일)
  const handleAddText = (isTransparent: boolean = false) => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays, redactions);
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: 100 + (nextId % 5) * 20, y: 100 + (nextId % 5) * 20,
      width: 200, height: 36, fontSize: 16,
      isEdited: true, isNew: true, isTransparent, fontFamily: "NotoSansKR",
      pageIndex: currentPage,
    };
    setTextBoxes(prev => [...prev, newBox]);
    setSelectedTextId(newBox.id);
    setSelectedImageId(null);
    setNextId(prev => prev + 1);
  };

  const handleTextChange = useCallback((id: string, newText: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, text: newText, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleDeleteBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes(prev => prev.filter(b => b.id !== id));
    setSelectedTextId(prev => prev === id ? null : prev);
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions, setSelectedTextId]);

  const handleFontSizeChange = useCallback((id: string, delta: number) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, fontSize: Math.max(8, Math.min(72, b.fontSize + delta)), isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleFontFamilyChange = useCallback((id: string, fontFamily: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, fontFamily, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleToggleTransparent = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes(prev => prev.map(b => b.id === id ? { ...b, isTransparent: !b.isTransparent, isEdited: true } : b));
  }, [setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  // 텍스트 드래그
  const handleTextDragStart = useCallback((e: React.MouseEvent, boxId: string, startBoxX: number, startBoxY: number) => {
    e.preventDefault(); e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setSelectedTextId(boxId); setSelectedImageId(null); setDraggingTextId(boxId);
    const startX = e.clientX, startY = e.clientY;
    let rafId: number | null = null;
    const handleMove = (ev: MouseEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
        setTextBoxes(prev => prev.map(b => b.id === boxId ? { ...b, x: startBoxX + dx, y: startBoxY + dy } : b));
      });
    };
    const handleUp = () => { if (rafId) cancelAnimationFrame(rafId); setDraggingTextId(null); window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions, setSelectedTextId, setSelectedImageId]);

  // 텍스트 리사이즈
  const handleTextResizeStart = useCallback((e: React.MouseEvent, boxId: string, startW: number, startH: number) => {
    e.preventDefault(); e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setSelectedTextId(boxId); setSelectedImageId(null); setResizingTextId(boxId);
    const startX = e.clientX, startY = e.clientY;
    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;
      setTextBoxes(prev => prev.map(b => b.id === boxId ? { ...b, width: Math.max(20, startW + dx), height: Math.max(10, startH + dy) } : b));
    };
    const handleUp = () => { setResizingTextId(null); window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions, setSelectedTextId, setSelectedImageId]);

  // 더블클릭으로 텍스트 추가
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    saveHistory(textBoxes, imageOverlays, redactions);
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: x - 100, y: y - 18, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true, fontFamily: "NotoSansKR", pageIndex: currentPage,
    };
    setTextBoxes(prev => [...prev, newBox]);
    setSelectedTextId(newBox.id); setSelectedImageId(null);
    setNextId(prev => prev + 1);
  };

  // 이미지 업로드
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        const canvasW = canvas ? canvas.width / scale : 500;
        const canvasH = canvas ? canvas.height / scale : 700;
        const maxW = Math.min(300, canvasW * 0.4), maxH = Math.min(300, canvasH * 0.4);
        let w = img.width, h = img.height;
        const ratio = img.width / img.height;
        if (w > maxW) { w = maxW; h = w / ratio; }
        if (h > maxH) { h = maxH; w = h * ratio; }
        const x = Math.max(10, (canvasW - w) / 2), y = Math.max(10, (canvasH - h) / 2);
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
          removedBgSrc: null, x, y, width: w, height: h, pageIndex: currentPage,
        };
        setImageOverlays(prev => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
    e.target.value = "";
  };

  const handleImageUpdate = (id: string, updates: Partial<ImageOverlayData>) => {
    setImageOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };
  const handleImageDelete = (id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setImageOverlays(prev => prev.filter(o => o.id !== id));
    if (selectedImageId === id) setSelectedImageId(null);
  };

  // 서명
  const handleSignatureSave = (dataUrl: string, width: number, height: number) => {
    const maxW = 200; const ratio = width / height; const w = Math.min(width, maxW); const h = w / ratio;
    const newOverlay: ImageOverlayData = {
      id: `sig-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl, removedBgSrc: null,
      x: 100, y: 100, width: w, height: h, pageIndex: currentPage,
    };
    setImageOverlays(prev => [...prev, newOverlay]);
    setSelectedImageId(newOverlay.id);
    toast.success("서명이 추가되었습니다!");
  };

  // 블라인드
  const handleRedactMouseDown = (e: React.MouseEvent) => {
    if (!isRedactMode) return;
    const rect = canvasWrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawingRedaction({ startX: e.clientX - rect.left, startY: e.clientY - rect.top, currentX: e.clientX - rect.left, currentY: e.clientY - rect.top });
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
    const x = Math.min(startX, currentX) / scale, y = Math.min(startY, currentY) / scale;
    const w = Math.abs(currentX - startX) / scale, h = Math.abs(currentY - startY) / scale;
    if (w > 5 && h > 5) addRedaction({ pageIndex: currentPage, x, y, width: w, height: h });
    setDrawingRedaction(null);
  };

  // 내보내기
  const handleExport = async () => {
    if (!pdfBuffer) return;
    let defaultName = file?.name || "document.pdf";
    if (defaultName.toLowerCase().endsWith(".pdf")) defaultName = defaultName.slice(0, -4);
    setExportDefaultName(defaultName);
    setExportModal(true);
  };

  const handleExportConfirm = async (exportName: string) => {
    setExportModal(false);
    if (!pdfBuffer) return;
    const finalFileName = exportName.trim() === "" ? (file?.name || "document.pdf") : `${exportName.trim()}.pdf`;
    setIsProcessing(true);
    setStatusMsg("PDF 내보내기 중...");
    const toastId = toast.loading("PDF를 생성하고 있습니다...");
    try {
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, redactions, 1, finalFileName);
      toast.success("다운로드 완료!", { id: toastId });
    } catch (e: any) {
      console.error(e);
      toast.error("내보내기 실패", { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  // ==============================================
  // 업로드 화면
  // ==============================================
  if (!file) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center mt-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">✨ 스마트 워드 편집기</h1>
        <p className="text-lg text-gray-500 dark:text-white/70 mb-10">PDF를 업로드하면 표와 글씨를 자동 인식하여 웹에서 워드처럼 편집할 수 있습니다.</p>
        <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-2xl cursor-pointer bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <UploadCloud className="w-16 h-16 text-emerald-500 mb-4" />
          <span className="text-xl font-medium text-gray-700 dark:text-white">PDF 파일 드롭 또는 클릭하여 업로드</span>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  // ==============================================
  // 에디터 UI
  // ==============================================
  const hasContent = textBoxes.length > 0 || imageOverlays.length > 0 || smartElements.some(el => !el.isDeleted);

  return (
    <div className="flex flex-col h-full w-full max-w-full">
      <style>{`
        @font-face { font-family: "NotoSansKR"; src: url("/NotoSansKR-Regular.otf"); }
        @font-face { font-family: "NanumMyeongjo"; src: url("/NanumMyeongjo.ttf"); }
        @font-face { font-family: "Jua"; src: url("/Jua.ttf"); }
      `}</style>

      {/* ===== 툴바 ===== */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2 px-3 py-1">
          <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${status === "done" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : status === "error" ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">{statusMsg}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full">
          <button onClick={() => handleAddText(false)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            텍스트(흰배경)
          </button>
          <button onClick={() => handleAddText(true)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            텍스트(투명)
          </button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

          <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> 이미지
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <button onClick={() => setIsSignatureOpen(true)} disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            <Pen className="w-3.5 h-3.5 text-emerald-500" /> 서명/그리기
          </button>

          <button onClick={() => setIsRedactMode(p => !p)} disabled={status !== "done"}
            className={`flex items-center gap-1 px-2.5 py-1.5 border text-[11px] font-semibold rounded-md disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0 ${
              isRedactMode ? "bg-gray-900 text-white border-gray-900 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"
            }`}>
            <div className="w-3.5 h-3.5 bg-gray-900 dark:bg-gray-200 border border-white dark:border-gray-900 rounded-sm" /> 블라인드
          </button>

          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

          {numPages > 1 && (
            <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1}
                className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">이전</button>
              <span className="text-[10px] font-mono px-2 py-1 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 select-none">{currentPage}/{numPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))} disabled={currentPage >= numPages}
                className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-600">다음</button>
            </div>
          )}

          <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
            <button onClick={() => handleZoom("out")} disabled={scale <= 0.5}
              className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300"><Minus className="w-3 h-3" /></button>
            <span onClick={() => handleZoom("reset")}
              className="text-[10px] font-mono px-1.5 py-1 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border-x border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 select-none font-bold">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => handleZoom("in")} disabled={scale >= 3.0}
              className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300"><Plus className="w-3 h-3" /></button>
          </div>

          <button onClick={handleExport} disabled={isProcessing || !hasContent}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-[11px] font-semibold rounded-md shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap flex-shrink-0">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>

          <button onClick={() => { setFile(null); setSmartElements([]); resetElements(); setStatus("idle"); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-red-50 dark:hover:bg-red-900/30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
            다른 파일
          </button>
        </div>
      </div>

      {/* ===== 로딩 오버레이 ===== */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-lg font-medium text-gray-800 dark:text-white">{statusMsg}</p>
          </div>
        </div>
      )}

      {/* ===== 캔버스 + 오버레이 ===== */}
      <div className="border border-gray-300 dark:border-gray-600 shadow-2xl bg-gray-100 dark:bg-gray-900 overflow-auto rounded-lg flex-1 min-w-0 transition-all" style={{ minHeight: "600px" }}>
        <div ref={canvasWrapperRef}
             onDoubleClick={handleCanvasDoubleClick}
             onMouseDown={handleRedactMouseDown}
             onMouseMove={handleRedactMouseMove}
             onMouseUp={handleRedactMouseUp}
             onMouseLeave={handleRedactMouseUp}
             className={`relative mx-auto w-max bg-white ${isRedactMode ? "cursor-crosshair" : ""}`}>
          <canvas ref={canvasRef} className="block" />

          {/* 스마트 요소 오버레이 */}
          {status === "done" && smartElements.filter(el => el.pageIndex === currentPage - 1 && !el.isDeleted).map(el => {
            const canvas = canvasRef.current;
            if (!canvas) return null;
            const cx = el.pdfX * scale;
            const cy = canvas.height - (el.pdfY * scale);
            const cw = el.width * scale;
            const ch = el.height * scale;
            const top = cy - ch;
            const left = cx;

            if (el.type === 'rect') {
              return (
                <div key={el.id} className="absolute border border-gray-400/50 hover:border-red-500 group flex items-center justify-center"
                     style={{ top: `${top}px`, left: `${left}px`, width: `${cw}px`, height: `${ch}px` }}>
                  <button onClick={() => deleteSmartElement(el.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            } else {
              return (
                <div key={el.id} className="absolute group" style={{ top: `${top}px`, left: `${left}px`, width: `${Math.max(cw + 20, 40)}px` }}>
                  <input type="text" value={el.text || ''}
                    onChange={(e) => updateSmartText(el.id, e.target.value)}
                    className="w-full bg-transparent border border-transparent hover:border-blue-400 focus:border-blue-500 focus:bg-blue-50/80 text-black outline-none px-1"
                    style={{ fontSize: `${Math.max(ch * 0.85, 8)}px`, lineHeight: '1.2', fontFamily: 'sans-serif', height: `${ch}px` }}
                  />
                  <button onClick={() => deleteSmartElement(el.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            }
          })}

          {/* 기존 PdfEditor 오버레이: 텍스트 박스 */}
          {status === "done" && textBoxes.filter(box => box.pageIndex === currentPage).map(box => (
            <TextBoxOverlay key={box.id} box={box} scale={scale}
              isSelected={selectedTextId === box.id}
              onSelect={() => { setSelectedTextId(box.id); setSelectedImageId(null); }}
              isDragging={draggingTextId === box.id} isResizing={resizingTextId === box.id}
              onDragStart={handleTextDragStart} onResizeStart={handleTextResizeStart}
              onChange={handleTextChange} onDelete={handleDeleteBox}
              onFontSizeChange={handleFontSizeChange} onToggleTransparent={handleToggleTransparent}
              onFontFamilyChange={handleFontFamilyChange}
            />
          ))}

          {/* 기존 PdfEditor 오버레이: 이미지 */}
          {status === "done" && imageOverlays.filter(o => o.pageIndex === currentPage).map(overlay => (
            <ImageOverlayComponent key={overlay.id} overlay={overlay} scale={scale}
              onUpdate={handleImageUpdate} onDelete={handleImageDelete}
              isSelected={selectedImageId === overlay.id}
              onSelect={(id) => { setSelectedImageId(id); setSelectedTextId(null); }}
              onDragStart={() => saveHistory(textBoxes, imageOverlays, redactions)} />
          ))}

          {/* 블라인드 영역 */}
          {status === "done" && redactions.filter(r => r.pageIndex === currentPage).map(r => (
            <div key={r.id} className="absolute bg-gray-900 z-10" style={{ left: r.x * scale, top: r.y * scale, width: r.width * scale, height: r.height * scale }}>
              <button className={`absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md text-red-500 hover:text-red-700 opacity-0 hover:opacity-100 transition-opacity ${selectedRedactionId === r.id ? 'opacity-100' : ''}`}
                onClick={() => removeRedaction(r.id)} onMouseEnter={() => setSelectedRedactionId(r.id)} onMouseLeave={() => setSelectedRedactionId(null)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          {/* 블라인드 드로잉 중 */}
          {isRedactMode && drawingRedaction && (
            <div className="absolute bg-gray-900/80 border-2 border-gray-900 z-20" style={{
              left: Math.min(drawingRedaction.startX, drawingRedaction.currentX),
              top: Math.min(drawingRedaction.startY, drawingRedaction.currentY),
              width: Math.abs(drawingRedaction.currentX - drawingRedaction.startX),
              height: Math.abs(drawingRedaction.currentY - drawingRedaction.startY),
            }} />
          )}

          {/* 안내 */}
          {status === "done" && textBoxes.length === 0 && imageOverlays.length === 0 && redactions.length === 0 && smartElements.filter(e => !e.isDeleted).length === 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-gray-900/80 text-white text-xs font-semibold rounded-full shadow-lg backdrop-blur-sm pointer-events-none animate-bounce z-50">
              💡 빈 공간을 더블클릭하여 텍스트를 추가하세요
            </div>
          )}
        </div>
      </div>

      {/* ===== 서명 패드 ===== */}
      <SignaturePad isOpen={isSignatureOpen} onClose={() => setIsSignatureOpen(false)} onSave={handleSignatureSave} />

      {/* ===== 내보내기 모달 ===== */}
      <PromptModal isOpen={exportModal} title="PDF 내보내기" message="저장할 파일 이름을 입력하세요 (확장자 제외)"
        placeholder="파일 이름" defaultValue={exportDefaultName} confirmLabel="다운로드"
        onConfirm={handleExportConfirm} onCancel={() => setExportModal(false)} />
    </div>
  );
}
