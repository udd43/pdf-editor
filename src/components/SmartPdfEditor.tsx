import React, { useState } from 'react';
import { UploadCloud, Sparkles, FileText, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SmartPdfEditor() {
  const [file, setFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected && selected.type === "application/pdf") {
      setFile(selected);
    } else if (selected) {
      toast.error("PDF 파일만 업로드 가능합니다.");
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") {
      setFile(dropped);
    } else if (dropped) {
      toast.error("PDF 파일만 업로드 가능합니다.");
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto flex flex-col h-[80vh]">
      {!file ? (
        <div className="flex flex-col items-center justify-center flex-1">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center p-3 bg-amber-100 text-amber-600 rounded-2xl mb-4">
              <Sparkles className="w-8 h-8" />
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4 tracking-tight">
              스마트 편집 <span className="text-amber-500">Beta</span>
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              PDF 문서의 구조를 스캔하여 마치 워드(Word)처럼 내용과 표를 클릭하여 바로 수정할 수 있습니다.
            </p>
            <div className="flex items-center justify-center gap-2 mt-4 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-2 rounded-full font-medium">
              <AlertCircle className="w-4 h-4" />
              <span>디지털(컴퓨터 생성) PDF 전용 기능입니다. (스캔본/이미지는 지원하지 않습니다)</span>
            </div>
          </div>

          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="w-full max-w-2xl aspect-video flex flex-col items-center justify-center border-3 border-dashed border-gray-300 dark:border-gray-700 hover:border-amber-400 dark:hover:border-amber-500 rounded-3xl bg-white dark:bg-gray-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all cursor-pointer group shadow-sm"
          >
            <div className="p-5 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-full mb-6 group-hover:scale-110 group-hover:bg-amber-100 transition-all duration-300">
              <UploadCloud className="w-10 h-10" />
            </div>
            <p className="text-xl font-bold text-gray-700 dark:text-gray-200 mb-2">
              PDF 파일을 이곳에 놓거나 클릭하여 업로드
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              최대 20MB 지원
            </p>
            <input
              type="file"
              className="hidden"
              accept="application/pdf"
              onChange={handleFileChange}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* 에디터 툴바 영역 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-amber-500" />
              <span className="font-semibold text-gray-800 dark:text-gray-200 truncate max-w-sm">
                {file.name}
              </span>
            </div>
            <button
              onClick={() => setFile(null)}
              className="text-sm px-4 py-2 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-lg font-medium transition-colors"
            >
              다른 파일 선택
            </button>
          </div>
          
          {/* 파싱 및 편집 캔버스 영역 (Phase 2에서 구현) */}
          <div className="flex-1 flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">문서 구조를 분석하고 있습니다...</p>
          </div>
        </div>
      )}
    </div>
  );
}
