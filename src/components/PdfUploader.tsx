"use client";

import React, { useCallback, useState } from "react";
import { UploadCloud } from "lucide-react";
import { PDFDocument } from "pdf-lib";

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
    if (file.type === "application/pdf") {
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
          alert("지원하지 않는 이미지 형식입니다. (JPG, PNG만 가능)");
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
        alert("이미지를 PDF로 변환하는 중 오류가 발생했습니다.");
      }
    } else {
      alert("PDF 또는 이미지 파일(JPG, PNG)만 업로드 가능합니다.");
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
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4">
      <div
        className={`w-full max-w-2xl p-16 border-4 border-dashed rounded-2xl transition-all flex flex-col items-center justify-center cursor-pointer
          ${
            isDragging
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
      <UploadCloud
        className={`w-16 h-16 mb-4 ${
          isDragging ? "text-blue-500" : "text-gray-400"
        }`}
      />
      <h3 className="text-xl font-semibold text-gray-700 mb-2">
        PDF 또는 이미지 파일을 이곳에 드롭하세요
      </h3>
      <p className="text-gray-500 mb-6">또는 클릭하여 파일을 선택하세요</p>
      <input
        id="file-upload"
        type="file"
        accept="application/pdf, image/jpeg, image/png"
        className="hidden"
        onChange={handleFileChange}
      />
        <button className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
          파일 찾아보기
        </button>
      </div>
    </div>
  );
}
