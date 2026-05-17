import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";

export async function exportEditedPdf(
  originalPdfBuffer: ArrayBuffer,
  editedBoxes: TextBox[],
  imageOverlays: ImageOverlayData[],
  scale: number
) {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  // 한글 폰트 로드
  let customFont;
  try {
    const fontBytes = await fetch("/NotoSansKR-Regular.otf").then((res) => {
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      return res.arrayBuffer();
    });
    customFont = await pdfDoc.embedFont(fontBytes);
  } catch (fontError) {
    console.warn("한글 폰트 로드 실패, 기본 폰트 사용:", fontError);
    const { StandardFonts } = await import("pdf-lib");
    customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height: pageHeight } = firstPage.getSize();

  // 1. 텍스트 상자 처리
  for (const box of editedBoxes) {
    if (box.isEdited || box.isNew) {
      const realX = box.x / scale;
      const realY = pageHeight - (box.y / scale) - (box.height / scale);
      const realWidth = box.width / scale;
      const realHeight = box.height / scale;

      // 항상 흰색 배경 사각형 (텍스트 박스가 흰 바탕 위에 올라감)
      firstPage.drawRectangle({
        x: realX,
        y: realY,
        width: realWidth,
        height: realHeight,
        color: rgb(1, 1, 1),
      });

      // 사용자가 설정한 폰트 크기 사용
      const fontSize = Math.max(8, (box.fontSize || 16) / scale);
      try {
        firstPage.drawText(box.text, {
          x: realX + 2,
          y: realY + realHeight - fontSize - 2,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
          maxWidth: realWidth - 4,
        });
      } catch (drawError) {
        console.warn(`텍스트 그리기 실패 (${box.id}):`, drawError);
      }
    }
  }

  // 2. 이미지 오버레이 처리
  for (const overlay of imageOverlays) {
    try {
      // data URL에서 바이트 추출
      const imgDataUrl = overlay.displaySrc;
      const response = await fetch(imgDataUrl);
      const imgBlob = await response.blob();
      const imgArrayBuffer = await imgBlob.arrayBuffer();
      const imgBytes = new Uint8Array(imgArrayBuffer);

      // PNG 또는 JPG 감지하여 임베드
      let embeddedImage;
      if (imgDataUrl.includes("image/png") || imgDataUrl.startsWith("blob:")) {
        embeddedImage = await pdfDoc.embedPng(imgBytes);
      } else {
        try {
          embeddedImage = await pdfDoc.embedJpg(imgBytes);
        } catch {
          embeddedImage = await pdfDoc.embedPng(imgBytes);
        }
      }

      const realX = overlay.x / scale;
      const realY = pageHeight - (overlay.y / scale) - (overlay.height / scale);
      const realWidth = overlay.width / scale;
      const realHeight = overlay.height / scale;

      firstPage.drawImage(embeddedImage, {
        x: realX,
        y: realY,
        width: realWidth,
        height: realHeight,
      });
    } catch (imgError) {
      console.warn(`이미지 삽입 실패 (${overlay.id}):`, imgError);
    }
  }

  // PDF 저장 및 다운로드
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "edited_document.pdf";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
