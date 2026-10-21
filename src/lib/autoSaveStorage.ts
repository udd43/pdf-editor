import { get, set, del } from "idb-keyval";
import type { TextBox, ImageOverlayData, RedactionData } from "@/types/pdf";

const STORAGE_KEY = "pdf_editor_autosave_session";

export interface AutoSaveSession {
  fileName: string;
  fileSize: number;
  fileBuffer: ArrayBuffer;
  textBoxes: TextBox[];
  imageOverlays: ImageOverlayData[];
  redactions: RedactionData[];
  currentPage: number;
  updatedAt: number; // Date.now()
}

/**
 * Save current PDF editor state to IndexedDB.
 */
export async function saveEditorSession(session: AutoSaveSession): Promise<void> {
  try {
    await set(STORAGE_KEY, session);
  } catch (err) {
    console.warn("Failed to auto-save session to IndexedDB:", err);
  }
}

/**
 * Load saved PDF editor session from IndexedDB.
 */
export async function loadEditorSession(): Promise<AutoSaveSession | null> {
  try {
    const data = await get<AutoSaveSession>(STORAGE_KEY);
    if (!data || !data.fileBuffer || !(data.fileBuffer instanceof ArrayBuffer)) {
      return null;
    }
    return data;
  } catch (err) {
    console.warn("Failed to load auto-saved session from IndexedDB:", err);
    return null;
  }
}

/**
 * Clear the saved session from IndexedDB.
 */
export async function clearEditorSession(): Promise<void> {
  try {
    await del(STORAGE_KEY);
  } catch (err) {
    console.warn("Failed to clear auto-saved session:", err);
  }
}

/**
 * Format relative or localized time for display.
 */
export function formatAutoSaveTime(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 60) return "방금 전";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;

  const d = new Date(timestamp);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}
