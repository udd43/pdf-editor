import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";

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
      // 1. 폰트 ArrayBuffer 로드
      const loadFontBuffer = async (url: string) => {
        try {
          return await fetch(url).then(res => res.arrayBuffer());
        } catch {
          return null;
        }
      };

      const [notoBuffer, myeongjoBuffer, juaBuffer] = await Promise.all([
        loadFontBuffer("/NotoSansKR-Regular.otf"),
        loadFontBuffer("/NanumMyeongjo.ttf"),
        loadFontBuffer("/Jua.ttf"),
      ]);

      const fontBuffers = {
        NotoSansKR: notoBuffer,
        NanumMyeongjo: myeongjoBuffer,
        Jua: juaBuffer,
      };

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
              isPng: imgDataUrl.includes("image/png") || imgDataUrl.startsWith("blob:")
            };
          } catch (e) {
            console.warn(`이미지 버퍼 로드 실패 (${overlay.id}):`, e);
            return {
              ...overlay,
              buffer: null,
              isPng: false
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

      // ArrayBuffer는 Transferable 객체이므로 메모리 복사 없이 전달 가능
      const transferables = [originalPdfBuffer];
      if (notoBuffer) transferables.push(notoBuffer);
      if (myeongjoBuffer) transferables.push(myeongjoBuffer);
      if (juaBuffer) transferables.push(juaBuffer);
      overlayDataForWorker.forEach(o => {
        if (o.buffer) transferables.push(o.buffer);
      });

      worker.postMessage({
        originalPdfBuffer,
        editedBoxes,
        imageOverlays: overlayDataForWorker,
        fontBuffers
      }, transferables);

    } catch (err) {
      reject(err);
    }
  });
}
