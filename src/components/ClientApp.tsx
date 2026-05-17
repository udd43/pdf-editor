"use client";

import React, { useState } from "react";
import { FileText, Scissors, ZoomIn } from "lucide-react";
import PdfUploader from "@/components/PdfUploader";
import PdfEditor from "@/components/PdfEditor";
import BgRemover from "@/components/BgRemover";
import ImageUpscaler from "@/components/ImageUpscaler";

type Tab = "pdf" | "bgremove" | "upscale";

export default function ClientApp() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("pdf");

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setReferenceFile(file);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-blue-600" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-amber-600" },
    { id: "upscale", label: "업스케일링", icon: <ZoomIn className="w-3.5 h-3.5" />, color: "text-indigo-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* 로고 (클릭 시 처음 화면으로 복귀) */}
          <button 
            onClick={() => {
              setFile(null);
              setReferenceFile(null);
              setActiveTab("pdf");
            }}
            className="shrink-0 outline-none flex items-center"
          >
            <span className="text-xl font-black text-blue-700 tracking-tight hover:text-blue-800 transition-colors">PDF Editor</span>
          </button>

          {/* 중앙 탭 */}
          <nav className="flex items-center bg-gray-100 rounded-full p-1 gap-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
                  activeTab === tab.id
                    ? `bg-white ${tab.color} shadow-sm`
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* 우측 */}
          <div className="shrink-0 min-w-[100px] flex justify-end gap-2">
            {activeTab === "pdf" && file && (
              <>
                <button onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-xs text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors font-medium shadow-sm">
                  + 대조용 원본 열기
                </button>
                <input id="ref-upload" type="file" accept="application/pdf" className="hidden" onChange={handleReferenceSelect} />
                <button onClick={() => { setFile(null); setReferenceFile(null); }}
                  className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                  새 파일 열기
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center p-4">
        {activeTab === "pdf" && (
          !file ? <PdfUploader onFileSelect={setFile} /> : (
            <div className={`w-full flex gap-6 ${referenceFile ? "flex-row" : "justify-center"}`}>
              {referenceFile && (
                <div className="w-1/2 flex flex-col border shadow-xl rounded-xl overflow-hidden bg-white h-[85vh] sticky top-20">
                  <div className="bg-gray-100 px-4 py-2 border-b flex justify-between items-center shrink-0">
                    <span className="text-sm font-bold text-gray-700">👀 대조용 원본 (참고용)</span>
                    <button onClick={() => setReferenceFile(null)} className="text-xs px-2 py-1 bg-white border rounded text-red-500 hover:bg-red-50 transition-colors">닫기</button>
                  </div>
                  <iframe src={URL.createObjectURL(referenceFile)} className="w-full h-full border-0" />
                </div>
              )}
              <div className={`${referenceFile ? "w-1/2" : "w-full max-w-5xl"}`}>
                <PdfEditor file={file} />
              </div>
            </div>
          )
        )}
        {activeTab === "bgremove" && <BgRemover />}
        {activeTab === "upscale" && <ImageUpscaler />}
      </main>

      <footer className="bg-white py-3 mt-auto border-t">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-xs">
          &copy; 2026 PDF Editor &middot; 모든 처리는 브라우저에서 수행됩니다
        </div>
      </footer>
    </div>
  );
}
