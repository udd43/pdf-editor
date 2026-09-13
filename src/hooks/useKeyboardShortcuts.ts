import { useEffect, useRef } from "react";
import { TextBox } from "@/components/PdfEditor";
import { ImageOverlayData } from "@/components/ImageOverlay";

interface UseKeyboardShortcutsProps {
  status: string;
  selectedImageId: string | null;
  selectedTextId: string | null;
  selectedRedactionId: string | null;
  imageOverlays: ImageOverlayData[];
  textBoxes: TextBox[];
  redactions: any[]; // RedactionData
  undo: () => void;
  redo: () => void;
  saveHistory: (boxes: TextBox[], overlays: ImageOverlayData[], redactions: any[]) => void;
  nextId: number;
  currentPage: number;
  setTextBoxes: React.Dispatch<React.SetStateAction<TextBox[]>>;
  setImageOverlays: React.Dispatch<React.SetStateAction<ImageOverlayData[]>>;
  setNextId: React.Dispatch<React.SetStateAction<number>>;
  setSelectedImageId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedRedactionId: React.Dispatch<React.SetStateAction<string | null>>;
  setRedactions: React.Dispatch<React.SetStateAction<any[]>>;
}

export function useKeyboardShortcuts({
  status, selectedImageId, selectedTextId, selectedRedactionId, imageOverlays, textBoxes, redactions,
  undo, redo, saveHistory, nextId, currentPage, setTextBoxes, setImageOverlays, setRedactions, setNextId, setSelectedImageId, setSelectedTextId, setSelectedRedactionId
}: UseKeyboardShortcutsProps) {
  const pressedKeys = useRef<Set<string>>(new Set());

  // 최신 상태를 ref에 보관하여 리스너 잦은 재등록 방지
  const stateRef = useRef({
    status,
    selectedImageId,
    selectedTextId,
    selectedRedactionId,
    imageOverlays,
    textBoxes,
    redactions,
    nextId,
    currentPage,
  });

  useEffect(() => {
    stateRef.current = {
      status,
      selectedImageId,
      selectedTextId,
      selectedRedactionId,
      imageOverlays,
      textBoxes,
      redactions,
      nextId,
      currentPage,
    };
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        status: curStatus,
        selectedImageId: curImgId,
        selectedTextId: curTxtId,
        selectedRedactionId: curRedId,
        imageOverlays: curOverlays,
        textBoxes: curBoxes,
        redactions: curRedactions,
        nextId: curNextId,
        currentPage: curPage,
      } = stateRef.current;

      if (curStatus !== "done") return;
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
        if (curTxtId || curImgId || curRedId) {
          e.preventDefault();
          saveHistory(curBoxes, curOverlays, curRedactions);
          const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
          const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
          
          if (curTxtId) {
            setTextBoxes(prev => prev.map(b => b.id === curTxtId ? { ...b, x: b.x + dx, y: b.y + dy } : b));
          } else if (curImgId) {
            setImageOverlays(prev => prev.map(o => o.id === curImgId ? { ...o, x: o.x + dx, y: o.y + dy } : o));
          } else if (curRedId) {
            setRedactions(prev => prev.map(r => r.id === curRedId ? { ...r, x: r.x + dx, y: r.y + dy } : r));
          }
        }
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (curImgId) {
          saveHistory(curBoxes, curOverlays, curRedactions);
          setImageOverlays((prev) => prev.filter((o) => o.id !== curImgId));
          setSelectedImageId(null);
        } else if (curTxtId) {
          saveHistory(curBoxes, curOverlays, curRedactions);
          setTextBoxes((prev) => prev.filter((b) => b.id !== curTxtId));
          setSelectedTextId(null);
        } else if (curRedId) {
          saveHistory(curBoxes, curOverlays, curRedactions);
          setRedactions((prev) => prev.filter((r) => r.id !== curRedId));
          setSelectedRedactionId(null);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (curImgId) {
          const target = curOverlays.find(o => o.id === curImgId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "image", data: target }));
        } else if (curTxtId) {
          const target = curBoxes.find(b => b.id === curTxtId);
          if (target) sessionStorage.setItem("pdfitor_clipboard_overlay", JSON.stringify({ type: "text", data: target }));
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        const copied = sessionStorage.getItem("pdfitor_clipboard_overlay");
        if (copied) {
          e.preventDefault(); // 시스템 paste 이벤트 중복 방지
          const parsed = JSON.parse(copied);
          saveHistory(curBoxes, curOverlays, curRedactions);
          if (parsed.type === "image") {
            const target = parsed.data as ImageOverlayData;
            const newOverlay: ImageOverlayData = { ...target, id: `copy-${Date.now()}`, x: target.x + 20, y: target.y + 20, pageIndex: curPage };
            setImageOverlays(prev => [...prev, newOverlay]);
            setSelectedImageId(newOverlay.id);
            setSelectedTextId(null);
          } else if (parsed.type === "text") {
            const target = parsed.data as TextBox;
            const newBox: TextBox = { ...target, id: `new-${curNextId}`, x: target.x + 20, y: target.y + 20, pageIndex: curPage };
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
  }, [undo, redo, saveHistory, setTextBoxes, setImageOverlays, setRedactions, setNextId, setSelectedImageId, setSelectedTextId, setSelectedRedactionId]);
}
