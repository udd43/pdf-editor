"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { Download, Loader2, Plus, Image as ImageIcon, Scissors, Trash2, Move, Minus, ZoomIn, Pen } from "lucide-react";
import { exportEditedPdf } from "@/lib/pdfUtils";
import { koreanToRoman } from "@/lib/romanize";
import ImageOverlayComponent, { ImageOverlayData } from "./ImageOverlay";
import SignaturePad from "./SignaturePad";

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
  const [extractedTexts, setExtractedTexts] = useState<string[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlayData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [draggingTextId, setDraggingTextId] = useState<string | null>(null);
  const [resizingTextId, setResizingTextId] = useState<string | null>(null);
  const [scale, setScale] = useState(1.5);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [nextId, setNextId] = useState(0);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isSignatureOpen, setIsSignatureOpen] = useState(false);
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

        setStatus("done");
        setStatusMsg("PDF 로딩 완료! 필요한 곳을 더블클릭하거나 상단의 '텍스트 추가' 버튼을 누르세요.");
      } catch (error: any) {
        console.error("PDF/OCR 오류:", error);
        if (isMounted) { setStatus("error"); setStatusMsg("오류 발생"); setErrorDetail(error?.message || String(error)); }
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [file, scale]);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (status !== "done") return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
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
    const newBox: TextBox = {
      id: `new-${nextId}`, text: initialText,
      x: 100 + (nextId % 5) * 20, y: 100 + (nextId % 5) * 20, 
      width: Math.min(400, Math.max(200, initialText.length * 14)), 
      height: 36 + (initialText.split('\n').length - 1) * 20,
      fontSize: 16, isEdited: true, isNew: true, isTransparent, fontFamily: "NotoSansKR",
    };
    setTextBoxes((prev) => [...prev, newBox]);
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

  const handleToggleTransparent = (id: string) => {
    setTextBoxes((prev) => prev.map((b) => b.id === id ? { ...b, isTransparent: !b.isTransparent, isEdited: true } : b));
  };

  // 더블클릭으로 텍스트 추가
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    const newBox: TextBox = {
      id: `new-${nextId}`, text: "텍스트 입력",
      x: x - 100, y: y - 18, width: 200, height: 36,
      fontSize: 16, isEdited: true, isNew: true, fontFamily: "NotoSansKR",
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
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startBoxX = box.x;
    const startBoxY = box.y;

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
  };

  // 텍스트 박스 리사이즈
  const handleTextResizeStart = (e: React.MouseEvent, boxId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const box = textBoxes.find((b) => b.id === boxId);
    if (!box) return;
    setResizingTextId(boxId);
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = box.width;
    const startH = box.height;

    const handleMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale;
      const dy = (ev.clientY - startY) / scale;
      const newW = Math.max(60, startW + dx);
      const newH = Math.max(20, startH + dy);
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
        const { w, h, x, y } = getOptimizedImageCoords(img.width, img.height, imageOverlays.length);
        const newOverlay: ImageOverlayData = {
          id: `img-${Date.now()}`, originalSrc: dataUrl, displaySrc: dataUrl,
          removedBgSrc: null, x, y, width: w, height: h,
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
          removedBgSrc: resultUrl, x, y, width: w, height: h,
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
          removedBgSrc: null, x, y, width: w, height: h,
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

  // 단축키 지원 (삭제, 복사, 붙여넣기)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== "done") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedImageId) {
          setImageOverlays((prev) => prev.filter((o) => o.id !== selectedImageId));
          setSelectedImageId(null);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedImageId) {
          const target = imageOverlays.find(o => o.id === selectedImageId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify(target));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const copied = sessionStorage.getItem("pdfitor_clipboard_overlay");
        if (copied) {
          const target = JSON.parse(copied) as ImageOverlayData;
          const newOverlay: ImageOverlayData = {
            ...target,
            id: `copy-${Date.now()}`,
            x: target.x + 20,
            y: target.y + 20
          };
          setImageOverlays(prev => [...prev, newOverlay]);
          setSelectedImageId(newOverlay.id);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [status, selectedImageId, imageOverlays]);

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
    setStatusMsg("새 PDF를 생성하는 중...");
    try {
      await exportEditedPdf(pdfBuffer, textBoxes, imageOverlays, 1, finalFileName);
      setStatus("done");
      setStatusMsg("PDF가 다운로드되었습니다!");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setStatusMsg("PDF 내보내기 실패");
      setErrorDetail(e?.message || String(e));
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
    };
    setImageOverlays((prev) => [...prev, newOverlay]);
    setSelectedImageId(newOverlay.id);
    setStatusMsg("서명이 추가되었습니다! 드래그하여 원하는 위치로 이동하세요.");
  };

  const isLoading = status === "rendering" || status === "ocr";
  const hasContent = textBoxes.length > 0 || imageOverlays.length > 0;

  return (
    <div className="flex flex-col items-center w-full max-w-7xl mx-auto py-8">
      <style>{`
        @font-face { font-family: "NotoSansKR"; src: url("/NotoSansKR-Regular.otf"); }
        @font-face { font-family: "NanumMyeongjo"; src: url("/NanumMyeongjo.ttf"); }
        @font-face { font-family: "Jua"; src: url("/Jua.ttf"); }
      `}</style>
      {/* 툴바 */}
      <div className="w-full flex flex-wrap justify-between items-center mb-6 bg-white p-4 rounded-2xl border border-gray-200 gap-3 shadow-sm">
        <h2 className="text-sm font-bold text-gray-900 truncate max-w-xs px-2" style={{ fontFamily: "Inter, sans-serif" }}>
          📄 {file.name}
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <button onClick={handleRunOcr} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm"
            title="문서 내의 글자를 자동으로 인식하여 편집 가능한 박스로 만듭니다">
            📝 텍스트 자동 추출
          </button>
          <button onClick={() => handleAddText(false)} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            텍스트 추가(흰배경)
          </button>
          <button onClick={() => handleAddText(true)} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            텍스트 추가(투명)
          </button>
          <button onClick={handleAddRomanizedName} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-full hover:bg-blue-100 disabled:opacity-30 transition-all shadow-sm"
            title="한글 이름을 입력하면 소리나는 대로 영문으로 변환하여 추가합니다">
            영문명 변환
          </button>
          <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" /> 이미지 추가
          </button>
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          
          <button onClick={() => bgRemoveInputRef.current?.click()} disabled={status !== "done" || isRemovingBg}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            {isRemovingBg ? <Loader2 className="w-3.5 h-3.5 animate-spin text-pink-500" /> : <Scissors className="w-3.5 h-3.5 text-pink-500" />}
            누끼따기
          </button>
          <input ref={bgRemoveInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgRemoveUpload} />
          
          <button onClick={() => upscaleInputRef.current?.click()} disabled={status !== "done" || isUpscaling}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            {isUpscaling ? <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" /> : <ZoomIn className="w-3.5 h-3.5 text-purple-500" />}
            업스케일링
          </button>
          <input ref={upscaleInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpscaleUpload} />
          
          <button onClick={() => setIsSignatureOpen(true)} disabled={status !== "done"}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-semibold rounded-full hover:bg-gray-50 disabled:opacity-30 transition-all shadow-sm">
            <Pen className="w-3.5 h-3.5 text-emerald-500" /> 서명/그리기
          </button>
          
          <div className="w-[1px] h-6 bg-gray-200 mx-1" />
          
          {/* 확대 축소 버튼 */}
          <div className="flex items-center bg-white border border-gray-200 rounded-full overflow-hidden mr-1 shadow-sm">
            <button onClick={() => handleZoom("out")} disabled={status !== "done" || scale <= 0.5}
              className="p-2 hover:bg-gray-50 disabled:opacity-30 text-gray-600" title="축소">
              <Minus className="w-3.5 h-3.5" />
            </button>
            <span onClick={() => handleZoom("reset")} 
              className="text-[10px] font-mono px-3 py-1.5 text-gray-800 bg-white border-x border-gray-200 cursor-pointer hover:bg-gray-50 select-none font-bold" title="원래 크기 (1.5x)">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={() => handleZoom("in")} disabled={status !== "done" || scale >= 3.0}
              className="p-2 hover:bg-gray-50 disabled:opacity-30 text-gray-600" title="확대">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button onClick={handleExport} disabled={isLoading || !hasContent}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none">
            <Download className="w-3.5 h-3.5" /> 내보내기
          </button>
        </div>
      </div>

      {/* 상태 메시지 */}
      <div className={`w-full mb-4 px-4 py-3 rounded-xl text-xs font-semibold border ${
        status === "error" ? "bg-red-50 border-red-200 text-red-700"
        : status === "done" && hasContent ? "bg-blue-50 border-blue-200 text-blue-700"
        : status === "done" ? "bg-gray-50 border-gray-200 text-gray-700"
        : "bg-indigo-50 border-indigo-200 text-indigo-700"
      }`}>
        {isLoading && <span className="inline-block mr-2 animate-spin">⏳</span>}
        {status === "done" && hasContent && "✏️ "}
        {status === "error" && "❌ "}
        {statusMsg}
        {status === "done" && (
          <span className="ml-2 text-gray-500 text-[10px] font-normal">
            드래그: 이동 | 우하단: 크기 조절 | A+/A-: 폰트 크기 | 더블클릭: 추가
          </span>
        )}
        {status === "error" && errorDetail && (
          <span className="block mt-1 text-[10px] text-red-500 font-mono">{errorDetail}</span>
        )}
      </div>

      {status === "ocr" && (
        <div className="w-full mb-4 bg-gray-100 border border-gray-200 rounded-full h-3.5 p-[2px] overflow-hidden">
          <div className="bg-blue-600 h-full rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
        </div>
      )}

      {isRemovingBg && (
        <div className="w-full mb-4 bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm font-medium flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> AI로 배경을 제거하는 중입니다...
        </div>
      )}

      <div className={`flex w-full gap-6 items-start ${extractedTexts.length > 0 ? "justify-start" : "justify-center"} overflow-x-auto pb-8`}>
        {/* PDF 컨테이너 */}
        <div 
          ref={containerRef}
          onDoubleClick={handleCanvasDoubleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border shadow-2xl bg-white overflow-auto rounded-lg shrink-0 transition-all ${
            isDragOver ? "ring-4 ring-indigo-500 ring-offset-2 scale-[1.01]" : ""
          }`}
          style={{ minHeight: "600px" }}
        >
          <canvas ref={canvasRef} className="block" />

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
          {status === "done" && textBoxes.map((box) => (
            <div key={box.id} className="absolute group"
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                left: `${box.x * scale}px`, top: `${box.y * scale}px`,
                width: `${box.width * scale}px`, height: `${box.height * scale}px`,
                zIndex: draggingTextId === box.id || resizingTextId === box.id ? 30 : 10,
              }}>

              {/* 상단 컨트롤 바 */}
              <div className="absolute -top-8 left-0 flex items-center gap-0.5 bg-white rounded-lg shadow-md border px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-30">
                <div onMouseDown={(e) => handleTextDragStart(e, box.id)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing">
                  <Move className="w-3.5 h-3.5" />
                </div>
                <select 
                  value={box.fontFamily || "NotoSansKR"}
                  onChange={(e) => setTextBoxes(prev => prev.map(b => b.id === box.id ? { ...b, fontFamily: e.target.value, isEdited: true } : b))}
                  className="text-[11px] font-medium border-r bg-transparent outline-none px-1.5 py-0.5 text-gray-600 hover:bg-gray-50 cursor-pointer"
                >
                  <option value="NotoSansKR">기본고딕</option>
                  <option value="NanumMyeongjo">명조체</option>
                  <option value="Jua">주아체(둥근)</option>
                </select>
                <button onClick={() => handleToggleTransparent(box.id)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded text-[10px]">
                  {box.isTransparent ? "🔳" : "⬜"}
                </button>
                <button onClick={() => handleFontSizeChange(box.id, -2)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] font-mono text-gray-400 min-w-[24px] text-center select-none">{box.fontSize}</span>
                <button onClick={() => handleFontSizeChange(box.id, 2)}
                  className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDeleteBox(box.id)}
                  className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <textarea value={box.text}
                onChange={(e) => handleTextChange(box.id, e.target.value)}
                className="w-full h-full resize-none overflow-hidden p-1 m-0 leading-snug cursor-pointer focus:cursor-text rounded-sm"
                style={{
                  fontSize: `${box.fontSize * scale}px`,
                  fontFamily: box.fontFamily || "NotoSansKR",
                  whiteSpace: "pre-wrap",
                  backgroundColor: box.isTransparent ? "transparent" : "#fff",
                  color: "#000",
                  border: box.isNew ? "2px solid rgba(34,197,94,0.6)" : box.isEdited ? "2px solid rgba(245,158,11,0.5)" : "1px solid rgba(59,130,246,0.3)",
                  outline: "none",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                }}
              />

              <div onMouseDown={(e) => handleTextResizeStart(e, box.id)}
                className="absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border-2 border-white shadow opacity-0 group-hover:opacity-100 transition-opacity z-30" />
            </div>
          ))}

          {/* 이미지 오버레이 */}
          {status === "done" && imageOverlays.map((overlay) => (
            <ImageOverlayComponent key={overlay.id} overlay={overlay} scale={scale}
              onUpdate={handleImageUpdate} onDelete={handleImageDelete}
              isSelected={selectedImageId === overlay.id} onSelect={setSelectedImageId} />
          ))}
        </div>

        {/* 텍스트 목록 사이드바 */}
        {extractedTexts.length > 0 && (
          <div className="w-80 shrink-0 flex flex-col bg-white border border-gray-200 shadow-sm rounded-2xl h-[80vh] sticky top-24 overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-700">📑 추출된 텍스트 ({extractedTexts.length})</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(extractedTexts.join('\n'));
                  alert('클립보드에 전체 텍스트가 복사되었습니다!');
                }}
                className="text-[10px] px-2.5 py-1 bg-white text-gray-700 rounded-full border border-gray-200 hover:bg-gray-50 font-semibold transition-all shadow-sm"
              >
                전체 복사
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
              {extractedTexts.map((text, idx) => (
                <div key={idx} 
                  onDoubleClick={() => handleAddText(true, text)}
                  title="더블클릭하여 PDF에 텍스트 상자로 추가"
                  className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-700 whitespace-pre-wrap shadow-sm cursor-pointer hover:bg-blue-50 hover:border-blue-200 transition-all group relative"
                >
                  {text}
                  <div className="text-[9px] text-blue-600 opacity-0 group-hover:opacity-100 mt-1.5 font-bold transition-opacity">
                    ✨ 더블클릭하여 PDF에 추가
                  </div>
                </div>
              ))}
            </div>
          </div>
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
