/**
 * 크로스 플랫폼 파일 저장 유틸.
 *
 * - 모바일(Android / iOS / iPadOS, 홈 화면 PWA 포함): Web Share API 로 공유 시트를 열어
 *   "이미지 저장 / 파일에 저장"을 선택하게 합니다.
 *   (iOS 홈 화면 PWA 및 일부 인앱 브라우저는 <a download> 가 동작하지 않음)
 * - 데스크톱: <a download> 로 즉시 다운로드
 * - 공유 시트가 거부되거나 지원되지 않으면 <a download> 로 폴백,
 *   그것도 불가하면 새 탭으로 열기
 */

export type SaveResult = "shared" | "downloaded" | "opened" | "cancelled";

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPad|iPod/i.test(ua)) return true;
  // iPadOS 13+ 는 Macintosh UA 로 위장
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function triggerAnchorDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Blob 또는 URL(blob: / data:)을 기기에 저장합니다.
 * 사용자 제스처(클릭) 핸들러 안에서 호출해야 합니다.
 */
export async function saveFile(
  source: Blob | string,
  filename: string,
  mimeType?: string
): Promise<SaveResult> {
  const blob: Blob = typeof source === "string" ? await (await fetch(source)).blob() : source;
  const type = mimeType || blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type });

  if (
    isMobileDevice() &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
      // NotAllowedError(제스처 만료) 등 → 아래 폴백
      console.warn("공유 실패, 다운로드 방식으로 전환:", err);
    }
  }

  const url = URL.createObjectURL(blob);
  // 모바일 브라우저는 클릭 직후 revoke 하면 다운로드가 끊기므로 충분히 지연
  const revokeLater = (ms: number) => setTimeout(() => URL.revokeObjectURL(url), ms);

  if ("download" in document.createElement("a")) {
    triggerAnchorDownload(url, filename);
    revokeLater(30000);
    return "downloaded";
  }

  window.open(url, "_blank");
  revokeLater(60000);
  return "opened";
}

