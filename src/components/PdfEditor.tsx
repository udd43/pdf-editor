"use client";

import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import Tesseract from "tesseract.js";
import { Download, Loader2, Plus, Trash2 } from "lucide-react";
import { exportEditedPdf } from "@/lib/pdfUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

export interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isEdited: boolean;
  isNew?: boolean;
}

type Status = "idle" | "rendering" | "ocr" | "done" | "error";

interface PdfEditorProps {
  file: File;
}

export default function PdfEditor({ file }: PdfEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<Status>("rendering");
  const [statusMsg, setStatusMsg] = useState("PDF를 렌더링하는 중...");
  const [errorDetail, setErrorDetail] = useState("");
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [scale, setScale] = useState(1.5);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [addMode, setAddMode] = useState(false);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    let isMounted = true;

    const loadPdf = async () => {
      try {
        setStatus("rendering");
        setStatusMsg("PDF 파일을 읽는 중...");

        const arrayBuffer = await file.arrayBuffer();
        if (!isMounted) return;

        // ArrayBuffer 복사본 저장 (pdfjsLib가 원본을 detach할 수 있음)
        const bufferCopy = arrayBuffer.slice(0);
        setPdfBuffer(bufferCopy);

        setStatusMsg("PDF 문서를 파싱하는 중...");
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) throw new Error("Canvas 요소를 찾을 수 없습니다.");

        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D Context를 생성할 수 없습니다.");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        setStatusMsg("PDF 페이지를 렌더링하는 중...");
        const renderContext: any = { canvasContext: context, viewport };
        await page.render(renderContext).promise;

        if (!isMounted) return;

        // ===== OCR 처리 =====
        setStatus("ocr");
        setStatusMsg("OCR 엔진을 초기화하는 중...");
        setOcrProgress(0);

        const imageDataUrl = canvas.toDataURL("image/png");

        let worker: Tesseract.Worker;
        try {
          worker = await Tesseract.createWorker("kor+eng", 1, {
            logger: (m) => {
              if (isMounted && m.status === "recognizing text") {
                const pct = Math.round(m.progress * 100);
                setOcrProgress(pct);
                setStatusMsg(`글자를 인식하는 중... ${pct}%`);
              }
            },
          });
        } catch (workerError: any) {
          throw new Error(`OCR 엔진 초기화 실패: ${workerError.message}`);
        }

        let ret: any;
        try {
          ret = await worker.recognize(imageDataUrl, {}, { text: true, blocks: true });
        } catch (recognizeError: any) {
          await worker.terminate();
          throw new Error(`텍스트 인식 실패: ${recognizeError.message}`);
        }
        await worker.terminate();

        if (!isMounted) return;

        // 결과 처리 (Tesseract.js v7: blocks → paragraphs → lines)
        const ocrData = ret.data as any;
        const ocrBlocks: any[] = ocrData?.blocks || [];

        const boxes: TextBox[] = [];
        let lineIndex = 0;
        for (const block of ocrBlocks) {
          for (const paragraph of block?.paragraphs || []) {
            for (const line of paragraph?.lines || []) {
              if (line.text && line.text.trim().length > 0 && line.bbox) {
                boxes.push({
                  id: `line-${lineIndex}`,
                  text: line.text.trim(),
                  x: line.bbox.x0,
                  y: line.bbox.y0,
                  width: line.bbox.x1 - line.bbox.x0,
                  height: line.bbox.y1 - line.bbox.y0,
                  isEdited: false,
                });
                lineIndex++;
              }
            }
          }
        }

        if (!isMounted) return;

        setTextBoxes(boxes);
        setNextId(lineIndex);
        setStatus("done");
        setStatusMsg(
          boxes.length === 0
            ? "텍스트를 감지하지 못했습니다. 더블클릭으로 직접 텍스트 상자를 추가하세요."
            : `${boxes.length}개의 텍스트 영역을 감지했습니다.`
        );
      } catch (error: any) {
        console.error("PDF/OCR 처리 오류:", error);
        if (isMounted) {
          setStatus("error");
          setStatusMsg("오류가 발생했습니다.");
          setErrorDetail(error?.message || String(error));
        }
      }
    };

    loadPdf();
    return () => { isMounted = false; };
  }, [file, scale]);

  const handleTextChange = (id: string, newText: string) => {
    setTextBoxes((prev) =>
      prev.map((box) =>
        box.id === id ? { ...box, text: newText, isEdited: true } : box
      )
    );
  };

  const handleDeleteBox = (id: string) => {
    setTextBoxes((prev) => prev.filter((box) => box.id !== id));
  };

  // 더블클릭으로 새 텍스트 상자 추가
  const handleCanvasDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (status !== "done") return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left + container.scrollLeft;
    const y = e.clientY - rect.top + container.scrollTop;

    const newBox: TextBox = {
      id: `new-${nextId}`,
      text: "텍스트 입력",
      x: x - 50,
      y: y - 12,
      width: 200,
      height: 30,
      isEdited: true,
      isNew: true,
    };

    setTextBoxes((prev) => [...prev, newBox]);
    setNextId((prev) => prev + 1);
    setStatusMsg(`텍스트 상자가 추가되었습니다. (총 ${textBoxes.length + 1}개)`);
  };

  const handleExport = async () => {
    if (!pdfBuffer) return;
    setStatus("rendering");
    setStatusMsg("새 PDF를 생성하는 중...");
    try {
      await exportEditedPdf(pdfBuffer, textBoxes, scale);
      setStatus("done");
      setStatusMsg("PDF가 다운로드되었습니다!");
    } catch (e: any) {
      console.error(e);
      setStatus("error");
      setStatusMsg("PDF 내보내기 실패");
      setErrorDetail(e?.message || String(e));
    }
  };

  const isLoading = status === "rendering" || status === "ocr";

  return (
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto py-8">
      {/* 툴바 */}
      <div className="w-full flex flex-wrap justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm border gap-2">
        <h2 className="text-xl font-bold text-gray-800 break-all truncate max-w-md">
          {file.name}
        </h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.2))}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            축소
          </button>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.2))}
            className="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm"
          >
            확대
          </button>
          <button
            onClick={() => setAddMode(!addMode)}
            disabled={status !== "done"}
            className={`flex items-center gap-1 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              addMode
                ? "bg-green-600 text-white hover:bg-green-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            } disabled:opacity-50`}
          >
            <Plus className="w-4 h-4" />
            {addMode ? "추가 모드 ON" : "텍스트 추가"}
          </button>
          <button
            onClick={handleExport}
            disabled={isLoading || textBoxes.length === 0}
            className="flex items-center gap-2 px-5 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg shadow hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            내보내기
          </button>
        </div>
      </div>

      {/* 상태 메시지 바 */}
      <div className={`w-full mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
        status === "error"
          ? "bg-red-50 border border-red-200 text-red-800"
          : status === "done" && textBoxes.length > 0
          ? "bg-green-50 border border-green-200 text-green-800"
          : status === "done" && textBoxes.length === 0
          ? "bg-yellow-50 border border-yellow-200 text-yellow-800"
          : "bg-blue-50 border border-blue-200 text-blue-800"
      }`}>
        {isLoading && <span className="inline-block mr-2 animate-spin">⏳</span>}
        {status === "done" && textBoxes.length > 0 && "✏️ "}
        {status === "error" && "❌ "}
        {statusMsg}
        {status === "done" && (
          <span className="ml-2 text-gray-500">
            — 파란 영역 클릭: 수정 | 더블클릭: 새 텍스트 추가{addMode && " (추가 모드 활성화됨)"}
          </span>
        )}
        {status === "error" && errorDetail && (
          <span className="block mt-1 text-xs text-red-600 font-mono">{errorDetail}</span>
        )}
      </div>

      {/* OCR 진행 바 */}
      {status === "ocr" && (
        <div className="w-full mb-4 bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${ocrProgress}%` }}
          />
        </div>
      )}

      {/* PDF 캔버스 + 오버레이 */}
      <div
        className={`relative border shadow-2xl bg-white overflow-auto rounded-lg mx-auto ${
          addMode ? "cursor-crosshair" : ""
        }`}
        ref={containerRef}
        onDoubleClick={handleCanvasDoubleClick}
      >
        <canvas ref={canvasRef} className="block" />

        {/* 로딩 오버레이 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/70 flex flex-col items-center justify-center z-50 backdrop-blur-sm">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
            <p className="text-lg font-semibold text-gray-700">{statusMsg}</p>
          </div>
        )}

        {/* 텍스트 편집 오버레이 */}
        {status === "done" &&
          textBoxes.map((box) => (
            <div
              key={box.id}
              className="absolute group"
              style={{
                left: `${box.x}px`,
                top: `${box.y}px`,
                width: `${box.width}px`,
                height: `${box.height}px`,
                zIndex: 10,
              }}
            >
              <textarea
                value={box.text}
                onChange={(e) => handleTextChange(box.id, e.target.value)}
                className="w-full h-full resize-none overflow-hidden transition-all duration-150 p-0 m-0 leading-tight cursor-pointer focus:cursor-text"
                style={{
                  fontSize: `${Math.max(10, box.height * 0.75)}px`,
                  fontFamily: "sans-serif",
                  whiteSpace: "pre-wrap",
                  backgroundColor: box.isNew
                    ? "rgba(220, 252, 231, 0.7)"
                    : box.isEdited
                    ? "rgba(254, 243, 199, 0.7)"
                    : "rgba(219, 234, 254, 0.35)",
                  color: box.isNew
                    ? "#166534"
                    : box.isEdited
                    ? "#92400e"
                    : "transparent",
                  border: box.isNew
                    ? "2px solid rgba(34, 197, 94, 0.6)"
                    : box.isEdited
                    ? "2px solid rgba(245, 158, 11, 0.6)"
                    : "1px dashed rgba(59, 130, 246, 0.4)",
                  outline: "none",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
                  e.currentTarget.style.color = "#000";
                  e.currentTarget.style.border = "2px solid #3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.25)";
                }}
                onBlur={(e) => {
                  const isNew = box.isNew;
                  const edited = box.isEdited;
                  e.currentTarget.style.backgroundColor = isNew
                    ? "rgba(220, 252, 231, 0.7)"
                    : edited
                    ? "rgba(254, 243, 199, 0.7)"
                    : "rgba(219, 234, 254, 0.35)";
                  e.currentTarget.style.color = isNew
                    ? "#166534"
                    : edited
                    ? "#92400e"
                    : "transparent";
                  e.currentTarget.style.border = isNew
                    ? "2px solid rgba(34, 197, 94, 0.6)"
                    : edited
                    ? "2px solid rgba(245, 158, 11, 0.6)"
                    : "1px dashed rgba(59, 130, 246, 0.4)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              {/* 삭제 버튼 */}
              <button
                onClick={() => handleDeleteBox(box.id)}
                className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 z-30"
                title="삭제"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
