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
  const [activeTab, setActiveTab] = useState<Tab>("pdf");

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-blue-600" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-amber-600" },
    { id: "upscale", label: "업스케일링", icon: <ZoomIn className="w-3.5 h-3.5" />, color: "text-indigo-600" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900 hidden sm:inline">PDF Editor</span>
          </div>

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
          <div className="shrink-0 min-w-[100px] flex justify-end">
            {activeTab === "pdf" && file && (
              <button onClick={() => setFile(null)}
                className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                새 파일 열기
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {activeTab === "pdf" && (!file ? <PdfUploader onFileSelect={setFile} /> : <PdfEditor file={file} />)}
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
