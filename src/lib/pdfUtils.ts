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
  filename: string = "edited_document.pdf",
  options?: { isTrueRedaction?: boolean }
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

  // 4. Worker 결과 후처리 (redactions만 처리 — 압축은 '압축 도구' 메뉴에서만 수행)
  let finalBytes: Uint8Array = workerResult.pdfBytes;
  const hasRedactions = redactions && redactions.length > 0;
  const isTrueRedaction = options?.isTrueRedaction ?? true;
  
  if (hasRedactions) {
    const toastId = toast.loading("블라인드 처리 및 PDF 생성 중...");
    try {
      finalBytes = await processRedactions(finalBytes, redactions || [], isTrueRedaction);
      toast.success("PDF가 성공적으로 생성되었습니다!", { id: toastId });
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
  const pdf1 = await PDFDocument.load(buffer1, { ignoreEncryption: true, updateMetadata: false });
  const pdf2 = await PDFDocument.load(buffer2, { ignoreEncryption: true, updateMetadata: false });

  const copiedPages = await pdf1.copyPages(pdf2, pdf2.getPageIndices());
  copiedPages.forEach((page) => {
    pdf1.addPage(page);
  });

  const mergedBytes = await pdf1.save({ useObjectStreams: false });
  return mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength) as ArrayBuffer;
}

/**
 * Delete a specific page from a PDF ArrayBuffer.
 * @param buffer The original PDF ArrayBuffer
 * @param pageIndex The 0-based index of the page to delete
 * @returns A new ArrayBuffer containing the PDF with the page removed
 */
export async function deletePdfPage(buffer: ArrayBuffer, pageIndex: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  pdf.removePage(pageIndex);
  
  const modifiedBytes = await pdf.save({ useObjectStreams: false });
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
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const newPdf = await PDFDocument.create();

  const copiedPages = await newPdf.copyPages(srcPdf, newOrder);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const reorderedBytes = await newPdf.save({ useObjectStreams: false });
  return reorderedBytes.buffer.slice(reorderedBytes.byteOffset, reorderedBytes.byteOffset + reorderedBytes.byteLength) as ArrayBuffer;
}

/**
 * Redaction(블라인드) 처리 함수 (True Redaction 지원)
 * isTrueRedaction = true 일 경우:
 *   블라인드가 포함된 페이지만 2.0x 고해상도 캔버스로 렌더링 후 마스킹을 베이킹하여
 *   순수 이미지 페이지만으로 교체(기존 텍스트 스트림 100% 영구 파괴).
 *   블라인드가 없는 페이지는 원본 벡터 텍스트와 폰트를 그대로 보존합니다.
 */
