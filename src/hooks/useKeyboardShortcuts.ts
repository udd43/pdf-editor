import { useEffect, useRef } from "react";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";

interface UseKeyboardShortcutsProps {
  status: string;
  selectedImageId: string | null;
  selectedTextId: string | null;
  imageOverlays: ImageOverlayData[];
  textBoxes: TextBox[];
  undo: () => void;
  redo: () => void;
  saveHistory: (boxes: TextBox[], overlays: ImageOverlayData[]) => void;
  nextId: number;
  currentPage: number;
  setTextBoxes: React.Dispatch<React.SetStateAction<TextBox[]>>;
  setImageOverlays: React.Dispatch<React.SetStateAction<ImageOverlayData[]>>;
  setNextId: React.Dispatch<React.SetStateAction<number>>;
  setSelectedImageId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTextId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useKeyboardShortcuts({
  status, selectedImageId, selectedTextId, imageOverlays, textBoxes,
  undo, redo, saveHistory, nextId, currentPage, setTextBoxes, setImageOverlays, setNextId, setSelectedImageId, setSelectedTextId
}: UseKeyboardShortcutsProps) {
  const pressedKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status !== "done") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      pressedKeys.current.add(e.code);

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          redo();
        } else {
          e.preventDefault();
          undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // 방향키 정밀 이동
      if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
        if (selectedTextId || selectedImageId) {
          e.preventDefault();
          saveHistory(textBoxes, imageOverlays);
          const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
          const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          
          if (selectedTextId) {
            setTextBoxes(prev => prev.map(b => b.id === selectedTextId ? { ...b, x: b.x + dx, y: b.y + dy } : b));
          } else if (selectedImageId) {
            setImageOverlays(prev => prev.map(o => o.id === selectedImageId ? { ...o, x: o.x + dx, y: o.y + dy } : o));
          }
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedImageId) {
          saveHistory(textBoxes, imageOverlays);
          setImageOverlays((prev) => prev.filter((o) => o.id !== selectedImageId));
          setSelectedImageId(null);
        } else if (selectedTextId) {
          saveHistory(textBoxes, imageOverlays);
          setTextBoxes((prev) => prev.filter((b) => b.id !== selectedTextId));
          setSelectedTextId(null);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedImageId) {
          const target = imageOverlays.find(o => o.id === selectedImageId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "image", data: target }));
        } else if (selectedTextId) {
          const target = textBoxes.find(b => b.id === selectedTextId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "text", data: target }));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const copied = sessionStorage.getItem("pdfitor_clipboard_overlay");
        if (copied) {
          const parsed = JSON.parse(copied);
          saveHistory(textBoxes, imageOverlays);
          if (parsed.type === "image") {
            const target = parsed.data as ImageOverlayData;
            const newOverlay: ImageOverlayData = { ...target, id: `copy-${Date.now()}`, x: target.x + 20, y: target.y + 20, pageIndex: currentPage };
            setImageOverlays(prev => [...prev, newOverlay]);
            setSelectedImageId(newOverlay.id);
            setSelectedTextId(null);
          } else if (parsed.type === "text") {
            const target = parsed.data as TextBox;
            const newBox: TextBox = { ...target, id: `new-${nextId}`, x: target.x + 20, y: target.y + 20, pageIndex: currentPage };
            setTextBoxes(prev => [...prev, newBox]);
            setNextId(prev => prev + 1);
            setSelectedTextId(newBox.id);
            setSelectedImageId(null);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [status, selectedImageId, selectedTextId, imageOverlays, textBoxes, undo, redo, saveHistory, nextId, currentPage, setTextBoxes, setImageOverlays, setNextId, setSelectedImageId, setSelectedTextId]);
}
