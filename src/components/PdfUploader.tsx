

import React, { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";
import { PDFDocument } from "pdf-lib";
import toast from "react-hot-toast";

interface PdfUploaderProps {
  onFileSelect: (file: File) => void;
}

export default function PdfUploader({ onFileSelect }: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      onFileSelect(file);
    } else if (file.type.startsWith("image/")) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.create();
        let image;
        if (file.type === "image/png") {
          image = await pdfDoc.embedPng(arrayBuffer);
        } else if (file.type === "image/jpeg" || file.type === "image/jpg") {
          image = await pdfDoc.embedJpg(arrayBuffer);
        } else {
          toast.error("지원하지 않는 이미지 형식입니다. (JPG, PNG만 가능)");
          return;
        }
        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const newFile = new File([blob], `${file.name.split('.')[0]}.pdf`, { type: "application/pdf" });
        onFileSelect(newFile);
      } catch (err) {
        console.error(err);
        toast.error("이미지를 PDF로 변환하는 중 오류가 발생했습니다.");
      }
    } else {
      toast.error("PDF 또는 이미지 파일(JPG, PNG)만 업로드 가능합니다.");
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [onFileSelect]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [onFileSelect]
  );

  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 py-12 relative z-10">
      <div
        className={`w-full max-w-4xl min-h-[340px] p-12 sm:p-16 rounded-xl transition-colors flex flex-col items-center justify-center cursor-pointer border border-dashed relative overflow-hidden group bg-white dark:bg-[#12151C] ${
          isDragging
            ? "border-[#2563EB] bg-[#2563EB]/5"
            : "border-[#CBD2E0] dark:border-[#333B4D] hover:border-[#2563EB] dark:hover:border-[#3B82F6]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <div className="flex items-center gap-2.5 mb-2">
          <UploadCloud className="w-6 h-6 text-[#2563EB] dark:text-[#3B82F6]" />
          <h2 className="text-xl font-bold text-[#0F141C] dark:text-[#F3F5F8]">
            PDF 또는 이미지 드래그 앤 드롭
          </h2>
        </div>
        <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] text-center mb-6">
          편집 및 저장은 브라우저 로컬 메모리에서 안전하게 처리됩니다.
        </p>

        <input
          id="file-upload"
          type="file"
          accept="application/pdf, image/jpeg, image/png"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          className="px-5 py-2.5 rounded-lg bg-[#2563EB] group-hover:bg-[#1D4ED8] text-white font-semibold text-xs transition-colors"
        >
          파일 불러오기
        </button>
      </div>
    </div>
  );
}
