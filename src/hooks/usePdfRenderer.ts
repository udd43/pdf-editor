import { useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";

interface UsePdfRendererProps {
  file: File;
  setStatus: (status: "idle" | "rendering" | "ocr" | "done" | "error") => void;
  setStatusMsg: (msg: string) => void;
  setErrorDetail: (detail: string) => void;
  resetElements: () => void;
  setExtractedTexts: (texts: string[]) => void;
}

export function usePdfRenderer({
  file, setStatus, setStatusMsg, setErrorDetail, resetElements, setExtractedTexts
}: UsePdfRendererProps) {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(1);
  const [scale, setScale] = useState(1.5);

  useEffect(() => {
    let isMounted = true;
    const loadPdf = async () => {
      try {
        setStatus("rendering");
        setStatusMsg("PDF 파일을 읽는 중...");
        
        resetElements();
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
        if (isMounted) { 
          setStatus("error"); 
          setStatusMsg("오류 발생"); 
          setErrorDetail(error?.message || String(error)); 
        }
      }
    };
    loadPdf();
    return () => { isMounted = false; };
  }, [file, resetElements, setExtractedTexts, setStatus, setStatusMsg, setErrorDetail]);

  const handleZoom = (type: "in" | "out" | "reset") => {
    if (type === "in") {
      setScale((prev) => Math.min(3.0, prev + 0.25));
    } else if (type === "out") {
      setScale((prev) => Math.max(0.5, prev - 0.25));
    } else {
      setScale(1.5);
    }
  };

  return {
    pdfDoc,
    setPdfDoc,
    pdfBuffer,
    setPdfBuffer,
    currentPage,
    setCurrentPage,
    numPages,
    setNumPages,
    scale,
    setScale,
    handleZoom
  };
}
