import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Sparkles, FileText, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import * as pdfjsLib from 'pdfjs-dist';

// 워커 설정
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

// 텍스트 블록 인터페이스
interface TextBlock {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontFamily: string;
}

export default function SmartPdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.5);
  
  const [isParsing, setIsParsing] = useState(false);
  const [textBlocks, setTextBlocks] = useState<TextBlock[]>([]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 파일 업로드 처리
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else if (selected) {
      toast.error("PDF 파일만 업로드 가능합니다.");
    }
  };

  // PDF 문서 로드
  useEffect(() => {
    if (!file) {
      setPdfDoc(null);
      setTextBlocks([]);
      return;
    }
    const loadPdf = async () => {
      try {
        setIsParsing(true);
        const buffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("PDF 로드 에러:", err);
        toast.error("PDF 문서를 읽을 수 없습니다.");
        setFile(null);
        setIsParsing(false);
      }
    };
    loadPdf();
  }, [file]);

  // 페이지 렌더링 및 텍스트 추출 (Phase 2 & 3)
  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;
    
    const renderPageAndParseText = async () => {
      try {
        setIsParsing(true);
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        
        // 1. 캔버스에 PDF 배경 렌더링
        const canvas = canvasRef.current;
        if (canvas) {
          const context = canvas.getContext("2d");
          if (context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport } as any).promise;
          }
        }

        // 2. 텍스트 추출 (TextContent)
        const textContent = await page.getTextContent();
        const rawItems: any[] = [];
        
        // 1차: 변환된 좌표계로 기본 데이터 추출
        textContent.items.forEach((item: any) => {
          if (!item.str || item.str.trim() === '') return;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
          rawItems.push({
            text: item.str,
            x: tx[4],
            y: tx[5] - fontSize, // Baseline 보정
            width: item.width * scale,
            height: item.height * scale,
            fontSize: fontSize,
            fontFamily: item.fontName || 'sans-serif'
          });
        });

        // 2차: Y좌표가 유사한(±3px 오차) 항목들을 같은 '줄(Line)'로 묶기 (Heuristic Grouping)
        const lines: any[] = [];
        rawItems.forEach(item => {
          const matchingLine = lines.find(line => Math.abs(line.y - item.y) < 3);
          if (matchingLine) {
            matchingLine.items.push(item);
          } else {
            lines.push({ y: item.y, items: [item] });
          }
        });

        const blocks: TextBlock[] = [];
        let blockId = 0;

        // 3차: 각 줄 내부에서 X 좌표 순으로 정렬 후 텍스트 병합
        lines.forEach(line => {
          line.items.sort((a: any, b: any) => a.x - b.x);
          
          // X 좌표 간격을 보고 너무 멀면 띄어쓰기를 넣거나 분리해야 하지만, 우선 한 문장으로 병합
          let mergedText = "";
          let startX = line.items[0].x;
          let totalWidth = 0;
          let maxHeight = 0;
          let maxFontSize = 0;

          line.items.forEach((item: any, idx: number) => {
            if (idx > 0) {
              const prev = line.items[idx - 1];
              const gap = item.x - (prev.x + prev.width);
              // 간격이 폰트 크기의 절반보다 크면 띄어쓰기 추가
              if (gap > prev.fontSize * 0.3) mergedText += " ";
            }
            mergedText += item.text;
            totalWidth = (item.x + item.width) - startX;
            if (item.height > maxHeight) maxHeight = item.height;
            if (item.fontSize > maxFontSize) maxFontSize = item.fontSize;
          });

          blocks.push({
            id: `block-${blockId++}`,
            text: mergedText,
            x: startX,
            y: line.y,
            width: totalWidth,
            height: maxHeight,
            fontSize: maxFontSize,
            fontFamily: line.items[0].fontFamily
          });
        });

        if (isMounted) {
          setTextBlocks(blocks);
          setIsParsing(false);
        }
      } catch (err) {
        console.error("페이지 렌더링 및 파싱 에러:", err);
        if (isMounted) setIsParsing(false);
      }
    };
    
    renderPageAndParseText();
    return () => { isMounted = false; };
  }, [pdfDoc, currentPage, scale]);

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col min-h-[80vh]">
      {!file ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-amber-100 text-amber-600 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              스마트 편집 <span className="text-amber-500">Beta</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              PDF 문서의 구조를 스캔하여 마치 워드(Word)처럼 내용과 표를 클릭하여 바로 수정할 수 있습니다.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-full font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>디지털(컴퓨터 생성) PDF 전용 기능입니다. (스캔본/이미지는 지원하지 않습니다)</span>
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
              PDF 파일을 이곳에 놓거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              최대 20MB 지원
            </p>
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col flex-1 bg-[#F9F6ED] dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 에디터 툴바 영역 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-sm">
                {file.name}
              </span>
              <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-500 rounded-md">
                페이지 {currentPage} / {numPages || 1}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setFile(null)}
                className="text-sm px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg font-medium transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
          
          {/* 파싱 및 편집 캔버스 영역 */}
          <div className="flex-1 relative overflow-auto flex justify-center p-8 bg-gray-200/50 dark:bg-gray-900 custom-scrollbar">
            {isParsing ? (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
                <Loader2 className="w-10 h-10 animate-spin text-amber-500 mb-4" />
                <p className="text-gray-700 dark:text-gray-300 font-bold text-lg">문서 구조를 분석하고 있습니다...</p>
                <p className="text-gray-500 text-sm mt-2">텍스트와 레이아웃을 파싱 중입니다.</p>
              </div>
            ) : null}

            {/* 실제 렌더링 컨테이너 */}
            <div className="relative shadow-xl bg-white" style={{ width: canvasRef.current?.width || 800, height: canvasRef.current?.height || 1131 }}>
              {/* 원본 PDF 렌더링 캔버스 (추후 텍스트만 가리는 필터 추가 가능) */}
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-30" />
              
              {/* 편집 가능한 오버레이 레이어 */}
              <div className="absolute inset-0 z-10">
                {textBlocks.map(block => (
                  <div
                    key={block.id}
                    contentEditable
                    suppressContentEditableWarning
                    className="absolute outline-none border border-transparent hover:border-amber-400 focus:border-amber-500 focus:bg-amber-50/50 focus:shadow-md transition-colors whitespace-nowrap overflow-visible cursor-text"
                    style={{
                      left: block.x,
                      top: block.y,
                      fontSize: `${block.fontSize}px`,
                      fontFamily: block.fontFamily,
                      minWidth: block.width > 0 ? block.width : 'auto',
                      lineHeight: 1,
                      color: 'black'
                    }}
                  >
                    {block.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
