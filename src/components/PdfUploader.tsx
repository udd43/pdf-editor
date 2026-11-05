

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
        className={`w-full max-w-4xl min-h-[380px] p-12 sm:p-16 transition-colors flex flex-col items-center justify-center cursor-pointer border border-dashed relative overflow-hidden group bg-[#FDFBF7] dark:bg-[#1A1918] ${
          isDragging
            ? "border-[#C83E2B] bg-[#F3EFE4] dark:bg-[#22211F]"
            : "border-[#BFB7A6] dark:border-[#3A3834] hover:border-[#161514] dark:hover:border-[#F2EFE9] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <div className="w-14 h-14 mb-6 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] flex items-center justify-center">
          <UploadCloud
            className={`w-6 h-6 transition-colors ${
              isDragging
                ? "text-[#C83E2B]"
                : "text-[#161514] dark:text-[#F2EFE9] group-hover:text-[#C83E2B]"
            }`}
          />
        </div>

        <h3 className="font-editorial text-2xl font-bold text-[#161514] dark:text-[#F2EFE9] mb-2 text-center">
          PDF 또는 이미지 드래그 앤 드롭
        </h3>
        <p className="font-mono text-xs text-[#8A847C] dark:text-[#6E6A63] text-center mb-8">
          LOCAL EXECUTION &middot; ZERO SERVER UPLOAD
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
          className="px-6 py-2.5 bg-[#161514] group-hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:group-hover:bg-[#E05A47] text-[#F9F6ED] dark:text-[#161514] dark:group-hover:text-[#F9F6ED] font-bold text-xs transition-colors"
        >
          파일 불러오기
        </button>
      </div>
    </div>
  );
}
