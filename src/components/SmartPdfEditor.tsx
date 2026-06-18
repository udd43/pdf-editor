import React, { useState, useEffect } from 'react';
import { UploadCloud, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getFontBuffers } from '@/lib/fontCache';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
}

export default function SmartPdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else if (selected) {
      toast.error("PDF 파일만 업로드 가능합니다.");
    }
  };

  useEffect(() => {
    if (!file) return;

    const convertToAcroForm = async () => {
      setIsConverting(true);
      setStatusMsg("PDF 구조 분석 중...");
      try {
        const fileBuffer = await file.arrayBuffer();
        
        // 1. pdfjs-dist로 페이지별 텍스트 및 사각형 데이터 추출
        const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
        const pdfDoc = await loadingTask.promise;
        const numPages = pdfDoc.numPages;

        const pageData: { texts: Rect[], rects: Rect[] }[] = [];

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 }); // 1:1 스케일 (PDF 포인트 기준)
          
          const textContent = await page.getTextContent();
          const pageTexts: Rect[] = [];

          textContent.items.forEach((item: any) => {
            if (!item.str || item.str.trim() === '') return;
            // 순수 PDF 좌표계 (Transform의 4번째, 5번째 값)
            const fontSize = Math.sqrt(item.transform[2] * item.transform[2] + item.transform[3] * item.transform[3]);
            pageTexts.push({
              text: item.str,
              x: item.transform[4],
              y: item.transform[5], // Baseline Y
              width: item.width,
              height: item.height || fontSize
            });
          });

          // 휴리스틱 라인 묶기
          const lines: any[] = [];
          pageTexts.forEach(item => {
            const match = lines.find(l => Math.abs(l.y - item.y) < 3);
            if (match) match.items.push(item);
            else lines.push({ y: item.y, items: [item] });
          });

          const mergedTexts: Rect[] = [];
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
            mergedTexts.push({ text: mergedText, x: startX, y: line.y, width: totalWidth, height: maxHeight });
          });

          // 연산자에서 빈칸(사각형) 추출
          const opList = await page.getOperatorList();
          const pageRects: Rect[] = [];
          
          let currentTransform = [1, 0, 0, 1, 0, 0]; // Identity Matrix (순수 PDF 좌표계)
          let transformStack: number[][] = [];
          
          let lastX: number | null = null;
          let lastY: number | null = null;
          let subpathStartX: number | null = null;
          let subpathStartY: number | null = null;
          
          const segments: {x1: number, y1: number, x2: number, y2: number}[] = [];

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
            if (fn === 10) { transformStack.push([...currentTransform]); } // save
            else if (fn === 11 && transformStack.length) { currentTransform = transformStack.pop()!; } // restore
            else if (fn === 12) { currentTransform = transformMatrix(currentTransform, args); } // transform
            else if (fn === 13) { // moveTo
              const p = applyTransform([args[0], args[1]], currentTransform);
              lastX = p[0]; lastY = p[1];
              subpathStartX = p[0]; subpathStartY = p[1];
            }
            else if (fn === 14) { // lineTo
              const p = applyTransform([args[0], args[1]], currentTransform);
              if (lastX !== null && lastY !== null) {
                segments.push({ x1: lastX, y1: lastY, x2: p[0], y2: p[1] });
              }
              lastX = p[0]; lastY = p[1];
            }
            else if (fn === 18) { // closePath
              if (lastX !== null && lastY !== null && subpathStartX !== null && subpathStartY !== null) {
                segments.push({ x1: lastX, y1: lastY, x2: subpathStartX, y2: subpathStartY });
                lastX = subpathStartX; lastY = subpathStartY;
              }
            }
            else if (fn === 19) { // rectangle
              const p1 = applyTransform([args[0], args[1]], currentTransform);
              const p3 = applyTransform([args[0] + args[2], args[1] + args[3]], currentTransform);
              const x = Math.min(p1[0], p3[0]);
              const y = Math.min(p1[1], p3[1]); // PDF 좌표계이므로 작은 값이 하단(Bottom)
              const w = Math.abs(p3[0] - p1[0]);
              const h = Math.abs(p3[1] - p1[1]);
              
              if (w > 20 && h > 10 && h < 300) {
                pageRects.push({ x, y, width: w, height: h });
              }
            }
          }

          // 선 교차점 알고리즘 (Grid Detection)
          const hLines: {x1: number, x2: number, y: number}[] = [];
          const vLines: {y1: number, y2: number, x: number}[] = [];
          
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
                      pageRects.push({ x: x1, y: Math.min(y1, y2), width: w, height: h }); // PDF 좌표계는 하단 Y 기준
                    }
                  }
                }
              }
            }
          }

          // 중복 사각형(Rectangle + Grid 교차점) 제거
          const filteredRects: Rect[] = [];
          pageRects.forEach(rect => {
            const isDuplicate = filteredRects.some(f => 
              Math.abs(f.x - rect.x) < 3 && 
              Math.abs(f.y - rect.y) < 3 && 
              Math.abs(f.width - rect.width) < 3 && 
              Math.abs(f.height - rect.height) < 3
            );
            if (!isDuplicate) filteredRects.push(rect);
          });

          pageData.push({ texts: mergedTexts, rects: filteredRects });
        }

        // 2. pdf-lib로 새로운 PDF(AcroForm) 생성
        setStatusMsg("입력 가능한 스마트 폼(AcroForm) 생성 중...");
        const libDoc = await PDFDocument.load(fileBuffer);
        libDoc.registerFontkit(fontkit);
        
        const fontBuffers = await getFontBuffers();
        const customFont = await libDoc.embedFont(fontBuffers.NotoSansKR || fontBuffers.NanumMyeongjo!);
        
        const form = libDoc.getForm();
        let fieldCounter = 0;

        for (let i = 0; i < numPages; i++) {
          const page = libDoc.getPage(i);
          const { height: pageHeight } = page.getSize();
          const data = pageData[i];

          // 텍스트를 먼저 폼으로 변환 (원본 텍스트 화이트아웃 처리 후 위에 폼 배치)
          data.texts.forEach(t => {
            // 원본 글씨 하얗게 지우기 (White-out)
            page.drawRectangle({
              x: t.x - 2,
              y: t.y - 2,
              width: t.width + 4,
              height: t.height + 4,
              color: rgb(1, 1, 1),
            });

            // 입력 폼 필드 생성
            const fieldName = `text_field_${fieldCounter++}`;
            const textField = form.createTextField(fieldName);
            textField.setText(t.text!);
            textField.addToPage(page, {
              x: t.x,
              y: t.y - 2,
              width: t.width + 10,
              height: t.height + 4,
              font: customFont,
            });
            textField.enableMultiline();
          });

          // 빈칸 폼 변환 (기존 텍스트와 겹치지 않는 박스들만)
          data.rects.forEach(rect => {
            const isOverlapping = data.texts.some(t => {
              return !(t.x > rect.x + rect.width || 
                       t.x + t.width < rect.x || 
                       t.y > rect.y + rect.height || 
                       t.y + t.height < rect.y);
            });

            if (!isOverlapping) {
              const fieldName = `empty_cell_${fieldCounter++}`;
              const textField = form.createTextField(fieldName);
              textField.addToPage(page, {
                x: rect.x + 2,
                y: rect.y + 2,
                width: rect.width - 4,
                height: rect.height - 4,
                font: customFont,
              });
              textField.enableMultiline();
            }
          });
        }

        setStatusMsg("파일 다운로드 중...");
        const pdfBytes = await libDoc.save();
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        
        let newName = file.name;
        if (newName.toLowerCase().endsWith(".pdf")) newName = newName.slice(0, -4);
        link.download = `${newName}_스마트입력.pdf`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success("스마트 입력 폼(AcroForm)으로 변환되었습니다!");
        setFile(null); // 초기화
      } catch (err) {
        console.error("변환 오류:", err);
        toast.error("변환에 실패했습니다.");
      } finally {
        setIsConverting(false);
      }
    };

    convertToAcroForm();
  }, [file]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col min-h-[80vh]">
      <div className="flex flex-col items-center justify-center flex-1">
        {isConverting ? (
          <div className="flex flex-col items-center justify-center space-y-6">
            <Loader2 className="w-16 h-16 animate-spin text-amber-500" />
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">자동 변환 중입니다</h2>
              <p className="text-gray-500 dark:text-gray-400 font-medium">{statusMsg}</p>
            </div>
          </div>
        ) : (
          <>
            <div className="text-center mb-10">
              <div className="inline-flex items-center justify-center p-3 bg-amber-100 text-amber-600 rounded-2xl mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
                스마트 편집기 <span className="text-amber-500">Beta</span>
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                PDF를 업로드하면 내용과 빈칸 표를 모두 분석하여<br/>
                <b>클릭해서 바로 입력할 수 있는 새로운 인터랙티브 폼(AcroForm) PDF</b>로 즉시 변환해 드립니다.
              </p>
              <div className="flex items-center justify-center gap-2 mt-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-full font-medium">
                <AlertCircle className="w-4 h-4" />
                <span>업로드 즉시 변환된 파일이 다운로드됩니다. (웹 에디터 화면 없음)</span>
              </div>
            </div>

            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const dropped = e.dataTransfer.files[0];
                if (dropped && dropped.type === "application/pdf") {
                  setFile(dropped);
                } else if (dropped) {
                  toast.error("PDF 파일만 업로드 가능합니다.");
                }
              }}
              className="w-full max-w-2xl aspect-video flex flex-col items-center justify-center border-3 border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-3xl bg-white dark:bg-gray-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer group shadow-sm"
            >
              <div className="p-5 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full mb-6 group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300">
                <UploadCloud className="w-10 h-10" />
              </div>
              <p className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
                여기에 PDF 파일을 놓으세요
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                즉시 변환 시작 (최대 20MB)
              </p>
              <input
                type="file"
                className="hidden"
                accept="application/pdf"
                onChange={handleFileChange}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}
