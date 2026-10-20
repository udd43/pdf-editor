import * as ort from "onnxruntime-web";
import { get, set } from "idb-keyval";

const MODEL_IDB_KEY = "migan_inpaint_model_v2";
const MODEL_URL = "/models/migan_pipeline_v2.onnx";

let inpaintSession: ort.InferenceSession | null = null;
let isLoadingSession = false;

/**
 * Initialize and cache the Inpaint ONNX model.
 * Prioritizes WebGPU with WASM fallback.
 */
export async function getInpaintSession(
  onProgress?: (percent: number, status: string) => void
): Promise<ort.InferenceSession> {
  if (inpaintSession) return inpaintSession;
  if (isLoadingSession) {
    // Wait for ongoing initialization
    while (isLoadingSession) {
      await new Promise((r) => setTimeout(r, 100));
    }
    if (inpaintSession) return inpaintSession;
  }

  isLoadingSession = true;

  try {
    let modelBuffer: ArrayBuffer | undefined = await get<ArrayBuffer>(MODEL_IDB_KEY);

    if (!modelBuffer || modelBuffer.byteLength < 1000000) {
      onProgress?.(5, "AI 지우개 모델을 다운로드하는 중...");
      const response = await fetch(MODEL_URL);
      if (!response.ok) {
        throw new Error(`모델 다운로드 실패 (상태: ${response.status})`);
      }

      const contentLength = response.headers.get("content-length");
      const total = contentLength ? parseInt(contentLength, 10) : 28079181;

      if (response.body) {
        const reader = response.body.getReader();
        let received = 0;
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.length;
            const percent = Math.min(95, Math.round((received / total) * 90) + 5);
            onProgress?.(percent, `AI 모델 다운로드 중... (${Math.round(received / 1024 / 1024)}MB / ${Math.round(total / 1024 / 1024)}MB)`);
          }
        }

        const fullBuffer = new Uint8Array(received);
        let offset = 0;
        for (const chunk of chunks) {
          fullBuffer.set(chunk, offset);
          offset += chunk.length;
        }
        modelBuffer = fullBuffer.buffer as ArrayBuffer;

        // Save to IndexedDB for instant future loads
        try {
          await set(MODEL_IDB_KEY, modelBuffer);
        } catch (e) {
          console.warn("IndexedDB 모델 캐싱 실패 (용량 부족 등):", e);
        }
      } else {
        modelBuffer = await response.arrayBuffer();
      }
    }

    onProgress?.(96, "AI 가속 엔진 초기화 중 (WebGPU / WASM)...");

    // Try WebGPU first, then WASM
    try {
      inpaintSession = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["webgpu"],
        graphOptimizationLevel: "all",
      });
      console.log("[InpaintEngine] WebGPU Execution Provider 활성화 완료");
    } catch (gpuErr) {
      console.warn("[InpaintEngine] WebGPU 초기화 실패, WASM으로 전환:", gpuErr);
      inpaintSession = await ort.InferenceSession.create(modelBuffer, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      console.log("[InpaintEngine] WASM Execution Provider 활성화 완료");
    }

    onProgress?.(100, "준비 완료");
    return inpaintSession;
  } finally {
    isLoadingSession = false;
  }
}

export interface InpaintOptions {
  padding?: number;
  maxDimension?: number;
  onProgress?: (percent: number, status: string) => void;
}

/**
 * Run AI Inpainting on an image canvas using a mask canvas.
 * - imageCanvas: The original image canvas
 * - maskCanvas: The canvas where user drew brush strokes (masked regions have alpha > 0)
 * Returns a new canvas with the masked areas seamlessly inpainted.
 */
