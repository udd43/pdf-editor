import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UploadCloud, Download, Trash2, Loader2, Minus, Plus, Pen, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getFontBuffers } from '@/lib/fontCache';
import ImageOverlayComponent, { ImageOverlayData } from './ImageOverlay';
import SignaturePad from './SignaturePad';
import TextBoxOverlay from './TextBoxOverlay';
import { usePdfElements } from '@/hooks/usePdfElements';
import { PromptModal } from './Modal';
import { exportEditedPdf } from '@/lib/pdfUtils';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// === 추출된 요소 타입 ===
interface SmartText {
  id: string;
  text: string;
  x: number; // CSS 좌표 (좌측 상단 기준, pt)
  y: number;
  width: number;
  height: number;
  fontSize: number;
  pageIndex: number;
  isDeleted: boolean;
}

interface SmartLine {
  id: string;
  x1: number; y1: number; x2: number; y2: number;
  pageIndex: number;
  isDeleted: boolean;
}

interface SmartCell {
  id: string;
  x: number; y: number; width: number; height: number;
  text: string; // 유저가 칸 안에 쓰는 글
  pageIndex: number;
  isDeleted: boolean;
}

interface PageInfo {
  width: number;
  height: number;
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
  const [file, setFile] = useState<File | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.5);
  const [pages, setPages] = useState<PageInfo[]>([]);

  // 스마트 추출 요소
  const [smartTexts, setSmartTexts] = useState<SmartText[]>([]);
  const [smartLines, setSmartLines] = useState<SmartLine[]>([]);
  const [smartCells, setSmartCells] = useState<SmartCell[]>([]);

  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // 기존 PdfEditor 기능
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

  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // ========================================
  // 파일 업로드 → PDF 해체
  // ========================================
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected || selected.type !== "application/pdf") {
      if (selected) toast.error("PDF 파일만 업로드 가능합니다.");
      return;
    }
    setFile(selected);
    setIsProcessing(true);
    setStatus("processing");
    setStatusMsg("PDF를 해체하는 중...");
    try {
      const buffer = await selected.arrayBuffer();
      setPdfBuffer(buffer);
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const doc = await loadingTask.promise;
      setNumPages(doc.numPages);
      setCurrentPage(1);
      resetElements();

      await deconstructPdf(doc);
      setStatus("done");
      setStatusMsg("PDF 해체 완료! 텍스트를 수정하거나 칸에 글을 쓸 수 있습니다.");
    } catch (err) {
      console.error(err);
      toast.error("PDF 파싱 실패");
      setStatus("error");
    } finally {
      setIsProcessing(false);
    }
  };

  // ========================================
  // PDF 해체: 텍스트, 선, 칸 모두 추출
  // ========================================
  const deconstructPdf = async (doc: any) => {
    const texts: SmartText[] = [];
    const lines: SmartLine[] = [];
    const cells: SmartCell[] = [];
    const pageInfos: PageInfo[] = [];
    let elId = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 }); // 1:1 기준 (pt)
      const pageW = viewport.width;
      const pageH = viewport.height;
      pageInfos.push({ width: pageW, height: pageH });

      // --- 텍스트 추출 ---
      const textContent = await page.getTextContent();
      const rawTexts: any[] = [];
      textContent.items.forEach((item: any) => {
        if (!item.str || item.str.trim() === '') return;
        const fontSize = Math.sqrt(item.transform[2] ** 2 + item.transform[3] ** 2);
        rawTexts.push({
          text: item.str,
          pdfX: item.transform[4],
          pdfY: item.transform[5],
          width: item.width,
          height: item.height || fontSize,
          fontSize,
        });
      });

      // 같은 줄 텍스트 머지
      const lineGroups: any[] = [];
      rawTexts.forEach(item => {
        const match = lineGroups.find(l => Math.abs(l.pdfY - item.pdfY) < 3);
        if (match) match.items.push(item);
        else lineGroups.push({ pdfY: item.pdfY, items: [item] });
      });

      lineGroups.forEach(line => {
        line.items.sort((a: any, b: any) => a.pdfX - b.pdfX);
        let mergedText = "";
        let startX = line.items[0].pdfX;
        let totalWidth = 0;
        let maxHeight = 0;
        let maxFontSize = 0;
        line.items.forEach((item: any, idx: number) => {
          if (idx > 0) {
            const prev = line.items[idx - 1];
            const gap = item.pdfX - (prev.pdfX + prev.width);
            if (gap > prev.height * 0.3) mergedText += " ";
          }
          mergedText += item.text;
          totalWidth = (item.pdfX + item.width) - startX;
          if (item.height > maxHeight) maxHeight = item.height;
          if (item.fontSize > maxFontSize) maxFontSize = item.fontSize;
        });
        if (mergedText.trim()) {
          // PDF 좌표(좌하단) → CSS 좌표(좌상단) 변환
          const cssX = startX;
          const cssY = pageH - line.pdfY - maxHeight;
          texts.push({
            id: `st_${elId++}`, text: mergedText,
            x: cssX, y: cssY, width: totalWidth, height: maxHeight,
            fontSize: maxFontSize, pageIndex: pageNum - 1, isDeleted: false,
          });
        }
      });

      // --- 선분/사각형 추출 ---
      const opList = await page.getOperatorList();
      let currentTransform = [1, 0, 0, 1, 0, 0];
      let transformStack: number[][] = [];
      let lastX: number | null = null, lastY: number | null = null;
      let subX: number | null = null, subY: number | null = null;
      const rawSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];
      const rawRects: { x: number; y: number; w: number; h: number }[] = [];

      const applyT = (p: number[], m: number[]) => [p[0]*m[0]+p[1]*m[2]+m[4], p[0]*m[1]+p[1]*m[3]+m[5]];
      const mulT = (a: number[], b: number[]) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i], args = opList.argsArray[i];
        if (fn === 10) transformStack.push([...currentTransform]);
        else if (fn === 11 && transformStack.length) currentTransform = transformStack.pop()!;
        else if (fn === 12) currentTransform = mulT(currentTransform, args);
        else if (fn === 13) { const p = applyT([args[0], args[1]], currentTransform); lastX = p[0]; lastY = p[1]; subX = p[0]; subY = p[1]; }
        else if (fn === 14) { const p = applyT([args[0], args[1]], currentTransform); if (lastX !== null && lastY !== null) rawSegments.push({ x1: lastX, y1: lastY, x2: p[0], y2: p[1] }); lastX = p[0]; lastY = p[1]; }
        else if (fn === 18) { if (lastX !== null && lastY !== null && subX !== null && subY !== null) { rawSegments.push({ x1: lastX, y1: lastY, x2: subX, y2: subY }); lastX = subX; lastY = subY; } }
        else if (fn === 19) {
          const p1 = applyT([args[0], args[1]], currentTransform);
          const p3 = applyT([args[0]+args[2], args[1]+args[3]], currentTransform);
          const rx = Math.min(p1[0], p3[0]), ry = Math.min(p1[1], p3[1]);
          const rw = Math.abs(p3[0]-p1[0]), rh = Math.abs(p3[1]-p1[1]);
          if (rw > 2 && rh > 2) rawRects.push({ x: rx, y: ry, w: rw, h: rh });
          // 사각형의 4변을 선분으로도 추가
          rawSegments.push({ x1: rx, y1: ry, x2: rx+rw, y2: ry });
          rawSegments.push({ x1: rx+rw, y1: ry, x2: rx+rw, y2: ry+rh });
          rawSegments.push({ x1: rx+rw, y1: ry+rh, x2: rx, y2: ry+rh });
          rawSegments.push({ x1: rx, y1: ry+rh, x2: rx, y2: ry });
        }
      }

      // 선분 → CSS 좌표 변환 후 저장
      rawSegments.forEach(seg => {
        const cx1 = seg.x1, cy1 = pageH - seg.y1;
        const cx2 = seg.x2, cy2 = pageH - seg.y2;
        // 매우 짧은 선(2pt 미만) 제거
        const len = Math.sqrt((cx2-cx1)**2 + (cy2-cy1)**2);
        if (len < 2) return;
        lines.push({
          id: `sl_${elId++}`, x1: cx1, y1: cy1, x2: cx2, y2: cy2,
          pageIndex: pageNum - 1, isDeleted: false,
        });
      });

      // 셀 감지 (사각형 기반)
      const hSegs: { x1: number; x2: number; y: number }[] = [];
      const vSegs: { y1: number; y2: number; x: number }[] = [];
      rawSegments.forEach(seg => {
        const x1 = Math.min(seg.x1, seg.x2), x2 = Math.max(seg.x1, seg.x2);
        const y1 = Math.min(seg.y1, seg.y2), y2 = Math.max(seg.y1, seg.y2);
        if (y2 - y1 < 2 && x2 - x1 > 5) hSegs.push({ x1, x2, y: (y1+y2)/2 });
        else if (x2 - x1 < 2 && y2 - y1 > 5) vSegs.push({ y1, y2, x: (x1+x2)/2 });
      });

      const uniqueXs = Array.from(new Set(vSegs.map(v => Math.round(v.x)))).sort((a,b) => a-b);
      const uniqueYs = Array.from(new Set(hSegs.map(h => Math.round(h.y)))).sort((a,b) => a-b);

      for (let i = 0; i < uniqueXs.length-1; i++) {
        for (let j = i+1; j < uniqueXs.length; j++) {
          const x1 = uniqueXs[i], x2 = uniqueXs[j], w = x2-x1;
          if (w < 15) continue;
          const validH = hSegs.filter(h => h.x1-3 <= x1 && h.x2+3 >= x2);
          if (validH.length < 2) continue;
          for (let k = 0; k < uniqueYs.length-1; k++) {
            for (let m = k+1; m < uniqueYs.length; m++) {
              const y1 = uniqueYs[k], y2 = uniqueYs[m], h = Math.abs(y2-y1);
              if (h < 8 || h > 300) continue;
              if (!validH.some(hl => Math.abs(hl.y-y1)<3) || !validH.some(hl => Math.abs(hl.y-y2)<3)) continue;
              const hasL = vSegs.some(v => Math.abs(v.x-x1)<3 && v.y1-3<=Math.min(y1,y2) && v.y2+3>=Math.max(y1,y2));
              const hasR = vSegs.some(v => Math.abs(v.x-x2)<3 && v.y1-3<=Math.min(y1,y2) && v.y2+3>=Math.max(y1,y2));
              if (hasL && hasR) {
                const hasIntH = hSegs.some(hl => hl.y>Math.min(y1,y2)+3 && hl.y<Math.max(y1,y2)-3 && hl.x1<x2-3 && hl.x2>x1+3);
                const hasIntV = vSegs.some(v => v.x>x1+3 && v.x<x2-3 && v.y1<Math.max(y1,y2)-3 && v.y2>Math.min(y1,y2)+3);
                if (!hasIntH && !hasIntV) {
                  // PDF → CSS 좌표
                  const cssX = x1;
                  const cssY = pageH - Math.max(y1, y2);
                  cells.push({
                    id: `sc_${elId++}`, x: cssX, y: cssY, width: w, height: h,
                    text: '', pageIndex: pageNum - 1, isDeleted: false,
                  });
                }
              }
            }
          }
        }
      }

      // 명시적 사각형(rectangle 연산자)에서도 셀 추가
      rawRects.forEach(rect => {
        if (rect.w < 20 || rect.h < 10 || rect.h > 300) return;
        const cssX = rect.x;
        const cssY = pageH - rect.y - rect.h;
        // 중복 체크
        const isDup = cells.some(c => c.pageIndex === pageNum-1 && Math.abs(c.x-cssX)<5 && Math.abs(c.y-cssY)<5 && Math.abs(c.width-rect.w)<5 && Math.abs(c.height-rect.h)<5);
        if (!isDup) {
          cells.push({
            id: `sc_${elId++}`, x: cssX, y: cssY, width: rect.w, height: rect.h,
            text: '', pageIndex: pageNum - 1, isDeleted: false,
          });
        }
      });
    }

    setPages(pageInfos);
    setSmartTexts(texts);
    setSmartLines(lines);
    setSmartCells(cells);
  };

  // ========================================
  // 스마트 요소 편집 핸들러
  // ========================================
  const updateSmartText = (id: string, newText: string) => {
    setSmartTexts(prev => prev.map(t => t.id === id ? { ...t, text: newText } : t));
  };
  const deleteSmartText = (id: string) => {
    setSmartTexts(prev => prev.map(t => t.id === id ? { ...t, isDeleted: true } : t));
  };
  const updateCellText = (id: string, newText: string) => {
    setSmartCells(prev => prev.map(c => c.id === id ? { ...c, text: newText } : c));
  };
  const deleteSmartCell = (id: string) => {
    setSmartCells(prev => prev.map(c => c.id === id ? { ...c, isDeleted: true } : c));
  };
  const deleteSmartLine = (id: string) => {
    setSmartLines(prev => prev.map(l => l.id === id ? { ...l, isDeleted: true } : l));
  };

  // ========================================
  // 기존 PdfEditor 기능
  // ========================================
  const handleZoom = (type: "in" | "out" | "reset") => {
    if (type === "in") setScale(prev => Math.min(3.0, prev + 0.25));
    else if (type === "out") setScale(prev => Math.max(0.5, prev - 0.25));
    else setScale(1.5);
  };

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
    setSelectedTextId(newBox.id); setSelectedImageId(null);
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

  const handleTextDragStart = useCallback((e: React.MouseEvent, boxId: string, startBoxX: number, startBoxY: number) => {
    e.preventDefault(); e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setSelectedTextId(boxId); setSelectedImageId(null); setDraggingTextId(boxId);
    const startX = e.clientX, startY = e.clientY;
    let rafId: number | null = null;
    const handleMove = (ev: MouseEvent) => { if (rafId) cancelAnimationFrame(rafId); rafId = requestAnimationFrame(() => { const dx = (ev.clientX-startX)/scale, dy = (ev.clientY-startY)/scale; setTextBoxes(prev => prev.map(b => b.id === boxId ? { ...b, x: startBoxX+dx, y: startBoxY+dy } : b)); }); };
    const handleUp = () => { if (rafId) cancelAnimationFrame(rafId); setDraggingTextId(null); window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleTextResizeStart = useCallback((e: React.MouseEvent, boxId: string, startW: number, startH: number) => {
    e.preventDefault(); e.stopPropagation();
    saveHistory(textBoxes, imageOverlays, redactions);
    setResizingTextId(boxId);
    const startX = e.clientX, startY = e.clientY;
    const handleMove = (ev: MouseEvent) => { const dx = (ev.clientX-startX)/scale, dy = (ev.clientY-startY)/scale; setTextBoxes(prev => prev.map(b => b.id === boxId ? { ...b, width: Math.max(20, startW+dx), height: Math.max(10, startH+dy) } : b)); };
    const handleUp = () => { setResizingTextId(null); window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
    window.addEventListener("mousemove", handleMove); window.addEventListener("mouseup", handleUp);
  }, [scale, setTextBoxes, saveHistory, textBoxes, imageOverlays, redactions]);

  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    saveHistory(textBoxes, imageOverlays, redactions);
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력", x: x-100, y: y-18, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true, fontFamily: "NotoSansKR", pageIndex: currentPage,
    };
    setTextBoxes(prev => [...prev, newBox]);
    setSelectedTextId(newBox.id); setSelectedImageId(null); setNextId(prev => prev + 1);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const imgFile = e.target.files?.[0];
    if (!imgFile) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new window.Image();
      img.onload = () => {
        const pgInfo = pages[currentPage - 1];
        const canvasW = pgInfo ? pgInfo.width : 500;
        const canvasH = pgInfo ? pgInfo.height : 700;
        const maxW = Math.min(300, canvasW * 0.4), maxH = Math.min(300, canvasH * 0.4);
        let w = img.width, h = img.height; const ratio = w / h;
        if (w > maxW) { w = maxW; h = w / ratio; }
        if (h > maxH) { h = maxH; w = h * ratio; }
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
          removedBgSrc: null, x: (canvasW-w)/2, y: (canvasH-h)/2, width: w, height: h, pageIndex: currentPage,
        };
        setImageOverlays(prev => [...prev, newOverlay]);
        setSelectedImageId(newOverlay.id);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(imgFile);
    e.target.value = "";
  };

  const handleImageUpdate = (id: string, updates: Partial<ImageOverlayData>) => { setImageOverlays(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o)); };
  const handleImageDelete = (id: string) => { saveHistory(textBoxes, imageOverlays, redactions); setImageOverlays(prev => prev.filter(o => o.id !== id)); if (selectedImageId === id) setSelectedImageId(null); };

  const handleSignatureSave = (dataUrl: string, width: number, height: number) => {
    const maxW = 200; const ratio = width/height; const w = Math.min(width, maxW); const h = w/ratio;
    const newOverlay: ImageOverlayData = { id: `sig-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl, removedBgSrc: null, x: 100, y: 100, width: w, height: h, pageIndex: currentPage };
    setImageOverlays(prev => [...prev, newOverlay]); setSelectedImageId(newOverlay.id); toast.success("서명이 추가되었습니다!");
  };

  const handleRedactMouseDown = (e: React.MouseEvent) => { if (!isRedactMode) return; const rect = canvasWrapperRef.current?.getBoundingClientRect(); if (!rect) return; setDrawingRedaction({ startX: e.clientX-rect.left, startY: e.clientY-rect.top, currentX: e.clientX-rect.left, currentY: e.clientY-rect.top }); };
  const handleRedactMouseMove = (e: React.MouseEvent) => { if (!isRedactMode || !drawingRedaction) return; const rect = canvasWrapperRef.current?.getBoundingClientRect(); if (!rect) return; setDrawingRedaction(prev => prev ? { ...prev, currentX: e.clientX-rect.left, currentY: e.clientY-rect.top } : null); };
  const handleRedactMouseUp = () => { if (!isRedactMode || !drawingRedaction) return; const { startX, startY, currentX, currentY } = drawingRedaction; const x = Math.min(startX, currentX)/scale, y = Math.min(startY, currentY)/scale, w = Math.abs(currentX-startX)/scale, h = Math.abs(currentY-startY)/scale; if (w > 5 && h > 5) addRedaction({ pageIndex: currentPage, x, y, width: w, height: h }); setDrawingRedaction(null); };

  const handleExport = () => {
    if (!pdfBuffer) return;
    let name = file?.name || "document.pdf";
    if (name.toLowerCase().endsWith(".pdf")) name = name.slice(0, -4);
    setExportDefaultName(name);
    setExportModal(true);
  };

  const handleExportConfirm = async (exportName: string) => {
    setExportModal(false);
    if (!pdfBuffer) return;
    const finalFileName = exportName.trim() === "" ? (file?.name || "document.pdf") : `${exportName.trim()}.pdf`;
    setIsProcessing(true); setStatusMsg("PDF 생성 중...");
    const toastId = toast.loading("PDF 생성 중...");
    try {
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, redactions, 1, finalFileName);
      toast.success("다운로드 완료!", { id: toastId });
    } catch (e: any) { console.error(e); toast.error("내보내기 실패", { id: toastId }); } finally { setIsProcessing(false); }
  };

  // ========================================
  // 업로드 화면
  // ========================================
  if (!file) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center mt-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">✨ 스마트 워드 편집기</h1>
        <p className="text-lg text-gray-500 dark:text-white/70 mb-10">PDF를 업로드하면 텍스트·표·선을 모두 해체하여<br/>하얀 백지 위에 워드처럼 편집할 수 있습니다.</p>
        <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-2xl cursor-pointer bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <UploadCloud className="w-16 h-16 text-emerald-500 mb-4" />
          <span className="text-xl font-medium text-gray-700 dark:text-white">PDF 파일 클릭하여 업로드</span>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  // ========================================
  // 에디터 UI (워드 모드)
  // ========================================
  const pgInfo = pages[currentPage - 1] || { width: 595, height: 842 };

  return (
    <div className="flex flex-col h-full w-full max-w-full">
      <style>{`
        @font-face { font-family: "NotoSansKR"; src: url("/NotoSansKR-Regular.otf"); }
        @font-face { font-family: "NanumMyeongjo"; src: url("/NanumMyeongjo.ttf"); }
        @font-face { font-family: "Jua"; src: url("/Jua.ttf"); }
      `}</style>

      {/* 툴바 */}
      <div className="flex flex-col gap-1.5 mb-2">
        <div className="flex items-center gap-2 px-3 py-1">
          <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${status === "done" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : status === "error" ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
          <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">{statusMsg}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full">
          <button onClick={() => handleAddText(false)} disabled={status !== "done"} className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">텍스트(흰배경)</button>
          <button onClick={() => handleAddText(true)} disabled={status !== "done"} className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">텍스트(투명)</button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
          <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"} className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"><ImageIcon className="w-3.5 h-3.5 text-blue-500" /> 이미지</button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          <button onClick={() => setIsSignatureOpen(true)} disabled={status !== "done"} className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"><Pen className="w-3.5 h-3.5 text-emerald-500" /> 서명</button>
          <button onClick={() => setIsRedactMode(p => !p)} disabled={status !== "done"} className={`flex items-center gap-1 px-2.5 py-1.5 border text-[11px] font-semibold rounded-md disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0 ${isRedactMode ? "bg-gray-900 text-white border-gray-900" : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600"}`}><div className="w-3.5 h-3.5 bg-gray-900 dark:bg-gray-200 border border-white dark:border-gray-900 rounded-sm" /> 블라인드</button>
          <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
          {numPages > 1 && (
            <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
              <button onClick={() => setCurrentPage(p => Math.max(1, p-1))} disabled={currentPage <= 1} className="px-2 py-1 hover:bg-gray-50 disabled:opacity-30 text-[11px] font-bold text-gray-600 border-r border-gray-200">이전</button>
              <span className="text-[10px] font-mono px-2 py-1 text-gray-800 bg-gray-50 select-none">{currentPage}/{numPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(numPages, p+1))} disabled={currentPage >= numPages} className="px-2 py-1 hover:bg-gray-50 disabled:opacity-30 text-[11px] font-bold text-gray-600 border-l border-gray-200">다음</button>
            </div>
          )}
          <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
            <button onClick={() => handleZoom("out")} disabled={scale <= 0.5} className="p-1 hover:bg-gray-50 disabled:opacity-30 text-gray-600"><Minus className="w-3 h-3" /></button>
            <span onClick={() => handleZoom("reset")} className="text-[10px] font-mono px-1.5 py-1 text-gray-800 bg-white border-x border-gray-200 cursor-pointer hover:bg-gray-50 select-none font-bold">{Math.round(scale*100)}%</span>
            <button onClick={() => handleZoom("in")} disabled={scale >= 3.0} className="p-1 hover:bg-gray-50 disabled:opacity-30 text-gray-600"><Plus className="w-3 h-3" /></button>
          </div>
          <button onClick={handleExport} disabled={isProcessing} className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-[11px] font-semibold rounded-md shadow-sm hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-40 whitespace-nowrap flex-shrink-0"><Download className="w-3.5 h-3.5" /> 내보내기</button>
          <button onClick={() => { setFile(null); setSmartTexts([]); setSmartLines([]); setSmartCells([]); resetElements(); setStatus("idle"); }} className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 text-[11px] font-semibold rounded-md hover:bg-red-50 transition-all shadow-sm whitespace-nowrap flex-shrink-0">다른 파일</button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
            <p className="text-lg font-medium text-gray-800 dark:text-white">{statusMsg}</p>
          </div>
        </div>
      )}

      {/* ===== 워드 모드 캔버스 (하얀 백지 + DOM 요소) ===== */}
      <div className="border border-gray-300 dark:border-gray-600 shadow-2xl bg-gray-200 dark:bg-gray-900 overflow-auto rounded-lg flex-1 min-w-0" style={{ minHeight: "600px" }}>
        <div ref={canvasWrapperRef}
             onDoubleClick={handleCanvasDoubleClick}
             onMouseDown={handleRedactMouseDown} onMouseMove={handleRedactMouseMove}
             onMouseUp={handleRedactMouseUp} onMouseLeave={handleRedactMouseUp}
             className={`relative mx-auto bg-white shadow-xl ${isRedactMode ? "cursor-crosshair" : ""}`}
             style={{ width: `${pgInfo.width * scale}px`, height: `${pgInfo.height * scale}px` }}>

          {/* 선 (SVG) */}
          <svg className="absolute inset-0 pointer-events-none" width={pgInfo.width * scale} height={pgInfo.height * scale}>
            {smartLines.filter(l => l.pageIndex === currentPage - 1 && !l.isDeleted).map(l => (
              <line key={l.id} x1={l.x1 * scale} y1={l.y1 * scale} x2={l.x2 * scale} y2={l.y2 * scale}
                stroke="black" strokeWidth={1} />
            ))}
          </svg>

          {/* 칸 (셀) - 클릭하면 안에 글을 쓸 수 있음 */}
          {smartCells.filter(c => c.pageIndex === currentPage - 1 && !c.isDeleted).map(c => (
            <div key={c.id} className="absolute group" style={{
              left: `${c.x * scale}px`, top: `${c.y * scale}px`,
              width: `${c.width * scale}px`, height: `${c.height * scale}px`,
            }}>
              <input type="text" value={c.text} onChange={e => updateCellText(c.id, e.target.value)}
                placeholder="입력..."
                className="w-full h-full bg-transparent text-black outline-none px-1 text-center border border-transparent hover:border-blue-300 focus:border-blue-500 focus:bg-blue-50/30"
                style={{ fontSize: `${Math.max(c.height * scale * 0.5, 10)}px`, lineHeight: '1' }}
              />
              <button onClick={() => deleteSmartCell(c.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* 텍스트 (추출된 원본) */}
          {smartTexts.filter(t => t.pageIndex === currentPage - 1 && !t.isDeleted).map(t => (
            <div key={t.id} className="absolute group" style={{
              left: `${t.x * scale}px`, top: `${t.y * scale}px`,
              width: `${Math.max(t.width * scale + 20, 40)}px`,
            }}>
              <input type="text" value={t.text} onChange={e => updateSmartText(t.id, e.target.value)}
                className="w-full bg-transparent text-black outline-none px-0.5 border border-transparent hover:border-blue-400 focus:border-blue-500 focus:bg-blue-50/50"
                style={{ fontSize: `${Math.max(t.fontSize * scale * 0.85, 8)}px`, lineHeight: '1.2', height: `${t.height * scale}px`, fontFamily: 'sans-serif' }}
              />
              <button onClick={() => deleteSmartText(t.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* 기존 PdfEditor 오버레이: 텍스트 박스 */}
          {status === "done" && textBoxes.filter(b => b.pageIndex === currentPage).map(box => (
            <TextBoxOverlay key={box.id} box={box} scale={scale}
              isSelected={selectedTextId === box.id} onSelect={() => { setSelectedTextId(box.id); setSelectedImageId(null); }}
              isDragging={draggingTextId === box.id} isResizing={resizingTextId === box.id}
              onDragStart={handleTextDragStart} onResizeStart={handleTextResizeStart}
              onChange={handleTextChange} onDelete={handleDeleteBox}
              onFontSizeChange={handleFontSizeChange} onToggleTransparent={handleToggleTransparent}
              onFontFamilyChange={handleFontFamilyChange}
            />
          ))}

          {/* 이미지 오버레이 */}
          {status === "done" && imageOverlays.filter(o => o.pageIndex === currentPage).map(overlay => (
            <ImageOverlayComponent key={overlay.id} overlay={overlay} scale={scale}
              onUpdate={handleImageUpdate} onDelete={handleImageDelete}
              isSelected={selectedImageId === overlay.id}
              onSelect={(id) => { setSelectedImageId(id); setSelectedTextId(null); }}
              onDragStart={() => saveHistory(textBoxes, imageOverlays, redactions)} />
          ))}

          {/* 블라인드 */}
          {status === "done" && redactions.filter(r => r.pageIndex === currentPage).map(r => (
            <div key={r.id} className="absolute bg-gray-900 z-10" style={{ left: r.x*scale, top: r.y*scale, width: r.width*scale, height: r.height*scale }}>
              <button className={`absolute -top-3 -right-3 bg-white rounded-full p-1 shadow-md text-red-500 hover:text-red-700 opacity-0 hover:opacity-100 transition-opacity ${selectedRedactionId === r.id ? 'opacity-100' : ''}`}
                onClick={() => removeRedaction(r.id)} onMouseEnter={() => setSelectedRedactionId(r.id)} onMouseLeave={() => setSelectedRedactionId(null)}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {isRedactMode && drawingRedaction && (
            <div className="absolute bg-gray-900/80 border-2 border-gray-900 z-20" style={{
              left: Math.min(drawingRedaction.startX, drawingRedaction.currentX), top: Math.min(drawingRedaction.startY, drawingRedaction.currentY),
              width: Math.abs(drawingRedaction.currentX - drawingRedaction.startX), height: Math.abs(drawingRedaction.currentY - drawingRedaction.startY),
            }} />
          )}
        </div>
      </div>

      <SignaturePad isOpen={isSignatureOpen} onClose={() => setIsSignatureOpen(false)} onSave={handleSignatureSave} />
      <PromptModal isOpen={exportModal} title="PDF 내보내기" message="저장할 파일 이름을 입력하세요 (확장자 제외)"
        placeholder="파일 이름" defaultValue={exportDefaultName} confirmLabel="다운로드"
        onConfirm={handleExportConfirm} onCancel={() => setExportModal(false)} />
    </div>
  );
}
