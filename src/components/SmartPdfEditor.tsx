import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Sparkles, Download, Trash2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getFontBuffers } from '@/lib/fontCache';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface PdfElement {
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

export default function SmartPdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<ArrayBuffer | null>(null);
  const [elements, setElements] = useState<PdfElement[]>([]);
  const [scale, setScale] = useState(1.5);
  const [numPages, setNumPages] = useState(0);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
      setIsProcessing(true);
      setStatusMsg("PDF 구조 분석 중...");
      try {
        const buffer = await selected.arrayBuffer();
        setFileBuffer(buffer);
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const doc = await loadingTask.promise;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        
        await extractElements(doc);
      } catch (err) {
        console.error(err);
        toast.error("PDF 파싱 실패");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const extractElements = async (doc: any) => {
    const newElements: PdfElement[] = [];
    let elementId = 0;

    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      
      // 1. Text Extraction
      const textContent = await page.getTextContent();
      const pageTexts: any[] = [];
      textContent.items.forEach((item: any) => {
        if (!item.str || item.str.trim() === '') return;
        const fontSize = Math.sqrt(item.transform[2] * item.transform[2] + item.transform[3] * item.transform[3]);
        pageTexts.push({
          text: item.str,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          height: item.height || fontSize
        });
      });

      // Merge Texts (Heuristic)
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
            id: `el_${elementId++}`,
            type: 'text',
            text: mergedText,
            pdfX: startX,
            pdfY: line.y,
            width: totalWidth,
            height: maxHeight,
            isDeleted: false,
            pageIndex: pageNum - 1
          });
        }
      });

      // 2. Grid Extraction
      const opList = await page.getOperatorList();
      const pageRects: any[] = [];
      let currentTransform = [1, 0, 0, 1, 0, 0];
      let transformStack: number[][] = [];
      let lastX: number | null = null;
      let lastY: number | null = null;
      let subpathStartX: number | null = null;
      let subpathStartY: number | null = null;
      const segments: any[] = [];

      const applyTransform = (p: number[], m: number[]) => [
        p[0] * m[0] + p[1] * m[2] + m[4],
        p[0] * m[1] + p[1] * m[3] + m[5]
      ];
      
      const transformMatrix = (m1: number[], m2: number[]) => [
        m1[0] * m2[0] + m1[2] * m2[1], m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3], m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4], m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
      ];

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];
        if (fn === 10) transformStack.push([...currentTransform]);
        else if (fn === 11 && transformStack.length) currentTransform = transformStack.pop()!;
        else if (fn === 12) currentTransform = transformMatrix(currentTransform, args);
        else if (fn === 13) {
          const p = applyTransform([args[0], args[1]], currentTransform);
          lastX = p[0]; lastY = p[1];
          subpathStartX = p[0]; subpathStartY = p[1];
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
          const p3 = applyTransform([args[0] + args[2], args[1] + args[3]], currentTransform);
          const x = Math.min(p1[0], p3[0]);
          const y = Math.min(p1[1], p3[1]);
          const w = Math.abs(p3[0] - p1[0]);
          const h = Math.abs(p3[1] - p1[1]);
          if (w > 20 && h > 10 && h < 300) pageRects.push({ x, y, width: w, height: h });
        }
      }

      const hLines: any[] = [];
      const vLines: any[] = [];
      segments.forEach(seg => {
        const x1 = Math.min(seg.x1, seg.x2);
        const x2 = Math.max(seg.x1, seg.x2);
        const y1 = Math.min(seg.y1, seg.y2);
        const y2 = Math.max(seg.y1, seg.y2);
        if (y2 - y1 < 2) hLines.push({ x1, x2, y: (y1 + y2) / 2 });
        else if (x2 - x1 < 2) vLines.push({ y1, y2, x: (x1 + x2) / 2 });
      });

      const uniqueXs = Array.from(new Set(vLines.map(v => Math.round(v.x)))).sort((a, b) => a - b);
      const uniqueYs = Array.from(new Set(hLines.map(h => Math.round(h.y)))).sort((a, b) => a - b);

      for (let i = 0; i < uniqueXs.length - 1; i++) {
        for (let j = i + 1; j < uniqueXs.length; j++) {
          const x1 = uniqueXs[i];
          const x2 = uniqueXs[j];
          const w = x2 - x1;
          if (w < 20) continue;
          const validHLines = hLines.filter(h => h.x1 - 3 <= x1 && h.x2 + 3 >= x2);
          if (validHLines.length < 2) continue;

          for (let k = 0; k < uniqueYs.length - 1; k++) {
            for (let m = k + 1; m < uniqueYs.length; m++) {
              const y1 = uniqueYs[k];
              const y2 = uniqueYs[m];
              const h = Math.abs(y2 - y1);
              if (h < 10 || h > 300) continue;

              const hasTop = validHLines.some(hL => Math.abs(hL.y - y1) < 3);
              const hasBottom = validHLines.some(hL => Math.abs(hL.y - y2) < 3);
              if (!hasTop || !hasBottom) continue;

              const hasLeft = vLines.some(v => Math.abs(v.x - x1) < 3 && v.y1 - 3 <= Math.min(y1, y2) && v.y2 + 3 >= Math.max(y1, y2));
              const hasRight = vLines.some(v => Math.abs(v.x - x2) < 3 && v.y1 - 3 <= Math.min(y1, y2) && v.y2 + 3 >= Math.max(y1, y2));
              
              if (hasLeft && hasRight) {
                const hasInternalHLine = hLines.some(hL => hL.y > Math.min(y1, y2) + 3 && hL.y < Math.max(y1, y2) - 3 && hL.x1 < x2 - 3 && hL.x2 > x1 + 3);
                const hasInternalVLine = vLines.some(v => v.x > x1 + 3 && v.x < x2 - 3 && v.y1 < Math.max(y1, y2) - 3 && v.y2 > Math.min(y1, y2) + 3);
                if (!hasInternalHLine && !hasInternalVLine) {
                  pageRects.push({ x: x1, y: Math.min(y1, y2), width: w, height: h });
                }
              }
            }
          }
        }
      }

      const filteredRects: any[] = [];
      pageRects.forEach(rect => {
        const isDuplicate = filteredRects.some(f => Math.abs(f.x - rect.x) < 3 && Math.abs(f.y - rect.y) < 3 && Math.abs(f.width - rect.width) < 3 && Math.abs(f.height - rect.height) < 3);
        if (!isDuplicate) filteredRects.push(rect);
      });

      filteredRects.forEach(rect => {
        newElements.push({
          id: `el_${elementId++}`,
          type: 'rect',
          pdfX: rect.x,
          pdfY: rect.y,
          width: rect.width,
          height: rect.height,
          isDeleted: false,
          pageIndex: pageNum - 1
        });
      });
    }

    setElements(newElements);
  };

  useEffect(() => {
    if (!pdfDoc) return;
    
    const renderPages = async () => {
      for (let i = 0; i < numPages; i++) {
        const page = await pdfDoc.getPage(i + 1);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRefs.current[i];
        if (!canvas) continue;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Whiteout extracted elements
        ctx.fillStyle = 'white';
        elements.filter(el => el.pageIndex === i).forEach(el => {
          // Calculate Canvas coordinates from PDF coordinates
          const [cx, cy] = pdfjsLib.Util.transform(viewport.transform, [el.pdfX, el.pdfY]);
          const cw = el.width * scale;
          const ch = el.height * scale;
          // In PDF, Y goes up. So pdfY is the bottom. cy is the bottom in Canvas.
          // fillRect needs top-left Y, which is cy - ch.
          ctx.fillRect(cx - 2, cy - ch - 2, cw + 4, ch + 4);
        });
      }
    };
    
    renderPages();
  }, [pdfDoc, numPages, scale, elements.length]);

  const updateElementText = (id: string, newText: string) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, text: newText } : el));
  };

  const deleteElement = (id: string) => {
    setElements(prev => prev.map(el => el.id === id ? { ...el, isDeleted: true } : el));
  };

  const downloadPdf = async () => {
    if (!fileBuffer) return;
    setIsProcessing(true);
    setStatusMsg("PDF 생성 중...");
    
    try {
      const libDoc = await PDFDocument.load(fileBuffer.slice(0));
      libDoc.registerFontkit(fontkit);
      const fontBuffers = await getFontBuffers();
      let customFont: any;
      let isKoreanFont = false;
      try {
        if (fontBuffers.Jua) { customFont = await libDoc.embedFont(fontBuffers.Jua); isKoreanFont = true; }
        else if (fontBuffers.NanumMyeongjo) { customFont = await libDoc.embedFont(fontBuffers.NanumMyeongjo); isKoreanFont = true; }
        else if (fontBuffers.NotoSansKR) { customFont = await libDoc.embedFont(fontBuffers.NotoSansKR); isKoreanFont = true; }
        else { customFont = await libDoc.embedFont(StandardFonts.Helvetica); isKoreanFont = false; }
      } catch (err) {
        customFont = await libDoc.embedFont(StandardFonts.Helvetica);
      }

      for (let i = 0; i < numPages; i++) {
        const page = libDoc.getPage(i);
        const pageElements = elements.filter(el => el.pageIndex === i);
        
        // 1. Whiteout ALL original extracted elements permanently
        pageElements.forEach(el => {
          page.drawRectangle({
            x: el.pdfX - 2,
            y: el.pdfY - 2,
            width: el.width + 4,
            height: el.height + 4,
            color: rgb(1, 1, 1),
          });
        });

        // 2. Draw non-deleted elements
        pageElements.forEach(el => {
          if (el.isDeleted) return;
          if (el.type === 'text') {
            if (isKoreanFont && el.text) {
              try {
                page.drawText(el.text, {
                  x: el.pdfX,
                  y: el.pdfY,
                  font: customFont,
                  size: el.height,
                  color: rgb(0,0,0)
                });
              } catch {}
            }
          } else if (el.type === 'rect') {
            page.drawRectangle({
              x: el.pdfX,
              y: el.pdfY,
              width: el.width,
              height: el.height,
              borderColor: rgb(0,0,0),
              borderWidth: 1,
            });
          }
        });
      }

      const pdfBytes = await libDoc.save();
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `edited_${file?.name || 'document.pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("저장 완료!");
    } catch (err) {
      console.error(err);
      toast.error("저장 실패");
    } finally {
      setIsProcessing(false);
    }
  };

  if (!file) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center mt-20">
        <h1 className="text-4xl font-extrabold tracking-tight text-white mb-6">스마트 워드 편집기</h1>
        <p className="text-lg text-white/70 mb-10">PDF를 업로드하면 표와 글씨를 웹에서 워드처럼 맘대로 수정하고 지울 수 있습니다.</p>
        <label className="flex flex-col items-center justify-center w-full h-80 border-2 border-dashed rounded-2xl cursor-pointer bg-white/5 border-white/10 hover:bg-white/10 transition-colors">
          <UploadCloud className="w-16 h-16 text-emerald-400 mb-4" />
          <span className="text-xl font-medium text-white">PDF 파일 드롭 또는 클릭하여 업로드</span>
          <input type="file" className="hidden" accept=".pdf" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="flex justify-between items-center mb-6 max-w-5xl mx-auto">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="text-emerald-400" />
          워드 모드 편집 중
        </h2>
        <div className="flex items-center gap-4">
          <button onClick={() => { setFile(null); setElements([]); }} className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
            취소
          </button>
          <button onClick={downloadPdf} disabled={isProcessing} className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg transition-colors">
            {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
            PDF 다운로드
          </button>
        </div>
      </div>

      {isProcessing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-2xl flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-emerald-400 animate-spin" />
            <p className="text-lg font-medium">{statusMsg}</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto bg-gray-800 p-8 rounded-2xl overflow-x-auto border border-gray-700">
        {Array.from({ length: numPages }).map((_, i) => (
          <div key={i} className="relative mx-auto mb-8 bg-white shadow-2xl" style={{ width: 'fit-content' }}>
            <canvas ref={el => canvasRefs.current[i] = el} className="block" />
            
            {/* DOM Overlay Layer */}
            {elements.filter(el => el.pageIndex === i && !el.isDeleted).map(el => {
              // Calculate CSS positioning based on canvas scaling
              // Using a simple top/left approach based on viewport math:
              // el.pdfX, el.pdfY are PDF coords.
              // We need standard canvas coordinates. We know scale.
              // Assuming standard PDF page is A4 size (e.g., 595x842)
              // We should just use absolute CSS with exact pixels.
              
              const isRect = el.type === 'rect';
              // Since viewport.transform is generally [scale, 0, 0, -scale, 0, viewport.height]
              // X = pdfX * scale
              // Y = viewport.height - (pdfY * scale)
              // Wait, in canvas CSS we just need the same math as applyTransform.
              // To make it easy, we will rely on refs inside render loop? No, React state.
              
              // We need page height to convert Y.
              const canvas = canvasRefs.current[i];
              if (!canvas) return null;
              
              const cx = el.pdfX * scale;
              const cy = canvas.height - (el.pdfY * scale); // canvas Y of bottom-left
              const cw = el.width * scale;
              const ch = el.height * scale;
              
              const top = cy - ch;
              const left = cx;

              if (isRect) {
                return (
                  <div key={el.id} className="absolute border border-black/50 hover:border-red-500 group flex items-center justify-center"
                       style={{ top: `${top}px`, left: `${left}px`, width: `${cw}px`, height: `${ch}px` }}>
                    <button onClick={() => deleteElement(el.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              } else {
                return (
                  <div key={el.id} className="absolute group"
                       style={{ top: `${top}px`, left: `${left}px`, width: `${cw+20}px` }}>
                    <input
                      type="text"
                      value={el.text || ''}
                      onChange={(e) => updateElementText(el.id, e.target.value)}
                      className="bg-transparent border border-transparent hover:border-blue-400 focus:border-blue-500 focus:bg-blue-50/50 text-black outline-none px-1"
                      style={{ fontSize: `${ch}px`, lineHeight: 1, fontFamily: 'sans-serif' }}
                    />
                    <button onClick={() => deleteElement(el.id)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              }
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
