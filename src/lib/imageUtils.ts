/**
 * 배경 제거 공통 유틸리티
 * PdfEditor와 ImageOverlay에서 중복되던 배경 제거 로직을 통합
 */

/**
 * 이미지 Blob에서 AI 기반 배경 제거를 수행합니다.
 * 축소 이미지로 AI 처리 후 원본 해상도에 마스크를 적용하여 품질을 유지합니다.
 * 
 * @param imageSource - 원본 이미지 (HTMLImageElement | Blob | string URL)
 * @returns 배경이 제거된 이미지의 Blob URL
 */
export async function removeImageBackground(imageSource: HTMLImageElement | Blob | string): Promise<{
  resultUrl: string;
  originalUrl: string;
  originalWidth: number;
  originalHeight: number;
}> {
  // 1. 원본 이미지 로드
  const origImg = new Image();
  origImg.crossOrigin = "anonymous";
  
  if (imageSource instanceof HTMLImageElement) {
    origImg.src = imageSource.src;
    if (!origImg.complete) {
      await new Promise((resolve) => (origImg.onload = resolve));
    }
  } else if (imageSource instanceof Blob) {
    const url = URL.createObjectURL(imageSource);
    origImg.src = url;
    await new Promise((resolve) => (origImg.onload = resolve));
  } else {
    origImg.src = imageSource;
    await new Promise((resolve) => (origImg.onload = resolve));
  }

  // 2. AI 처리를 위해 축소 (속도 향상)
  const MAX_SIZE = 800;
  let sw = origImg.width, sh = origImg.height;
  if (sw > MAX_SIZE || sh > MAX_SIZE) {
    if (sw > sh) { sh = Math.round((sh * MAX_SIZE) / sw); sw = MAX_SIZE; }
    else { sw = Math.round((sw * MAX_SIZE) / sh); sh = MAX_SIZE; }
  }
  const smallCanvas = document.createElement("canvas");
  smallCanvas.width = sw;
  smallCanvas.height = sh;
  const smallCtx = smallCanvas.getContext("2d")!;
  smallCtx.drawImage(origImg, 0, 0, sw, sh);
  const smallBlob = await new Promise<Blob>((resolve) =>
    smallCanvas.toBlob((b) => resolve(b!), "image/png")
  );

  // 3. 축소 이미지로 AI 배경 제거
  const { removeBackground } = await import("@imgly/background-removal");
  const smallResultBlob = await removeBackground(smallBlob, {
    model: "isnet_quint8",
    output: { format: "image/png" as const },
  });

  // 4. 마스크를 원본 해상도에 덧씌우기
  const maskImg = new Image();
  const maskUrl = URL.createObjectURL(smallResultBlob);
  maskImg.src = maskUrl;
  await new Promise((resolve) => (maskImg.onload = resolve));

  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = origImg.width;
  finalCanvas.height = origImg.height;
  const finalCtx = finalCanvas.getContext("2d")!;
  finalCtx.drawImage(origImg, 0, 0);
  finalCtx.globalCompositeOperation = "destination-in";
  finalCtx.drawImage(maskImg, 0, 0, origImg.width, origImg.height);

  const finalBlob = await new Promise<Blob>((resolve) =>
    finalCanvas.toBlob((b) => resolve(b!), "image/png")
  );
  const resultUrl = URL.createObjectURL(finalBlob);

  // 임시 mask URL 정리
  URL.revokeObjectURL(maskUrl);

  return {
    resultUrl,
    originalUrl: origImg.src,
    originalWidth: origImg.width,
    originalHeight: origImg.height,
  };
}

/**
 * HEIC/HEIF 이미지 파일 여부 판별
 */
export function isHeicFile(file: File | Blob | string): boolean {
  if (typeof file === "string") {
    const lower = file.toLowerCase();
    return lower.endsWith(".heic") || lower.endsWith(".heif");
  }
  if (file instanceof File) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith(".heic") || lower.endsWith(".heif")) return true;
  }
  if (file.type === "image/heic" || file.type === "image/heif") return true;
  return false;
}

/**
 * HEIC/HEIF 이미지를 브라우저에서 무손실 PNG Blob으로 변환
 */
export async function convertHeicToPng(file: Blob | File): Promise<Blob> {
  const heic2any = (await import("heic2any")).default;
  const result = await heic2any({
    blob: file,
    toType: "image/png",
  });
  return Array.isArray(result) ? result[0] : result;
}

