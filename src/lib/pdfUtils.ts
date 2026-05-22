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
  _scale: number, // 하위 호환성을 위해 남겨둠 (사용하지 않음)
  filename: string = "edited_document.pdf"
) {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  pdfDoc.registerFontkit(fontkit);

  // 폰트 캐시 생성
  const fontCache: Record<string, any> = {};
  const loadFont = async (url: string) => {
    const fontBytes = await fetch(url).then(res => res.arrayBuffer());
    return await pdfDoc.embedFont(fontBytes);
  };

  try {
    const [noto, myeongjo, jua] = await Promise.all([
      loadFont("/NotoSansKR-Regular.otf"),
      loadFont("/NanumMyeongjo.ttf").catch(() => null),
      loadFont("/Jua.ttf").catch(() => null),
    ]);
    fontCache["NotoSansKR"] = noto;
    fontCache["NanumMyeongjo"] = myeongjo || noto;
    fontCache["Jua"] = jua || noto;
  } catch (fontError) {
    console.warn("기본 한글 폰트 로드 실패:", fontError);
    const { StandardFonts } = await import("pdf-lib");
    fontCache["NotoSansKR"] = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  const pages = pdfDoc.getPages();
  const { degrees } = await import("pdf-lib");

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    const { width: pdfWidth, height: pdfHeight } = page.getSize();
    const rotationAngle = page.getRotation().angle;
    const currentUiPageNumber = pageIdx + 1;

    // 화면 좌표(좌상단 원점, Y↓) → PDF 좌표(좌하단 원점, Y↑) 변환
    const getPdfCoords = (vx: number, vy: number) => {
      if (rotationAngle === 90) {
        return { px: vy, py: vx };
      } else if (rotationAngle === 180) {
        return { px: pdfWidth - vx, py: vy };
      } else if (rotationAngle === 270) {
        return { px: pdfWidth - vy, py: pdfHeight - vx };
      } else {
        return { px: vx, py: pdfHeight - vy };
      }
    };

    // 사각형(배경, 이미지) 좌표 변환 (회전 고려)
    const getRotatedCoords = (uiX: number, uiY: number, uiW: number, uiH: number) => {
      if (rotationAngle === 90) {
        return {
          rectX: uiY,
          rectY: uiX,
          rectW: uiH,
          rectH: uiW,
          rotate: degrees(90),
        };
      } else if (rotationAngle === 180) {
        return {
          rectX: pdfWidth - uiX - uiW,
          rectY: uiY,
          rectW: uiW,
          rectH: uiH,
          rotate: degrees(180),
        };
      } else if (rotationAngle === 270) {
        return {
          rectX: pdfWidth - uiY - uiH,
          rectY: pdfHeight - uiX - uiW,
          rectW: uiH,
          rectH: uiW,
          rotate: degrees(270),
        };
      } else {
        return {
          rectX: uiX,
          rectY: pdfHeight - uiY - uiH,
          rectW: uiW,
          rectH: uiH,
          rotate: degrees(0),
        };
      }
    };

    // ──────────────────────────────────────────────────────────
    // 1. 텍스트 상자 처리
    // ──────────────────────────────────────────────────────────
    const pageBoxes = editedBoxes.filter(b => b.pageIndex === currentUiPageNumber);
    for (const box of pageBoxes) {
      if (box.isEdited || box.isNew) {
        const realX = box.x;
        const realY = box.y;
        const realW = box.width;
        const realH = box.height;

        const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

        if (!box.isTransparent) {
          page.drawRectangle({
            x: rectX, y: rectY, width: rectW, height: rectH,
            color: rgb(1, 1, 1),
          });
        }

        const fontSize = Math.max(8, box.fontSize || 16);
        const selectedFont = fontCache[box.fontFamily || "NotoSansKR"] || fontCache["NotoSansKR"];
        
        try {
          const padX = 4;
          const padY = 4;
          const isLandscape = rotationAngle === 90 || rotationAngle === 270;
          const verticalCorrection = isLandscape ? (fontSize * 0.15) : 0; 
          const baselineVisualY = realY + padY + (fontSize * 0.88) + verticalCorrection;
          const baselineVp = getPdfCoords(realX + padX, baselineVisualY);
          const textX = baselineVp.px;
          const textY = baselineVp.py;

          page.drawText(box.text, {
            x: textX,
            y: textY,
            size: fontSize,
            font: selectedFont,
            color: rgb(0, 0, 0),
            maxWidth: realW - (padX * 2),
            rotate: rotate,
          });
        } catch (drawError) {
          console.warn(`텍스트 그리기 실패 (${box.id}):`, drawError);
        }
      }
    }

    // ──────────────────────────────────────────────────────────
    // 2. 이미지 오버레이 처리
    // ──────────────────────────────────────────────────────────
    const pageOverlays = imageOverlays.filter(o => o.pageIndex === currentUiPageNumber);
    for (const overlay of pageOverlays) {
      try {
        const imgDataUrl = overlay.displaySrc;
        const response = await fetch(imgDataUrl);
        const imgBlob = await response.blob();
        const imgArrayBuffer = await imgBlob.arrayBuffer();
        const imgBytes = new Uint8Array(imgArrayBuffer);

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

        const realX = overlay.x;
        const realY = overlay.y;
        const realW = overlay.width;
        const realH = overlay.height;

        const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

        let imgDrawX = rectX;
        let imgDrawY = rectY;
        
        if (rotationAngle === 90) {
          imgDrawX = rectX + rectW;
          imgDrawY = rectY;
        } else if (rotationAngle === 180) {
          imgDrawX = rectX + rectW;
          imgDrawY = rectY + rectH;
        } else if (rotationAngle === 270) {
          imgDrawX = rectX;
          imgDrawY = rectY + rectH;
        }

        page.drawImage(embeddedImage, {
          x: imgDrawX,
          y: imgDrawY,
          width: realW,
          height: realH,
          rotate: rotate,
        });
      } catch (imgError) {
        console.warn(`이미지 삽입 실패 (${overlay.id}):`, imgError);
      }
    }
  }

  // PDF 저장 및 다운로드
  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
