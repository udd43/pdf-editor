"use client";

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
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 py-16 relative z-10">
      {/* 모던 클린 드롭존 카드 */}
      <div
        className={`w-full max-w-4xl min-h-[400px] sm:min-h-[500px] p-12 sm:p-20 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer border relative overflow-hidden group bg-white dark:bg-gray-800 shadow-sm
          ${
            isDragging
              ? "border-blue-500 dark:border-blue-400 bg-blue-50/50 dark:bg-blue-900/20 scale-[1.02] shadow-md"
              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        <div className="w-24 h-24 mb-8 rounded-3xl bg-gray-50 dark:bg-gray-700 border border-gray-100 dark:border-gray-600 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
          <UploadCloud
            className={`w-12 h-12 transition-colors duration-300 ${
              isDragging ? "text-blue-500 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300"
            }`}
          />
        </div>

        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center transition-colors">
          PDF 또는 이미지 드래그 앤 드롭
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm sm:text-base text-center mb-10">
          Private by default. 편집 및 저장은 브라우저 내에서 안전하게 처리됩니다.
        </p>

        <input
          id="file-upload"
          type="file"
          accept="application/pdf, image/jpeg, image/png"
          className="hidden"
          onChange={handleFileChange}
        />
        
        {/* 모던 SaaS 버튼 스타일 */}
        <button className="px-8 py-3.5 bg-blue-600 text-white rounded-full font-semibold text-base shadow-sm hover:bg-blue-700 transition-all duration-300 hover:scale-[1.02] active:scale-95">
          파일 불러오기
        </button>
      </div>
    </div>
  );
}
