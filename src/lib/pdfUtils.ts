import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";
import { RedactionData } from "@/hooks/usePdfElements";
import * as pdfjsLib from "pdfjs-dist";
import toast from "react-hot-toast";

import { getFontBuffers } from "./fontCache";

/**
 * PDF 내보내기 함수
 * 
 * 좌표계 설명:
 * - PdfEditor에서 텍스트 상자 좌표(box.x, box.y 등)는 "PDF 포인트" 단위로 저장됩니다.
 *   (생성 시 canvasPixel / renderingScale 로 나눠서 저장하므로)
 * - 따라서 내보내기 시 추가적인 스케일 변환이 필요하지 않습니다.
 * - DPI 보정(72/96)도 불필요합니다. PDF.js viewport가 이미 1:1 매핑을 제공합니다.
 */
export async function exportEditedPdf(
  originalPdfBuffer: ArrayBuffer,
  editedBoxes: TextBox[],
  imageOverlays: ImageOverlayData[],
  redactions: RedactionData[],
  _scale: number, 
  filename: string = "edited_document.pdf"
): Promise<void> {
  // 1. 폰트 ArrayBuffer 로드 (캐시 사용)
  const fontBuffers = await getFontBuffers();

  // 2. 이미지들을 ArrayBuffer로 변환
  const overlayDataForWorker = await Promise.all(
    imageOverlays.map(async (overlay) => {
      try {
        const imgDataUrl = overlay.displaySrc;
        const response = await fetch(imgDataUrl);
        const imgBlob = await response.blob();
        const imgBuffer = await imgBlob.arrayBuffer();
        
        return {
          id: overlay.id,
          pageIndex: overlay.pageIndex,
          x: overlay.x,
          y: overlay.y,
          width: overlay.width,
          height: overlay.height,
          buffer: imgBuffer,
          isPng: imgDataUrl.includes("image/png") || imgDataUrl.startsWith("blob:"),
          rotation: overlay.rotation || 0
        };
      } catch (e) {
        console.warn(`이미지 버퍼 로드 실패 (${overlay.id}):`, e);
        return {
          ...overlay,
          buffer: null,
          isPng: false,
          rotation: 0
        };
      }
    })
  );

  // 3. Web Worker 생성 및 메시지 전송 — Promise로 worker 완료를 기다림
  const workerResult = await new Promise<{ pdfBytes: Uint8Array }>((resolve, reject) => {
    const worker = new Worker(new URL('../workers/pdfExportWorker.ts', import.meta.url));

    worker.onmessage = (e) => {
      worker.terminate();
      const { success, pdfBytes, error } = e.data;
      if (success && pdfBytes) {
        resolve({ pdfBytes });
      } else {
        reject(new Error(error || "Worker PDF 생성 실패"));
      }
    };

    worker.onerror = (err) => {
      worker.terminate();
      reject(err);
    };

    // ArrayBuffer는 Transferable 객체이므로 복사본을 만들어 전달 (원본 보존)
    const bufferCopy = originalPdfBuffer.slice(0);
    const transferables: ArrayBuffer[] = [bufferCopy];
    
    const fontsForWorker = {
      NotoSansKR: fontBuffers.NotoSansKR ? fontBuffers.NotoSansKR.slice(0) : null,
      NanumMyeongjo: fontBuffers.NanumMyeongjo ? fontBuffers.NanumMyeongjo.slice(0) : null,
      Jua: fontBuffers.Jua ? fontBuffers.Jua.slice(0) : null,
    };

    if (fontsForWorker.NotoSansKR) transferables.push(fontsForWorker.NotoSansKR);
    if (fontsForWorker.NanumMyeongjo) transferables.push(fontsForWorker.NanumMyeongjo);
    if (fontsForWorker.Jua) transferables.push(fontsForWorker.Jua);
    
    overlayDataForWorker.forEach(o => {
      if (o.buffer) transferables.push(o.buffer);
    });

    worker.postMessage({
      originalPdfBuffer: bufferCopy,
      editedBoxes,
      imageOverlays: overlayDataForWorker,
      fontBuffers: fontsForWorker
    }, transferables);
  });

  // 4. Worker 결과 후처리 (redactions, compression)
  let finalBytes: Uint8Array = workerResult.pdfBytes;
  const isCompressing = finalBytes.byteLength > 20 * 1024 * 1024;
  const hasRedactions = redactions && redactions.length > 0;
  
  if (hasRedactions || isCompressing) {
    const toastId = toast.loading(isCompressing ? "20MB 초과: 자동 압축 및 처리 중..." : "블라인드 병합 처리 중...");
    try {
      finalBytes = await processRedactionsAndCompression(finalBytes, redactions || [], isCompressing);
      toast.success("처리가 완료되었습니다!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("처리 중 오류가 발생했습니다. 원본을 저장합니다.", { id: toastId });
    }
  }

  // 5. 다운로드
  const blob = new Blob([finalBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Merge two PDF ArrayBuffers into one by appending the second PDF's pages to the first.
 * @param buffer1 The original PDF ArrayBuffer
 * @param buffer2 The newly dropped PDF ArrayBuffer
 * @returns A new ArrayBuffer containing the merged PDF
 */
export async function mergePdfs(buffer1: ArrayBuffer, buffer2: ArrayBuffer): Promise<ArrayBuffer> {
  const pdf1 = await PDFDocument.load(buffer1);
  const pdf2 = await PDFDocument.load(buffer2);

  const copiedPages = await pdf1.copyPages(pdf2, pdf2.getPageIndices());
  copiedPages.forEach((page) => {
    pdf1.addPage(page);
  });

  const mergedBytes = await pdf1.save();
  return mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength) as ArrayBuffer;
}

/**
 * Delete a specific page from a PDF ArrayBuffer.
 * @param buffer The original PDF ArrayBuffer
 * @param pageIndex The 0-based index of the page to delete
 * @returns A new ArrayBuffer containing the PDF with the page removed
 */
export async function deletePdfPage(buffer: ArrayBuffer, pageIndex: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.load(buffer);
  pdf.removePage(pageIndex);
  
  const modifiedBytes = await pdf.save();
  return modifiedBytes.buffer.slice(modifiedBytes.byteOffset, modifiedBytes.byteOffset + modifiedBytes.byteLength) as ArrayBuffer;
}

/**
 * Reorder pages in a PDF according to the given page order.
 * @param buffer The original PDF ArrayBuffer
 * @param newOrder An array of 0-based page indices in the desired order.
 *                 e.g. [2, 0, 1] moves page 3 to first, page 1 to second, page 2 to third.
 * @returns A new ArrayBuffer containing the reordered PDF
 */
export async function reorderPdfPages(buffer: ArrayBuffer, newOrder: number[]): Promise<ArrayBuffer> {
  const srcPdf = await PDFDocument.load(buffer);
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(srcPdf, newOrder);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const reorderedBytes = await newPdf.save();
  return reorderedBytes.buffer.slice(reorderedBytes.byteOffset, reorderedBytes.byteOffset + reorderedBytes.byteLength) as ArrayBuffer;
}

/**
 * Redaction(블라인드) 및 Compression(압축) 처리 함수
 */
async function processRedactionsAndCompression(
  pdfBuffer: ArrayBuffer | Uint8Array,
  redactions: RedactionData[],
  isCompressing: boolean
): Promise<Uint8Array> {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
  const pdfJsDoc = await loadingTask.promise;
  const pdfLibDoc = await PDFDocument.load(pdfBuffer);
  
  const numPages = pdfJsDoc.numPages;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  
  if (!ctx) throw new Error("Canvas 2D context not available");

  for (let i = 0; i < numPages; i++) {
    const pageIndex = i + 1; // 1-based
    const pageRedactions = redactions.filter(r => r.pageIndex === pageIndex);
    const needsProcessing = isCompressing || pageRedactions.length > 0;

    if (!needsProcessing) continue;

    // Render with pdf.js
    const page = await pdfJsDoc.getPage(pageIndex);
    // Compression: use scale 1.5, Redaction only: use scale 2.0 to maintain quality
    const scale = isCompressing ? 1.5 : 2.0; 
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    
    // Draw white background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      intent: "print"
    }).promise;

    // Draw redactions on canvas
    if (pageRedactions.length > 0) {
      ctx.fillStyle = "#111827"; // gray-900 (or black)
      for (const r of pageRedactions) {
        // Redaction coords are in PDF points (1 scale), so we scale them to the canvas viewport
        const rx = r.x * scale;
        const ry = r.y * scale;
        const rw = r.width * scale;
        const rh = r.height * scale;
        ctx.fillRect(rx, ry, rw, rh);
      }
    }

    // Convert to JPEG (using toBlob to avoid base64 overhead)
    const quality = isCompressing ? 0.65 : 0.9;
    const imgBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
    );
    const imgBytes = await imgBlob.arrayBuffer();

    // Replace page in pdf-lib
    const embeddedImage = await pdfLibDoc.embedJpg(imgBytes);
    const pdfPage = pdfLibDoc.getPage(i);
    const { width, height } = pdfPage.getSize();
    
    // Clear the original page contents by creating a new blank page
    // Actually, pdf-lib doesn't have an easy way to clear a page, so we remove and insert
    pdfLibDoc.removePage(i);
    const newPage = pdfLibDoc.insertPage(i, [width, height]);
    newPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: width,
      height: height
    });
  }

  // Save the modified PDF
  return await pdfLibDoc.save({ useObjectStreams: true });
}

