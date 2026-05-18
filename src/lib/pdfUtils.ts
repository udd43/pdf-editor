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
  const firstPage = pages[0];
  const { width: pdfWidth, height: pdfHeight } = firstPage.getSize();
  const rotationAngle = firstPage.getRotation().angle;

  const { degrees } = await import("pdf-lib");

  const getPdfCoords = (vx: number, vy: number) => {
    if (rotationAngle === 90) {
      return { px: vy, py: vx };
    } else if (rotationAngle === 180) {
      // 180° 회전: X축 반전 + PDF↔화면 Y 반전이 서로 상쇄되어 py = vy
      return { px: pdfWidth - vx, py: vy };
    } else if (rotationAngle === 270) {
      return { px: pdfWidth - vy, py: pdfHeight - vx };
    } else {
      return { px: vx, py: pdfHeight - vy };
    }
  };

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

  // [수정된 부분] UI 스케일과 해상도(DPI) 차이를 결합하여 '최종 고정 배율'을 하나 만듭니다.
  // 72 / 96 = 0.75 (웹 픽셀을 PDF 포인트로 변환하는 마법의 숫자입니다)
  const DPI_RATIO = 0.75;
  const FINAL_SCALE = (1 / (scale || 1)) * DPI_RATIO;

  // 1. 텍스트 상자 처리
  for (const box of editedBoxes) {
    if (box.isEdited || box.isNew) {
      // 이제 계속 나누지 않고, 깔끔하게 FINAL_SCALE만 곱해줍니다.
      const realX = box.x * FINAL_SCALE;
      const realY = box.y * FINAL_SCALE;
      const realW = box.width * FINAL_SCALE;
      const realH = box.height * FINAL_SCALE;

      const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

      // 흰색 배경 사각형
      if (!box.isTransparent) {
        firstPage.drawRectangle({
          x: rectX, y: rectY, width: rectW, height: rectH,
          color: rgb(1, 1, 1),
        });
      }

      // 사용자가 설정한 폰트 크기 사용
      const fontSize = Math.max(8, (box.fontSize || 16) * FINAL_SCALE);
      const selectedFont = fontCache[box.fontFamily || "NotoSansKR"] || fontCache["NotoSansKR"];
      
      try {
        // 에디터 내 textarea의 padding(4px) 및 border(2px/1px) 두께를 정확하게 반영하여 좌측 정렬 보정
        const padX = 5.5;
        
        // 가로 모드일 때 텍스트를 시각적으로 살짝 아래로 내려주는 보정값 추가
        const isLandscape = rotationAngle === 90 || rotationAngle === 270;
        const verticalCorrection = isLandscape ? (fontSize * 0.15) : 0; 
        
        // 에디터 내의 세로 중앙 정렬 및 폰트 디센더/어센더 메트릭 비율을 고려한 완벽한 베이스라인 계산
        const baselineY = realY + (realH / 2) + (fontSize * 0.32) + verticalCorrection;
        
        // 계산된 visual point를 PDF 좌표계로 다이렉트 매핑
        const baselineVp = getPdfCoords(realX + padX, baselineY);
        const textX = baselineVp.px;
        const textY = baselineVp.py;

        firstPage.drawText(box.text, {
          x: textX,
          y: textY,
          size: fontSize,
          font: selectedFont,
          color: rgb(0, 0, 0),
          // 무조건 UI 상의 너비(realW)를 기준으로 텍스트 최대 너비 제한
          maxWidth: realW - 4,
          rotate: rotate,
        });
      } catch (drawError) {
        console.warn(`텍스트 그리기 실패 (${box.id}):`, drawError);
      }
    }
  }

  // 2. 이미지 오버레이 처리
  for (const overlay of imageOverlays) {
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

      // 이미지 좌표에도 복잡한 계산 없이 FINAL_SCALE만 곱해줍니다.
      const realX = overlay.x * FINAL_SCALE;
      const realY = overlay.y * FINAL_SCALE;
      const realW = overlay.width * FINAL_SCALE;
      const realH = overlay.height * FINAL_SCALE;

      const { rectX, rectY, rectW, rectH, rotate } = getRotatedCoords(realX, realY, realW, realH);

      // 이미지는 bottom-left 기준으로 그려지고 회전하므로,
      // 회전 각도에 맞춰 그리기 기준점을 조정해 줍니다.
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

      firstPage.drawImage(embeddedImage, {
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
