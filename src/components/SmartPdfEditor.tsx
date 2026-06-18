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
  const [vectorPaths, setVectorPaths] = useState<string[]>([]);
  const [pageViewport, setPageViewport] = useState({ width: 800, height: 1131 });
  
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
      setVectorPaths([]);
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

  // (renderPageAndParseText useEffect는 생략됨, 이전 도구 호출에서 수정 완료됨)
  // 하단 렌더링 컴포넌트 수정
  const handleDeleteText = (id: string) => {
    setTextBlocks(prev => prev.filter(b => b.id !== id));
  };

  const handleDeletePath = (index: number) => {
    setVectorPaths(prev => prev.filter((_, i) => i !== index));
  };

  // 페이지 렌더링 및 텍스트 추출 (Phase 2 & 3)
  useEffect(() => {
    if (!pdfDoc) return;
    let isMounted = true;
    
    const renderPageAndParseText = async () => {
      try {
        setIsParsing(true);
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale });
        
        // 1. 기존 배경 Canvas 렌더링 코드 완전 제거 (White-out, 캔버스 생성 안 함)

        // 2. 벡터 그래픽(표, 선, 테두리) 추출 (OperatorList 파싱)
        const opList = await page.getOperatorList();
        const paths: string[] = [];
        let currentPath = "";
        
        let transformStack: number[][] = [];
        let currentTransform = viewport.transform; // [scaleX, skewY, skewX, scaleY, translateX, translateY]

        const applyTransform = (p: number[], m: number[]) => {
          return [
            p[0] * m[0] + p[1] * m[2] + m[4],
            p[0] * m[1] + p[1] * m[3] + m[5]
          ];
        };

        const transformMatrix = (m1: number[], m2: number[]) => {
          return [
            m1[0] * m2[0] + m1[2] * m2[1],
            m1[1] * m2[0] + m1[3] * m2[1],
            m1[0] * m2[2] + m1[2] * m2[3],
            m1[1] * m2[2] + m1[3] * m2[3],
            m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
            m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
          ];
        };

        const OPS = {
          save: 10, restore: 11, transform: 12, moveTo: 13, lineTo: 14, closePath: 18,
          rectangle: 19, stroke: 20, fill: 22, eoFill: 23, fillStroke: 24, closeStroke: 21
        };

        for (let i = 0; i < opList.fnArray.length; i++) {
          const fn = opList.fnArray[i];
          const args = opList.argsArray[i];
          
          switch(fn) {
            case OPS.save:
              transformStack.push([...currentTransform]);
              break;
            case OPS.restore:
              if (transformStack.length > 0) {
                currentTransform = transformStack.pop()!;
              }
              break;
            case OPS.transform:
              currentTransform = transformMatrix(currentTransform, args);
              break;
            case OPS.moveTo: {
              const [x, y] = applyTransform([args[0], args[1]], currentTransform);
              currentPath += `M ${x} ${y} `;
              break;
            }
            case OPS.lineTo: {
              const [x, y] = applyTransform([args[0], args[1]], currentTransform);
              currentPath += `L ${x} ${y} `;
              break;
            }
            case OPS.rectangle: {
              const p1 = applyTransform([args[0], args[1]], currentTransform);
              const p2 = applyTransform([args[0] + args[2], args[1]], currentTransform);
              const p3 = applyTransform([args[0] + args[2], args[1] + args[3]], currentTransform);
              const p4 = applyTransform([args[0], args[1] + args[3]], currentTransform);
              currentPath += `M ${p1[0]} ${p1[1]} L ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} L ${p4[0]} ${p4[1]} Z `;
              break;
            }
            case OPS.closePath:
              currentPath += "Z ";
              break;
            case OPS.stroke:
            case OPS.fill:
            case OPS.eoFill:
            case OPS.fillStroke:
            case OPS.closeStroke:
              if (currentPath.trim() !== "") {
                paths.push(currentPath);
                currentPath = "";
              }
              break;
          }
        }

        // 3. 텍스트 추출 (TextContent) - 기존 로직 유지
        const textContent = await page.getTextContent();
        const rawItems: any[] = [];
        
        textContent.items.forEach((item: any) => {
          if (!item.str || item.str.trim() === '') return;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
          rawItems.push({
            text: item.str,
            x: tx[4],
            y: tx[5] - fontSize,
            width: item.width * scale,
            height: item.height * scale,
            fontSize: fontSize,
            fontFamily: item.fontName || 'sans-serif'
          });
        });

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

        lines.forEach(line => {
          line.items.sort((a: any, b: any) => a.x - b.x);
          let mergedText = "";
          let startX = line.items[0].x;
          let totalWidth = 0;
          let maxHeight = 0;
          let maxFontSize = 0;

          line.items.forEach((item: any, idx: number) => {
            if (idx > 0) {
              const prev = line.items[idx - 1];
              const gap = item.x - (prev.x + prev.width);
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
          // 새로 추출한 SVG Path 저장 (임시로 canvasRef 대신 쓰기 위해 state 확장 필요)
          setVectorPaths(paths);
          setPageViewport({ width: viewport.width, height: viewport.height });
          setIsParsing(false);
        }
      } catch (err) {
        console.error("문서 파싱 에러:", err);
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
            <div className="relative shadow-xl bg-white" style={{ width: pageViewport.width, height: pageViewport.height }}>
              {/* 순수 SVG 벡터 레이어 (표, 선, 도형 등) */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                {vectorPaths.map((d, i) => (
                  <path 
                    key={`path-${i}`} 
                    d={d} 
                    stroke="rgba(0,0,0,0.8)" 
                    strokeWidth="1" 
                    fill="none"
                    className="pointer-events-auto cursor-pointer hover:stroke-red-500 hover:stroke-[2px] transition-all"
                    onClick={() => handleDeletePath(i)}
                  >
                    <title>클릭하여 선 삭제</title>
                  </path>
                ))}
              </svg>
              
              {/* 편집 가능한 오버레이 레이어 (순수 텍스트/HTML) */}
              <div className="absolute inset-0" style={{ zIndex: 2 }}>
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
                    onKeyDown={(e) => {
                      if ((e.key === 'Backspace' || e.key === 'Delete') && e.currentTarget.textContent === '') {
                        handleDeleteText(block.id);
                      }
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
