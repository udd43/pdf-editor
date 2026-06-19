import React, { useState, useRef } from 'react';
import { UploadCloud, Download, Trash2, ArrowUp, ArrowDown, FileImage, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { PDFDocument } from 'pdf-lib';

interface ImageFile {
  id: string;
  file: File;
  previewUrl: string;
}

export default function ImageToPdfConverter() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter(f => f.type === 'image/jpeg' || f.type === 'image/png');
    
    if (validFiles.length !== selectedFiles.length) {
      toast.error('PNG, JPEG 이미지만 업로드 가능합니다.');
    }

    const newImages = validFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newImages = [...images];
    if (direction === 'up' && index > 0) {
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
    } else if (direction === 'down' && index < newImages.length - 1) {
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
    }
    setImages(newImages);
  };

  const handleConvert = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    const toastId = toast.loading('PDF 변환 중...');

    try {
      const pdfDoc = await PDFDocument.create();

      for (const imgData of images) {
        const buffer = await imgData.file.arrayBuffer();
        let pdfImage;

        if (imgData.file.type === 'image/png') {
          pdfImage = await pdfDoc.embedPng(buffer);
        } else if (imgData.file.type === 'image/jpeg') {
          pdfImage = await pdfDoc.embedJpg(buffer);
        } else {
          continue;
        }

        const { width, height } = pdfImage.scale(1);
        const page = pdfDoc.addPage([width, height]);
        page.drawImage(pdfImage, {
          x: 0,
          y: 0,
          width,
          height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `merged_images_${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success('PDF 변환 완료!', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('PDF 변환 중 오류가 발생했습니다.', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2">이미지 → PDF 변환</h1>
        <p className="text-gray-500 dark:text-gray-400">여러 장의 이미지를 하나의 PDF로 병합해 드립니다. 원본 크기 그대로 유지됩니다.</p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700">
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-gray-50 dark:bg-white/5 border-gray-300 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors">
          <UploadCloud className="w-10 h-10 text-blue-500 mb-2" />
          <span className="text-sm font-medium text-gray-700 dark:text-white">클릭하여 이미지 파일(PNG, JPEG) 여러 장 업로드</span>
          <input ref={fileInputRef} type="file" multiple accept="image/png, image/jpeg" className="hidden" onChange={handleFileChange} />
        </label>

        {images.length > 0 && (
          <div className="mt-6 flex flex-col gap-4">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200">업로드된 이미지 ({images.length}장)</h3>
            <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-2">
              {images.map((img, idx) => (
                <div key={img.id} className="flex items-center gap-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                  <span className="text-gray-500 font-mono text-sm w-4">{idx + 1}</span>
                  <img src={img.previewUrl} alt="preview" className="w-16 h-16 object-cover rounded-md shadow-sm border border-gray-200" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{img.file.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{(img.file.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => moveImage(idx, 'up')} disabled={idx === 0} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30">
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <button onClick={() => moveImage(idx, 'down')} disabled={idx === images.length - 1} className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md disabled:opacity-30">
                      <ArrowDown className="w-4 h-4" />
                    </button>
                    <button onClick={() => removeImage(img.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md ml-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setImages([])} className="text-sm text-gray-500 hover:text-red-500">전체 삭제</button>
              <button 
                onClick={handleConvert} 
                disabled={isProcessing}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-semibold shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileImage className="w-5 h-5" />}
                {isProcessing ? '변환 중...' : 'PDF로 병합하기'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
