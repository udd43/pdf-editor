import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";

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
  _scale: number, 
  filename: string = "edited_document.pdf"
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
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

      // 3. Web Worker 생성 및 메시지 전송
      const worker = new Worker(new URL('../workers/pdfExportWorker.ts', import.meta.url));

      worker.onmessage = (e) => {
        worker.terminate();
        const { success, pdfBytes, error } = e.data;
        if (success && pdfBytes) {
          const blob = new Blob([pdfBytes], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          resolve();
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
      const transferables = [bufferCopy];
      
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

    } catch (err) {
      reject(err);
    }
  });
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
  copiedPages.forEach((page) => {
    newPdf.addPage(page);
  });

  const reorderedBytes = await newPdf.save();
  return reorderedBytes.buffer.slice(reorderedBytes.byteOffset, reorderedBytes.byteOffset + reorderedBytes.byteLength) as ArrayBuffer;
}
