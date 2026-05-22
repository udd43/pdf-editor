import { useState, useCallback } from 'react';
import { TextBox } from '@/components/PdfEditor';
import { ImageOverlayData } from '@/components/ImageOverlay';

export function usePdfElements() {
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [imageOverlays, setImageOverlays] = useState<ImageOverlayData[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [nextId, setNextId] = useState(0);

  const addTextBox = useCallback((newBox: Omit<TextBox, 'id'>) => {
    const id = `new-${nextId}`;
    setTextBoxes((prev) => [...prev, { ...newBox, id }]);
    setNextId((prev) => prev + 1);
    return id;
  }, [nextId]);

  const updateTextBox = useCallback((id: string, updates: Partial<TextBox>) => {
    setTextBoxes((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  }, []);

  const removeTextBox = useCallback((id: string) => {
    setTextBoxes((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const addImageOverlay = useCallback((newOverlay: Omit<ImageOverlayData, 'id'>) => {
    const id = `img-${Date.now()}`;
    setImageOverlays((prev) => [...prev, { ...newOverlay, id }]);
    setSelectedImageId(id);
    return id;
  }, []);

  const updateImageOverlay = useCallback((id: string, updates: Partial<ImageOverlayData>) => {
    setImageOverlays((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
  }, []);

  const removeImageOverlay = useCallback((id: string) => {
    setImageOverlays((prev) => prev.filter((o) => o.id !== id));
    setSelectedImageId((prevSelected) => (prevSelected === id ? null : prevSelected));
  }, []);

  return {
    textBoxes,
    setTextBoxes,
    imageOverlays,
    setImageOverlays,
    selectedImageId,
    setSelectedImageId,
    nextId,
    setNextId,
    addTextBox,
    updateTextBox,
    removeTextBox,
    addImageOverlay,
    updateImageOverlay,
    removeImageOverlay,
  };
}