async function processRedactions(
  pdfBuffer: ArrayBuffer | Uint8Array,
  redactions: RedactionData[],
  isTrueRedaction: boolean = false
): Promise<Uint8Array> {
  // 안전하게 독립적인 ArrayBuffer 복사본 생성
  let safeBuffer: ArrayBuffer;
  if (pdfBuffer instanceof Uint8Array) {
    const copy = new Uint8Array(pdfBuffer.byteLength);
    copy.set(pdfBuffer);
    safeBuffer = copy.buffer as ArrayBuffer;
  } else {
    safeBuffer = (pdfBuffer as ArrayBuffer).slice(0);
  }

  const pdfLibDoc = await PDFDocument.load(safeBuffer, { ignoreEncryption: true, updateMetadata: false });
  if (!redactions || redactions.length === 0) {
    return await pdfLibDoc.save({ useObjectStreams: false });
  }

  // 1단계: 영구 보안 마스킹 (True Redaction)
  if (isTrueRedaction) {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: safeBuffer.slice(0) });
      const pdfjsDoc = await loadingTask.promise;
      const numPages = pdfLibDoc.getPageCount();

      for (let pageIdx = 0; pageIdx < numPages; pageIdx++) {
        const pageIndex = pageIdx + 1; // 1-based (UI 좌표계)
        const pageRedactions = redactions.filter((r) => r.pageIndex === pageIndex);
        if (pageRedactions.length === 0) continue; // 블라인드 없는 페이지는 벡터 보존

        const pdfjsPage = await pdfjsDoc.getPage(pageIndex);
        const viewport = pdfjsPage.getViewport({ scale: 2.0 });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) continue;

        // 원본 페이지 렌더링
        await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;

        // 캔버스 픽셀 레벨에서 블라인드 박스를 칠해 하단 텍스트 픽셀을 물리적으로 덮어씀
        for (const r of pageRedactions) {
          const isWhite = r.color === "#FFFFFF" || r.color === "white";
          ctx.fillStyle = isWhite ? "#FFFFFF" : "#111827";
          ctx.fillRect(r.x * 2.0, r.y * 2.0, r.width * 2.0, r.height * 2.0);
        }

        // 고품질 JPEG 인코딩
        const imgBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
        );
        const imgBuffer = await imgBlob.arrayBuffer();
        const embeddedImg = await pdfLibDoc.embedJpg(imgBuffer);

        // pdfLibDoc에서 해당 페이지를 순수 단일 이미지 페이지로 교체 (텍스트 스트림 100% 소멸)
        const origPage = pdfLibDoc.getPage(pageIdx);
        const { width: pW, height: pH } = origPage.getSize();

        const newPage = pdfLibDoc.insertPage(pageIdx, [pW, pH]);
        newPage.drawImage(embeddedImg, { x: 0, y: 0, width: pW, height: pH });
        pdfLibDoc.removePage(pageIdx + 1); // 기존 페이지 영구 제거
      }

      return await pdfLibDoc.save({ useObjectStreams: false });
    } catch (trueRedactError) {
      console.warn("True Redaction 실패, 일반 마스킹으로 폴백:", trueRedactError);
    }
  }

  // 2단계: 일반 마스킹 (pdf-lib 사각형 오버레이 방식)
  const pages = pdfLibDoc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pageIndex = i + 1; // 1-based (UI 좌표계)
    const pageRedactions = redactions.filter((r) => r.pageIndex === pageIndex);
    if (pageRedactions.length === 0) continue;

    const page = pages[i];
    const { height: pageH } = page.getSize();

    for (const r of pageRedactions) {
      const isWhite = r.color === "#FFFFFF" || r.color === "white";
      const fillColor = isWhite ? rgb(1, 1, 1) : rgb(0.067, 0.094, 0.153); // #111827

      // PDF 좌표계: Y축이 아래→위이므로 변환
      page.drawRectangle({
        x: r.x,
        y: pageH - r.y - r.height,
        width: r.width,
        height: r.height,
        color: fillColor,
        borderWidth: 0,
      });
    }
  }

  return await pdfLibDoc.save({ useObjectStreams: false });
}

/**
 * Merge multiple PDF ArrayBuffers in order.
 */
export async function mergeMultiplePdfs(buffers: ArrayBuffer[]): Promise<ArrayBuffer> {
  if (buffers.length === 0) throw new Error("No PDFs to merge");
  if (buffers.length === 1) return buffers[0];

  const mergedPdf = await PDFDocument.create();
  for (const buffer of buffers) {
    const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save({ useObjectStreams: false });
  return mergedBytes.buffer.slice(mergedBytes.byteOffset, mergedBytes.byteOffset + mergedBytes.byteLength) as ArrayBuffer;
}

/**
 * Split specific pages (0-based indices) into a new PDF document.
 */
export async function extractPdfPages(buffer: ArrayBuffer, pageIndices: number[]): Promise<ArrayBuffer> {
  const srcPdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(srcPdf, pageIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));
  const newBytes = await newPdf.save({ useObjectStreams: false });
  return newBytes.buffer.slice(newBytes.byteOffset, newBytes.byteOffset + newBytes.byteLength) as ArrayBuffer;
}

/**
 * Rotate specific pages or all pages by given degrees (90, 180, 270).
 */
export async function rotatePdfPages(buffer: ArrayBuffer, rotations: Map<number, number>): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true, updateMetadata: false });
  const pages = pdf.getPages();

  rotations.forEach((deg, pageIdx) => {
    if (pageIdx >= 0 && pageIdx < pages.length) {
      const currentRotation = pages[pageIdx].getRotation().angle;
      pages[pageIdx].setRotation((currentRotation + deg) % 360 as any);
    }
  });

  const modifiedBytes = await pdf.save({ useObjectStreams: false });
  return modifiedBytes.buffer.slice(modifiedBytes.byteOffset, modifiedBytes.byteOffset + modifiedBytes.byteLength) as ArrayBuffer;
}

/**
 * 캔버스 기반 고화질 이미지 래스터화 내보내기 (안전 모드 폴백)
 * 
 * 비표준 PDF, 손상된 XRef, XFA 동적 폼, 복잡한 권한 암호화 등으로 인해
 * 일반 벡터 조립 저장이 실패할 때, 브라우저 화면에 렌더링된 그대로
 * 각 페이지를 고해상도(2.0x) 이미지로 캡처하여 새 표준 PDF 1.7 파일로 안전하게 재작성합니다.
 */