/**
 * Merge multiple PDF ArrayBuffers in order.
 */
export async function mergeMultiplePdfs(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (buffers.length === 0) throw new Error("No PDFs to merge");
  if (buffers.length === 1) return buffers[0];

  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  return mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength) as ArrayBuffer;
}

/**
 * Split specific pages (0-based indices) into a new PDF document.
 */
export async function extractPdfPages(buffer: ArrayBuffer, pageIndices: number[]): Promise<ArrayBuffer> {
  const srcPdf = await PDFDocument.load(buffer);
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  const newBytes = await newPdf.save();
  return newBytes.buffer.slice(newBytes.byteOffset, newBytes.byteOffset + newBytes.byteLength) as ArrayBuffer;
}

/**
 * Rotate specific pages or all pages by given degrees (90, 180, 270).
 */
export async function rotatePdfPages(buffer: ArrayBuffer, rotations: Map<number, number>): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.load(buffer);
  const pages = pdf.getPages();

  rotations.forEach((deg, pageIdx) => {
    if (pageIdx >= 0 && pageIdx < pages.length) {
      const currentRotation = pages[pageIdx].getRotation().angle;
      pages[pageIdx].setRotation((currentRotation + deg) % 360 as any);
    }
  });

  const modifiedBytes = await pdf.save();
  return modifiedBytes.buffer.slice(modifiedBytes.byteOffset, modifiedBytes.byteOffset + modifiedBytes.byteLength) as ArrayBuffer;
}

/**
 * Compress PDF by rendering pages into JPEG with chosen quality (0.1 ~ 1.0).
 */
export async function compressPdfBuffer(buffer: ArrayBuffer, quality: number = 0.65, scale: number = 1.2): Promise<ArrayBuffer> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdfJsDoc = await loadingTask.promise;
  const pdfLibDoc = await PDFDocument.create();

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("Canvas context creation failed");

  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    const imgBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", quality)
    );
    const imgBytes = await imgBlob.arrayBuffer();
    const embeddedImg = await pdfLibDoc.embedJpg(imgBytes);

    const pdfPage = pdfLibDoc.addPage([viewport.width / scale, viewport.height / scale]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: viewport.width / scale,
      height: viewport.height / scale,
    });
  }

  const compressedBytes = await pdfLibDoc.save({ useObjectStreams: true });
  return compressedBytes.buffer.slice(compressedBytes.byteOffset, compressedBytes.byteOffset + compressedBytes.byteLength) as ArrayBuffer;
}

