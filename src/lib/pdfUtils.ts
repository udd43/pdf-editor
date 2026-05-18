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

  // 화면(캔버스)에 렌더링된 시각적 크기 — 회전 90/270이면 가로·세로가 바뀜
  const visualW = (rotationAngle === 90 || rotationAngle === 270) ? pdfHeight : pdfWidth;
  const visualH = (rotationAngle === 90 || rotationAngle === 270) ? pdfWidth : pdfHeight;

  /**
   * UI 좌표(canvas 픽셀, scale=1 기준) → PDF 내부 좌표 변환
   *
   * PDF 좌표계: 왼쪽 하단 원점, Y축 위 방향
   * Canvas 좌표계: 왼쪽 상단 원점, Y축 아래 방향
   *
   * rotation=0   : 그냥 Y 반전 (visualH - uiY - uiH)
   * rotation=90  : pdfjs 변환: canvas_x = pdfHeight - pdf_y, canvas_y = pdf_x
   *                역변환: pdf_x = canvas_y, pdf_y = pdfHeight - canvas_x
   * rotation=180 : 상하좌우 모두 반전
   * rotation=270 : pdfjs 변환: canvas_x = pdf_y, canvas_y = pdfWidth - pdf_x
   *                역변환: pdf_x = pdfWidth - canvas_y, pdf_y = canvas_x
   */
  const getRotatedCoords = (uiX: number, uiY: number, uiW: number, uiH: number) => {
    if (rotationAngle === 90) {
      // pdfjs: canvas_x = pdfHeight - pdf_y  →  pdf_y = pdfHeight - canvas_x
      //        canvas_y = pdf_x             →  pdf_x = canvas_y
      const pdfX = uiY;                         // canvas Y → PDF X
      const pdfY = pdfHeight - uiX - uiW;       // canvas X → PDF Y (pdfHeight 기준 반전) ★
      return {
        rectX: pdfX,  rectY: pdfY,  rectW: uiH,  rectH: uiW,
        textX: pdfX,  textY: pdfY + uiW,         // 텍스트 시작점 (rotate 후 왼쪽 상단)
        rotate: degrees(-90),
      };
    } else if (rotationAngle === 180) {
      return {
        rectX: pdfWidth  - uiX - uiW,
        rectY: pdfHeight - uiY - uiH,
        rectW: uiW, rectH: uiH,
        textX: pdfWidth  - uiX - uiW,
        textY: pdfHeight - uiY - uiH,
        rotate: degrees(180),
      };
    } else if (rotationAngle === 270) {
      // pdfjs: canvas_x = pdf_y             →  pdf_y = canvas_x
      //        canvas_y = pdfWidth - pdf_x  →  pdf_x = pdfWidth - canvas_y
      const pdfX = pdfWidth - uiY - uiH;        // canvas Y → PDF X (pdfWidth 기준 반전) ★
      const pdfY = uiX;                          // canvas X → PDF Y
      return {
        rectX: pdfX,  rectY: pdfY,  rectW: uiH,  rectH: uiW,
        textX: pdfX + uiH,  textY: pdfY,          // 텍스트 시작점
        rotate: degrees(90),
      };
    } else {
      // rotation=0 — 일반 세로 또는 진짜 가로(width>height) PDF
      return {
        rectX: uiX,
        rectY: pdfHeight - uiY - uiH,           // Y 반전
        rectW: uiW,  rectH: uiH,
        textX: uiX,
        textY: pdfHeight - uiY - uiH,
        rotate: degrees(0),
      };
    }
  };

  // 사용되지 않는 변수 경고 방지
  void visualW; void visualH;

  // 1. 텍스트 상자 처리
  for (const box of editedBoxes) {
    if (box.isEdited || box.isNew) {
      const realX = box.x / scale;
      const realY = box.y / scale;
      const realW = box.width / scale;
      const realH = box.height / scale;

      const { rectX, rectY, rectW, rectH, textX, textY, rotate } = getRotatedCoords(realX, realY, realW, realH);

      // 흰색 배경 사각형
      if (!box.isTransparent) {
        firstPage.drawRectangle({
          x: rectX, y: rectY, width: rectW, height: rectH,
          color: rgb(1, 1, 1),
        });
      }

      // 사용자가 설정한 폰트 크기 사용
      const fontSize = Math.max(8, (box.fontSize || 16) / scale);
      const selectedFont = fontCache[box.fontFamily || "NotoSansKR"] || fontCache["NotoSansKR"];
      
      try {
        // 텍스트 박스 내부 패딩 (px 단위, scale=1 기준)
        // textX/textY 는 이미 박스의 좌측 상단 기준으로 계산됨
        // PDF 좌표계에서 텍스트는 기준점에서 위쪽으로 그려지므로
        // Y = 박스 하단에서 fontSize만큼 올린 지점이 첫 줄 위치
        const padX = 2;

        let finalTx = textX + padX;
        let finalTy = textY;

        // rotation=0 / 180: textY가 박스 하단, 위로 (fontSize + 패딩)만큼 올림
        // rotation=90 / 270: getRotatedCoords에서 이미 uiW 오프셋 적용됨
        if (rotationAngle === 0) {
          finalTy = textY + (realH - fontSize - 2);
        } else if (rotationAngle === 180) {
          finalTx = textX - padX;
          finalTy = textY + (realH - fontSize - 2);
        } else if (rotationAngle === 90) {
          // textY = pdfY + uiW (박스의 "시작" 쪽), 내부 패딩
          finalTy = textY - (realH - fontSize - 2);
        } else if (rotationAngle === 270) {
          // textX = pdfX + uiH, 내부 패딩
          finalTx = textX - (realH - fontSize - 2);
          finalTy = textY + padX;
        }

        firstPage.drawText(box.text, {
          x: finalTx,
          y: finalTy,
          size: fontSize,
          font: selectedFont,
          color: rgb(0, 0, 0),
          maxWidth: (rotationAngle === 90 || rotationAngle === 270) ? realH - 4 : realW - 4,
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

      const realX = overlay.x / scale;
      const realY = overlay.y / scale;
      const realW = overlay.width / scale;
      const realH = overlay.height / scale;

      const { textX, textY, rotate, rectW, rectH } = getRotatedCoords(realX, realY, realW, realH);

      // 이미지는 bottom-left 기준으로 그려지고 회전하므로 텍스트와 기준점이 동일합니다.
      let imgDrawX = textX;
      let imgDrawY = textY;
      
      // 하지만 이미지는 width, height를 주기 때문에 회전했을 때 그려지는 영역이 다릅니다.
      // drawImage의 width/height는 그리기 전 원래 이미지의 크기입니다.
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