export async function exportPdfViaRasterFallback(
  originalPdfBuffer: ArrayBuffer,
  editedBoxes: TextBox[],
  imageOverlays: ImageOverlayData[],
  redactions: RedactionData[],
  filename: string = "document_safe_export.pdf",
  onProgress?: (msg: string) => void
): Promise<void> {
  if (onProgress) onProgress("안전 모드: 문서 파싱 중...");
  const loadingTask = pdfjsLib.getDocument({ data: originalPdfBuffer.slice(0) });
  const pdfJsDoc = await loadingTask.promise;
  const pdfLibDoc = await PDFDocument.create();

  const numPages = pdfJsDoc.numPages;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas context 생성 실패");

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) onProgress(`안전 모드: ${pageNum}/${numPages} 페이지 고화질 처리 중...`);
    const page = await pdfJsDoc.getPage(pageNum);
    const scale = 2.0; // 인쇄 품질을 위한 2배 고해상도 렌더링
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // 1. 기본 흰색 배경 및 원본 PDF 렌더링
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport } as any).promise;

    // 2. 블라인드(Redactions) 합성
    const pageRedactions = (redactions || []).filter(r => r.pageIndex === pageNum);
    for (const r of pageRedactions) {
      const isWhite = r.color === "#FFFFFF" || r.color === "white";
      ctx.fillStyle = isWhite ? "#FFFFFF" : "#111827";
      ctx.fillRect(r.x * scale, r.y * scale, r.width * scale, r.height * scale);
    }

    // 3. 이미지 오버레이 합성
    const pageOverlays = (imageOverlays || []).filter(o => o.pageIndex === pageNum);
    for (const o of pageOverlays) {
      try {
        const img = new Image();
        img.src = o.displaySrc;
        if (!img.complete) {
          await new Promise((res) => { img.onload = res; img.onerror = res; });
        }
        ctx.save();
        const rot = o.rotation || 0;
        const cx = (o.x + o.width / 2) * scale;
        const cy = (o.y + o.height / 2) * scale;
        ctx.translate(cx, cy);
        if (rot !== 0) {
          ctx.rotate((rot * Math.PI) / 180);
        }
        ctx.drawImage(
          img,
          (-o.width / 2) * scale,
          (-o.height / 2) * scale,
          o.width * scale,
          o.height * scale
        );
        ctx.restore();
      } catch (err) {
        console.warn("오버레이 이미지 렌더링 실패:", err);
      }
    }

    // 4. 텍스트 상자 합성
    const pageBoxes = (editedBoxes || []).filter(b => b.pageIndex === pageNum && (b.isEdited || b.isNew));
    for (const b of pageBoxes) {
      const boxX = b.x * scale;
      const boxY = b.y * scale;
      const boxW = b.width * scale;
      const boxH = b.height * scale;

      if (!b.isTransparent) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(boxX, boxY, boxW, boxH);
      }

      const fontSize = (b.fontSize || 16) * scale;
      const fontFamily = b.fontFamily === "NanumMyeongjo" ? "NanumMyeongjo" : b.fontFamily === "Jua" ? "Jua" : "Noto Sans KR";
      ctx.font = `${fontSize}px "${fontFamily}", sans-serif`;
      ctx.fillStyle = "#000000";
      ctx.textBaseline = "top";
      
      const lines = (b.text || "").split("\n");
      const lineHeight = fontSize * 1.35;
      lines.forEach((line, idx) => {
        ctx.fillText(line, boxX, boxY + idx * lineHeight, boxW);
      });
    }

    // 5. 캔버스를 고화질 JPEG 이미지(0.92 퀄리티)로 압축하여 새 PDF 페이지에 추가
    const imgBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92)
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

  if (onProgress) onProgress("안전 모드: 새 PDF 파일 저장 중...");
  const finalBytes = await pdfLibDoc.save({ useObjectStreams: false });

  // 6. 다운로드 트리거
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
 * Compress PDF by rendering pages into JPEG with chosen quality (0.1 ~ 1.0).
 */
export async function compressPdfBuffer(buffer: ArrayBuffer, quality: number = 0.65, scale: number = 1.2): Promise<ArrayBuffer> {
  // buffer를 복사해서 pdfjsLib에 전달 (원본 버퍼가 소비되지 않도록)
  const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
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

