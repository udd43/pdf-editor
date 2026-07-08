import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

self.onmessage = async (e: MessageEvent) => {
  const { originalPdfBuffer, editedBoxes, imageOverlays, fontBuffers } = e.data;

  try {
    const pdfDoc = await PDFDocument.load(originalPdfBuffer);
    pdfDoc.registerFontkit(fontkit);

    const fontCache: Record<string, any> = {};
    if (fontBuffers.NotoSansKR) {
      fontCache["NotoSansKR"] = await pdfDoc.embedFont(fontBuffers.NotoSansKR);
    }
    if (fontBuffers.NanumMyeongjo) {
      fontCache["NanumMyeongjo"] = await pdfDoc.embedFont(fontBuffers.NanumMyeongjo);
    }
    if (fontBuffers.Jua) {
      fontCache["Jua"] = await pdfDoc.embedFont(fontBuffers.Jua);
    }

    if (!fontCache["NotoSansKR"]) {
      const { StandardFonts } = await import("pdf-lib");
      fontCache["NotoSansKR"] = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    // 기본 폰트 폴백 설정
    fontCache["NanumMyeongjo"] = fontCache["NanumMyeongjo"] || fontCache["NotoSansKR"];
    fontCache["Jua"] = fontCache["Jua"] || fontCache["NotoSansKR"];

    const pages = pdfDoc.getPages();
    const { degrees } = await import("pdf-lib");

    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const rotationAngle = page.getRotation().angle;
      const currentUiPageNumber = pageIdx + 1;

      const getPdfCoords = (vx: number, vy: number) => {
        if (rotationAngle === 90) return { px: vy, py: vx };
        if (rotationAngle === 180) return { px: pdfWidth - vx, py: vy };
        if (rotationAngle === 270) return { px: pdfWidth - vy, py: pdfHeight - vx };
        return { px: vx, py: pdfHeight - vy };
      };

      const getRotatedCoords = (uiX: number, uiY: number, uiW: number, uiH: number) => {
        if (rotationAngle === 90) return { rectX: uiY, rectY: uiX, rectW: uiH, rectH: uiW, rotate: degrees(90) };
        if (rotationAngle === 180) return { rectX: pdfWidth - uiX - uiW, rectY: uiY, rectW: uiW, rectH: uiH, rotate: degrees(180) };
        if (rotationAngle === 270) return { rectX: pdfWidth - uiY - uiH, rectY: pdfHeight - uiX - uiW, rectW: uiH, rectH: uiW, rotate: degrees(270) };
        return { rectX: uiX, rectY: pdfHeight - uiY - uiH, rectW: uiW, rectH: uiH, rotate: degrees(0) };
      };

      // 텍스트 상자 처리
      const pageBoxes = editedBoxes.filter((b: any) => b.pageIndex === currentUiPageNumber);
      for (const box of pageBoxes) {
        if (box.isEdited || box.isNew) {
          const realX = box.x;
          const realY = box.y;
          const realW = box.width;
          const realH = box.height;

          const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

          if (!box.isTransparent) {
            page.drawRectangle({ x: rectX, y: rectY, width: rectW, height: rectH, color: rgb(1, 1, 1) });
          }

          const fontSize = Math.max(1, box.fontSize || 16);
          const selectedFont = fontCache[box.fontFamily || "NotoSansKR"] || fontCache["NotoSansKR"];
          
          try {
            const isLandscape = rotationAngle === 90 || rotationAngle === 270;
            const verticalCorrection = isLandscape ? (fontSize * 0.15) : 0;
            // UI uses `leading-snug` (line-height: 1.375) and 0 padding.
            // Distance to baseline is approximately fontSize * 0.98.
            const baselineVisualY = realY + (fontSize * 0.98) + verticalCorrection;
            const baselineVp = getPdfCoords(realX, baselineVisualY);
            const textX = baselineVp.px;
            const textY = baselineVp.py;

            page.drawText(box.text, {
              x: textX, y: textY, size: fontSize, font: selectedFont, color: rgb(0, 0, 0), maxWidth: realW, rotate: rotate,
            });
          } catch (drawError) {
            console.warn(`텍스트 그리기 실패 (${box.id}):`, drawError);
          }
        }
      }

      // 이미지 오버레이 처리
      const pageOverlays = imageOverlays.filter((o: any) => o.pageIndex === currentUiPageNumber);
      for (const overlay of pageOverlays) {
        try {
          if (!overlay.buffer) continue;
          
          const imgBytes = new Uint8Array(overlay.buffer);
          let embeddedImage;
          
          if (overlay.isPng) {
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
          const customRotation = overlay.rotation || 0;

          const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

          let imgDrawX = rectX;
          let imgDrawY = rectY;
          
          if (rotationAngle === 90) { imgDrawX = rectX + rectW; imgDrawY = rectY; }
          else if (rotationAngle === 180) { imgDrawX = rectX + rectW; imgDrawY = rectY + rectH; }
          else if (rotationAngle === 270) { imgDrawX = rectX; imgDrawY = rectY + rectH; }

          let finalRotationAngle = rotate.angle + customRotation;
          // Normalize rotation to 0-360
          finalRotationAngle = (finalRotationAngle % 360 + 360) % 360;

          page.drawImage(embeddedImage, { x: imgDrawX, y: imgDrawY, width: realW, height: realH, rotate: degrees(finalRotationAngle) });
        } catch (imgError) {
          console.warn(`이미지 삽입 실패 (${overlay.id}):`, imgError);
        }
      }
    }

    const pdfBytes = await pdfDoc.save();
    
    (self as any).postMessage({ success: true, pdfBytes }, [pdfBytes.buffer]);
  } catch (error: any) {
    (self as any).postMessage({ success: false, error: error.message || String(error) });
  }
};
