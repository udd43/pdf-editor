/**
 * OpenCV.js / Canvas Image Preprocessing Pipeline for Tesseract OCR
 * Performs Binarization (Adaptive Thresholding) and Noise Reduction.
 */

let cvLoadingPromise: Promise<any> | null = null;

function loadOpenCV(): Promise<any> {
  if (cvLoadingPromise) return cvLoadingPromise;
  if ((window as any).cv) return Promise.resolve((window as any).cv);

  cvLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.7.0/opencv.js";
    script.async = true;
    script.onload = () => {
      const checkCv = () => {
        if ((window as any).cv && (window as any).cv.Mat) {
          resolve((window as any).cv);
        } else {
          setTimeout(checkCv, 100);
        }
      };
      checkCv();
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });

  return cvLoadingPromise;
}

/**
 * Preprocesses an HTMLCanvasElement image for improved OCR text recognition.
 */
export async function preprocessCanvasForOcr(
  sourceCanvas: HTMLCanvasElement
): Promise<string> {
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = sourceCanvas.width;
  outputCanvas.height = sourceCanvas.height;
  const ctx = outputCanvas.getContext("2d");
  if (!ctx) return sourceCanvas.toDataURL("image/png");

  try {
    const cv = await loadOpenCV();

    const src = cv.imread(sourceCanvas);
    const gray = new cv.Mat();
    const dst = new cv.Mat();

    // 1. Convert to Grayscale
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);

    // 2. Adaptive Binarization (Thresholding)
    cv.adaptiveThreshold(
      gray,
      dst,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY,
      15,
      11
    );

    // 3. Fast Denoising Morphology
    const kernel = cv.Mat.ones(2, 2, cv.CV_8U);
    cv.morphologyEx(dst, dst, cv.MORPH_CLOSE, kernel);

    cv.imshow(outputCanvas, dst);

    // Cleanup OpenCV memory
    src.delete();
    gray.delete();
    dst.delete();
    kernel.delete();

    return outputCanvas.toDataURL("image/png");
  } catch (err) {
    console.warn("OpenCV.js preprocessing fallback to native Canvas threshold", err);

    // Fallback: Pure Canvas Binarization
    ctx.drawImage(sourceCanvas, 0, 0);
    const imgData = ctx.getImageData(0, 0, outputCanvas.width, outputCanvas.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      const v = avg > 140 ? 255 : 0;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }

    ctx.putImageData(imgData, 0, 0);
    return outputCanvas.toDataURL("image/png");
  }
}
