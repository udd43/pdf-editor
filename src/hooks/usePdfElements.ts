import { useState, useCallback, useRef } from 'react';
import { TextBox } from '@/components/PdfEditor';
import { ImageOverlayData } from '@/components/ImageOverlay';

export interface RedactionData {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface HistoryState {
  textBoxes: TextBox[];
  imageOverlays: ImageOverlayData[];
  redactions: RedactionData[];
}

export function usePdfElements() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlayData[]>([]);
  const [redactions, setRedactions] = useState<RedactionData[]>([]);
  
  const [selectedRedactionId, setSelectedRedactionId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [nextId, setNextId] = useState(0);

  // 히스토리 스택
  const past = useRef<HistoryState[]>([]);
  const future = useRef<HistoryState[]>([]);
  const isUpdatingHistory = useRef(false);

  const saveHistory = useCallback((currentTextBoxes: TextBox[], currentOverlays: ImageOverlayData[], currentRedactions: RedactionData[]) => {
    if (isUpdatingHistory.current) return;
    past.current.push({
      textBoxes: JSON.parse(JSON.stringify(currentTextBoxes)),
      imageOverlays: JSON.parse(JSON.stringify(currentOverlays)),
      redactions: JSON.parse(JSON.stringify(currentRedactions)),
    });
    // 최대 30개까지만 저장
    if (past.current.length > 30) {
      past.current.shift();
    }
    future.current = [];
  }, []);

  const undo = useCallback(() => {
    if (past.current.length === 0) return;
    isUpdatingHistory.current = true;
    
    // 현재 상태를 future에 푸시
    future.current.push({
      textBoxes: JSON.parse(JSON.stringify(textBoxes)),
      imageOverlays: JSON.parse(JSON.stringify(imageOverlays)),
      redactions: JSON.parse(JSON.stringify(redactions)),
    });
    
    // 과거 상태를 팝해서 현재로 설정
    const previous = past.current.pop()!;
    setTextBoxes(previous.textBoxes);
    setImageOverlays(previous.imageOverlays);
    setRedactions(previous.redactions);
    setSelectedImageId(null);
    setSelectedTextId(null);
    setSelectedRedactionId(null);
    
    setTimeout(() => { isUpdatingHistory.current = false; }, 0);
  }, [textBoxes, imageOverlays, redactions]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    isUpdatingHistory.current = true;
    
    // 현재 상태를 past에 푸시
    past.current.push({
      textBoxes: JSON.parse(JSON.stringify(textBoxes)),
      imageOverlays: JSON.parse(JSON.stringify(imageOverlays)),
      redactions: JSON.parse(JSON.stringify(redactions)),
    });
    
    // 미래 상태를 팝해서 현재로 설정
    const next = future.current.pop()!;
    setTextBoxes(next.textBoxes);
    setImageOverlays(next.imageOverlays);
    setRedactions(next.redactions);
    setSelectedImageId(null);
    setSelectedTextId(null);
    setSelectedRedactionId(null);
    
    setTimeout(() => { isUpdatingHistory.current = false; }, 0);
  }, [textBoxes, imageOverlays, redactions]);

  const addTextBox = useCallback((newBox: Omit<TextBox, 'id'>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    const id = `new-${nextId}`;
    setTextBoxes((prev) => [...prev, { ...newBox, id }]);
    setSelectedTextId(id);
    setSelectedImageId(null);
    setNextId((prev) => prev + 1);
    return id;
  }, [nextId, textBoxes, imageOverlays, redactions, saveHistory]);

  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const removeTextBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedTextId((prev) => (prev === id ? null : prev));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const addImageOverlay = useCallback((newOverlay: Omit<ImageOverlayData, 'id'>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    const id = `img-${Date.now()}`;
    setImageOverlays((prev) => [...prev, { ...newOverlay, id }]);
    setSelectedImageId(id);
    setSelectedTextId(null);
    return id;
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const updateImageOverlay = useCallback((id: string, updates: Partial<ImageOverlayData>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const removeImageOverlay = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedImageId((prev) => (prev === id ? null : prev));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const addRedaction = useCallback((newRedaction: Omit<RedactionData, 'id'>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    const id = `redact-${Date.now()}`;
    setRedactions((prev) => [...prev, { ...newRedaction, id }]);
    setSelectedRedactionId(id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    return id;
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const updateRedaction = useCallback((id: string, updates: Partial<RedactionData>) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setRedactions((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  const removeRedaction = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays, redactions);
    setRedactions((prev) => prev.filter((r) => r.id !== id));
    setSelectedRedactionId((prev) => (prev === id ? null : prev));
  }, [textBoxes, imageOverlays, redactions, saveHistory]);

  // 내부 상태를 한 번에 덮어쓸 때 (주로 초기 로드용)
  const resetElements = useCallback(() => {
    setTextBoxes([]);
    setImageOverlays([]);
    setRedactions([]);
    setSelectedImageId(null);
    setSelectedTextId(null);
    setSelectedRedactionId(null);
    setNextId(0);
    past.current = [];
    future.current = [];
  }, []);

  return {
    textBoxes,
    setTextBoxes, // 직접 접근 지양 권장하지만 유지
    imageOverlays,
    setImageOverlays,
    redactions,
    setRedactions,
    selectedImageId,
    setSelectedImageId,
    selectedTextId,
    setSelectedTextId,
    selectedRedactionId,
    setSelectedRedactionId,
    nextId,
    setNextId,
    addTextBox,
    updateTextBox,
    removeTextBox,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
    addRedaction,
    updateRedaction,
    removeRedaction,
    undo,
    redo,
    saveHistory,
    resetElements,
  };
}