export async function runInpainting(
  imageCanvas: HTMLCanvasElement,
  maskCanvas: HTMLCanvasElement,
  options: InpaintOptions = {}
): Promise<HTMLCanvasElement> {
  const { padding = 64, maxDimension = 768, onProgress } = options;

  const width = imageCanvas.width;
  const height = imageCanvas.height;

  // 1. Find bounding box of the masked region
  const maskCtx = maskCanvas.getContext("2d", { willReadFrequently: true });
  if (!maskCtx) throw new Error("Mask canvas context failed");

  const maskData = maskCtx.getImageData(0, 0, width, height);
  const mPixels = maskData.data;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let hasMask = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // If alpha > 10, user painted here
      if (mPixels[idx + 3] > 10) {
        hasMask = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // If no mask, return a copy of the original
  if (!hasMask) {
    const copyCanvas = document.createElement("canvas");
    copyCanvas.width = width;
    copyCanvas.height = height;
    copyCanvas.getContext("2d")?.drawImage(imageCanvas, 0, 0);
    return copyCanvas;
  }

  // 2. Expand ROI (Region of Interest) by padding for surrounding context
  const roiX = Math.max(0, minX - padding);
  const roiY = Math.max(0, minY - padding);
  const roiW = Math.min(width - roiX, maxX - minX + 1 + padding * 2);
  const roiH = Math.min(height - roiY, maxY - minY + 1 + padding * 2);

  // Scale ROI if it exceeds maxDimension, and ensure dimensions are multiples of 8
  let targetW = roiW;
  let targetH = roiH;
  if (targetW > maxDimension || targetH > maxDimension) {
    const scale = maxDimension / Math.max(targetW, targetH);
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }
  // Snap to multiples of 8
  targetW = Math.max(64, Math.round(targetW / 8) * 8);
  targetH = Math.max(64, Math.round(targetH / 8) * 8);

  // 3. Extract ROI from image and mask
  const roiImgCanvas = document.createElement("canvas");
  roiImgCanvas.width = targetW;
  roiImgCanvas.height = targetH;
  const roiImgCtx = roiImgCanvas.getContext("2d", { willReadFrequently: true });
  if (!roiImgCtx) throw new Error("ROI Image canvas context failed");
  roiImgCtx.drawImage(imageCanvas, roiX, roiY, roiW, roiH, 0, 0, targetW, targetH);

  const roiMaskCanvas = document.createElement("canvas");
  roiMaskCanvas.width = targetW;
  roiMaskCanvas.height = targetH;
  const roiMaskCtx = roiMaskCanvas.getContext("2d", { willReadFrequently: true });
  if (!roiMaskCtx) throw new Error("ROI Mask canvas context failed");
  roiMaskCtx.drawImage(maskCanvas, roiX, roiY, roiW, roiH, 0, 0, targetW, targetH);

  onProgress?.(30, "AI 모델 로딩 중...");
  const session = await getInpaintSession(onProgress);

  onProgress?.(60, "텐서 데이터 변환 중...");
  const roiImgData = roiImgCtx.getImageData(0, 0, targetW, targetH).data;
  const roiMaskData = roiMaskCtx.getImageData(0, 0, targetW, targetH).data;

  const totalPixels = targetW * targetH;
  const imageCHW = new Uint8Array(3 * totalPixels);
  const maskCHW = new Uint8Array(totalPixels);

  // Preprocess into planar CHW
  // Mask: 0 = inpaint / erase, 255 = keep original
  for (let i = 0; i < totalPixels; i++) {
    const pxIdx = i * 4;
    imageCHW[i] = roiImgData[pxIdx];                     // R
    imageCHW[totalPixels + i] = roiImgData[pxIdx + 1];     // G
    imageCHW[2 * totalPixels + i] = roiImgData[pxIdx + 2]; // B

    // If mask alpha > 10, mark as 0 (inpaint hole); otherwise 255 (keep)
    maskCHW[i] = roiMaskData[pxIdx + 3] > 10 ? 0 : 255;
  }

  const imageTensor = new ort.Tensor("uint8", imageCHW, [1, 3, targetH, targetW]);
  const maskTensor = new ort.Tensor("uint8", maskCHW, [1, 1, targetH, targetW]);

  onProgress?.(75, "AI 지우개 추론 연산 실행 중...");
  const results = await session.run({
    image: imageTensor,
    mask: maskTensor,
  });

  const outputTensor = results.result || results[session.outputNames[0]];
  if (!outputTensor) throw new Error("AI 추론 결과 텐서를 찾을 수 없습니다.");

  const outputData = outputTensor.data as Uint8Array;

  // 4. Convert output CHW back to RGBA
  const inpaintedImageData = roiImgCtx.createImageData(targetW, targetH);
  const outPixels = inpaintedImageData.data;

  for (let i = 0; i < totalPixels; i++) {
    const pxIdx = i * 4;
    outPixels[pxIdx] = outputData[i];                     // R
    outPixels[pxIdx + 1] = outputData[totalPixels + i];     // G
    outPixels[pxIdx + 2] = outputData[2 * totalPixels + i]; // B
    outPixels[pxIdx + 3] = 255;                           // Alpha
  }

  roiImgCtx.putImageData(inpaintedImageData, 0, 0);

  // 5. Seamless Composite:
  // Render inpainted ROI back onto the final output canvas
  onProgress?.(95, "결과물 합성 중...");
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = width;
  finalCanvas.height = height;
  const finalCtx = finalCanvas.getContext("2d");
  if (!finalCtx) throw new Error("Final canvas context failed");

  // Draw full original image
  finalCtx.drawImage(imageCanvas, 0, 0);

  // Draw scaled inpainted ROI over the ROI region
  finalCtx.drawImage(roiImgCanvas, 0, 0, targetW, targetH, roiX, roiY, roiW, roiH);

  (finalCanvas as any).roi = { roiX, roiY, roiW, roiH };

  onProgress?.(100, "완료");
  return finalCanvas;
}
