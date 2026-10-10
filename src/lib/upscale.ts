/**
 * Real-ESRGAN 업스케일 공용 헬퍼
 *
 * 깨짐/색상 변화의 원인과 대응:
 *  1. ICC 프로파일(Display P3, CMYK JPEG 등)·EXIF 회전 정보를 Real-ESRGAN(stb_image)이 무시
 *     → 브라우저 캔버스로 한 번 그려서 sRGB PNG로 정규화한 뒤 전송
 *  2. realesrgan-x4plus / x4plus-anime 모델은 4배 전용인데 -s 2로 돌리면 결과가 깨짐
 *     → 서버에서 모델 고유 배율(4x)로 실행하고, 여기서 고품질 다운스케일로 정확히 2배를 맞춤
 */

export type UpscaleModel = "realesrgan-x4plus" | "realesrgan-x4plus-anime" | "realesr-animevideov3";

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."));
    img.src = src;
  });

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/png");
  });

/** 브라우저가 색 관리(ICC) + EXIF 회전을 적용한 상태 그대로 sRGB PNG로 변환 */
async function normalizeToSrgbPng(file: Blob): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { colorSpace: "srgb" } as CanvasRenderingContext2DSettings);
    if (!ctx) throw new Error("캔버스를 생성할 수 없습니다.");
    ctx.drawImage(img, 0, 0);
    return { blob: await canvasToBlob(canvas), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** 결과가 목표 크기보다 크면(4x 모델) 고품질로 정확히 목표 크기에 맞춤 */
async function resizeIfNeeded(blob: Blob, targetW: number, targetH: number): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    if (img.naturalWidth === targetW && img.naturalHeight === targetH) return blob;

    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d", { colorSpace: "srgb" } as CanvasRenderingContext2DSettings);
    if (!ctx) return blob;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return await canvasToBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function upscaleImage(
  file: Blob,
  options: { model?: UpscaleModel; scale?: number } = {}
): Promise<{ blob: Blob; width: number; height: number }> {
  const model = options.model ?? "realesrgan-x4plus";
  const scale = options.scale ?? 2;

  const normalized = await normalizeToSrgbPng(file);
  const targetW = normalized.width * scale;
  const targetH = normalized.height * scale;

  const formData = new FormData();
  formData.append("image", normalized.blob, "input.png");
  formData.append("scale", String(scale));
  formData.append("model", model);

  const res = await fetch("/api/upscale", { method: "POST", body: formData });
  if (!res.ok) {
    let message = "업스케일링 실패";
    try {
      const err = await res.json();
      message = err.error || message;
    } catch { /* ignore */ }
    throw new Error(message);
  }

  const raw = await res.blob();
  const blob = await resizeIfNeeded(raw, targetW, targetH);
  return { blob, width: targetW, height: targetH };
}
