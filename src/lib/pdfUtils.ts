import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { TextBox } from "@/components/PdfEditor";

export async function exportEditedPdf(
  originalPdfBuffer: ArrayBuffer,
  editedBoxes: TextBox[],
  scale: number
) {
  // Load original PDF
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  // 로컬에 번들링된 한글 폰트 로드 (네트워크 의존성 제거)
  let customFont;
  try {
    const fontBytes = await fetch("/NotoSansKR-Regular.otf").then((res) => {
      if (!res.ok) throw new Error(`Font fetch failed: ${res.status}`);
      return res.arrayBuffer();
    });
    customFont = await pdfDoc.embedFont(fontBytes);
  } catch (fontError) {
    console.warn("한글 폰트 로드 실패, 기본 폰트를 사용합니다:", fontError);
    // 폴백: pdf-lib 내장 폰트 (한글 미지원이지만 영문/숫자는 동작)
    const { StandardFonts } = await import("pdf-lib");
    customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const pages = pdfDoc.getPages();
  const firstPage = pages[0];
  const { height: pageHeight } = firstPage.getSize();

  // Draw over the edited boxes
  for (const box of editedBoxes) {
    if (box.isEdited || box.isNew) {
      const realX = box.x / scale;
      const realY = pageHeight - (box.y / scale) - (box.height / scale);
      const realWidth = box.width / scale;
      const realHeight = box.height / scale;

      // 기존 텍스트가 있는 경우에만 흰색 사각형으로 마스킹
      if (!box.isNew) {
        firstPage.drawRectangle({
          x: realX,
          y: realY,
          width: realWidth,
          height: realHeight,
          color: rgb(1, 1, 1),
        });
      }

      // 새 텍스트 그리기
      const fontSize = Math.max(8, realHeight * 0.7);
      try {
        firstPage.drawText(box.text, {
          x: realX + 1,
          y: realY + realHeight * 0.2,
          size: fontSize,
          font: customFont,
          color: rgb(0, 0, 0),
          maxWidth: realWidth - 2,
        });
      } catch (drawError) {
        console.warn(`텍스트 그리기 실패 (${box.id}):`, drawError);
      }
    }
  }

  // Serialize the PDFDocument to bytes
  const pdfBytes = await pdfDoc.save();

  // Trigger download
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
