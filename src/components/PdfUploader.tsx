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
    <div className="flex-1 flex flex-col items-center justify-center w-full max-w-4xl mx-auto px-4 py-12 relative z-10">
      {/* 구글 폰트 로드 */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&family=Playfair+Display:ital,wght@0,700;1,400&display=swap');
      `}</style>

      {/* 헤드라인 메시지 (Novu 스타일) */}
      <div className="text-center mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight" style={{ fontFamily: "Outfit, sans-serif" }}>
          Edit your <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">PDF.</span><br />
          Own your <span className="italic font-serif font-normal text-indigo-200">document.</span>
        </h1>
        <p className="text-slate-400 text-sm sm:text-base font-normal max-w-lg mx-auto leading-relaxed">
          클라이언트 사이드에서 완전하게 개인 정보가 보호되는 직관적인 스마트 PDF/OCR 편집기. 파일을 업로드하고 즉시 텍스트와 서명을 편집하세요.
        </p>
      </div>

      {/* 글래스모피즘 드롭존 카드 */}
      <div
        className={`w-full max-w-xl p-10 sm:p-12 rounded-3xl transition-all duration-300 flex flex-col items-center justify-center cursor-pointer border backdrop-blur-xl relative overflow-hidden group shadow-[0_20px_50px_rgba(0,0,0,0.3)]
          ${
            isDragging
              ? "border-indigo-400 bg-indigo-950/20 scale-[1.02] shadow-[0_20px_50px_rgba(99,102,241,0.15)]"
              : "border-white/10 bg-slate-950/30 hover:border-white/20 hover:bg-slate-950/40"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("file-upload")?.click()}
      >
        {/* 드롭 영역 내부 데코 배너 */}
        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="w-16 h-16 mb-6 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
          <UploadCloud
            className={`w-8 h-8 transition-colors duration-300 ${
              isDragging ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-300"
            }`}
          />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2 text-center group-hover:text-indigo-200 transition-colors" style={{ fontFamily: "Outfit, sans-serif" }}>
          PDF 또는 이미지 드래그 앤 드롭
        </h3>
        <p className="text-slate-400 text-xs sm:text-sm text-center mb-8">
          또는 클립보드 붙여넣기 및 클릭으로 파일 탐색
        </p>

        <input
          id="file-upload"
          type="file"
          accept="application/pdf, image/jpeg, image/png"
          className="hidden"
          onChange={handleFileChange}
        />
        
        {/* Novu의 Download App 버튼 스타일 */}
        <button className="px-8 py-3 bg-white text-slate-950 rounded-full font-bold text-sm shadow-[0_4px_20px_rgba(255,255,255,0.1)] hover:bg-slate-100 hover:shadow-[0_4px_25px_rgba(255,255,255,0.25)] transition-all duration-300 hover:scale-105 active:scale-98">
          파일 불러오기
        </button>
      </div>
    </div>
  );
}
