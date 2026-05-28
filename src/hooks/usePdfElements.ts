import { useState, useCallback, useRef } from 'react';
import { TextBox } from '@/components/PdfEditor';
import { ImageOverlayData } from '@/components/ImageOverlay';

interface HistoryState {
  textBoxes: TextBox[];
  imageOverlays: ImageOverlayData[];
}

export function usePdfElements() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlayData[]>([]);
  
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [nextId, setNextId] = useState(0);

  // 히스토리 스택
  const past = useRef<HistoryState[]>([]);
  const future = useRef<HistoryState[]>([]);
  const isUpdatingHistory = useRef(false);

  const saveHistory = useCallback((currentTextBoxes: TextBox[], currentOverlays: ImageOverlayData[]) => {
    if (isUpdatingHistory.current) return;
    past.current.push({
      textBoxes: JSON.parse(JSON.stringify(currentTextBoxes)),
      imageOverlays: JSON.parse(JSON.stringify(currentOverlays)),
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
    });
    
    // 과거 상태를 팝해서 현재로 설정
    const previous = past.current.pop()!;
    setTextBoxes(previous.textBoxes);
    setImageOverlays(previous.imageOverlays);
    setSelectedImageId(null);
    setSelectedTextId(null);
    
    setTimeout(() => { isUpdatingHistory.current = false; }, 0);
  }, [textBoxes, imageOverlays]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    isUpdatingHistory.current = true;
    
    // 현재 상태를 past에 푸시
    past.current.push({
      textBoxes: JSON.parse(JSON.stringify(textBoxes)),
      imageOverlays: JSON.parse(JSON.stringify(imageOverlays)),
    });
    
    // 미래 상태를 팝해서 현재로 설정
    const next = future.current.pop()!;
    setTextBoxes(next.textBoxes);
    setImageOverlays(next.imageOverlays);
    setSelectedImageId(null);
    setSelectedTextId(null);
    
    setTimeout(() => { isUpdatingHistory.current = false; }, 0);
  }, [textBoxes, imageOverlays]);

  const addTextBox = useCallback((newBox: Omit<TextBox, 'id'>) => {
    saveHistory(textBoxes, imageOverlays);
    const id = `new-${nextId}`;
    setTextBoxes((prev) => [...prev, { ...newBox, id }]);
    setSelectedTextId(id);
    setSelectedImageId(null);
    setNextId((prev) => prev + 1);
    return id;
  }, [nextId, textBoxes, imageOverlays, saveHistory]);

  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, [textBoxes, imageOverlays, saveHistory]);

  const removeTextBox = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays);
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
    setSelectedTextId((prev) => (prev === id ? null : prev));
  }, [textBoxes, imageOverlays, saveHistory]);

  const addImageOverlay = useCallback((newOverlay: Omit<ImageOverlayData, 'id'>) => {
    saveHistory(textBoxes, imageOverlays);
    const id = `img-${Date.now()}`;
    setImageOverlays((prev) => [...prev, { ...newOverlay, id }]);
    setSelectedImageId(id);
    setSelectedTextId(null);
    return id;
  }, [textBoxes, imageOverlays, saveHistory]);

  const updateImageOverlay = useCallback((id: string, updates: Partial<ImageOverlayData>) => {
    saveHistory(textBoxes, imageOverlays);
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  }, [textBoxes, imageOverlays, saveHistory]);

  const removeImageOverlay = useCallback((id: string) => {
    saveHistory(textBoxes, imageOverlays);
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedImageId((prev) => (prev === id ? null : prev));
  }, [textBoxes, imageOverlays, saveHistory]);

  // 내부 상태를 한 번에 덮어쓸 때 (주로 초기 로드용)
  const resetElements = useCallback(() => {
    setTextBoxes([]);
    setImageOverlays([]);
    setSelectedImageId(null);
    setSelectedTextId(null);
    setNextId(0);
    past.current = [];
    future.current = [];
  }, []);

  return {
    textBoxes,
    setTextBoxes, // 직접 접근 지양 권장하지만 유지
    imageOverlays,
    setImageOverlays,
    selectedImageId,
    setSelectedImageId,
    selectedTextId,
    setSelectedTextId,
    nextId,
    setNextId,
    addTextBox,
    updateTextBox,
    removeTextBox,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
    undo,
    redo,
    saveHistory,
    resetElements,
  };
}
