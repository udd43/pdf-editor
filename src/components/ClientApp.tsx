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

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string; activeBg: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-indigo-600", activeBg: "bg-indigo-50/70 text-indigo-700 border border-indigo-100/50" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-pink-600", activeBg: "bg-pink-50/70 text-pink-700 border border-pink-100/50" },
    { id: "upscale", label: "업스케일링", icon: <ZoomIn className="w-3.5 h-3.5" />, color: "text-purple-600", activeBg: "bg-purple-50/70 text-purple-700 border border-purple-100/50" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col relative overflow-hidden font-sans antialiased">
      {/* 백그라운드 디자인 그라데이션 구체들 */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-purple-600/30 to-indigo-500/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] rounded-full bg-gradient-to-tr from-pink-500/20 to-purple-600/20 blur-[130px] pointer-events-none" />
      <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] rounded-full bg-gradient-to-tr from-sky-500/10 to-indigo-600/10 blur-[100px] pointer-events-none" />

      {/* 헤더 (글래스모피즘) */}
      <header className="backdrop-blur-xl bg-slate-950/40 border-b border-white/5 sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* 로고 (Serif 풍의 우아한 로고) */}
          <div className="flex-1 flex justify-start">
            <button 
              onClick={() => {
                setFile(null);
                setReferenceFile(null);
                setActiveTab("pdf");
              }}
              className="shrink-0 outline-none flex items-center gap-2 group"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
                <span className="text-white text-base font-black">P</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white group-hover:text-indigo-200 transition-colors" style={{ fontFamily: "Outfit, system-ui, sans-serif" }}>
                pdf<span className="font-light text-slate-400">novu</span>
              </span>
            </button>
          </div>

          {/* 중앙 네비게이션 탭 (Novu의 헤더 스타일 참조) */}
          <nav className="shrink-0 flex items-center bg-white/5 backdrop-blur-md rounded-full p-1 border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-full transition-all duration-300 ${
                  activeTab === tab.id
                    ? `${tab.activeBg} shadow-md scale-105`
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* 우측 컨트롤 */}
          <div className="flex-1 flex justify-end gap-2">
            {activeTab === "pdf" && file && (
              <>
                <button onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-xs text-indigo-300 bg-white/5 px-4 py-2 rounded-full border border-white/10 hover:bg-white/10 transition-all font-semibold shadow-sm hover:scale-102">
                  + 대조 원본 추가
                </button>
                <input id="ref-upload" type="file" accept="application/pdf" className="hidden" onChange={handleReferenceSelect} />
                <button onClick={() => { setFile(null); setReferenceFile(null); }}
                  className="text-xs text-slate-400 hover:text-slate-200 px-3 py-2 rounded-full hover:bg-white/5 transition-all">
                  처음으로
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 메인 내용 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 z-10">
        {activeTab === "pdf" && (
          !file ? <PdfUploader onFileSelect={setFile} /> : (
            <div className={`w-full flex gap-6 ${referenceFile ? "flex-row" : "justify-center"}`}>
              {referenceFile && (
                <div className="w-1/2 flex flex-col border border-white/10 shadow-2xl rounded-2xl overflow-hidden bg-slate-950/80 backdrop-blur-lg h-[80vh] sticky top-24">
                  <div className="bg-slate-900/90 px-4 py-3 border-b border-white/5 flex justify-between items-center shrink-0">
                    <span className="text-sm font-semibold text-slate-300 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      👀 대조 원본 PDF
                    </span>
                    <button onClick={() => setReferenceFile(null)} className="text-xs px-3 py-1 bg-white/5 hover:bg-red-500/10 rounded-lg text-red-400 border border-red-500/20 transition-all">닫기</button>
                  </div>
                  <iframe src={URL.createObjectURL(referenceFile)} className="w-full h-full border-0 invert opacity-90 filter hue-rotate-180" />
                </div>
              )}
              <div className={`${referenceFile ? "w-1/2" : "w-full max-w-7xl"}`}>
                <PdfEditor file={file} />
              </div>
            </div>
          )
        )}
        {activeTab === "bgremove" && <BgRemover />}
        {activeTab === "upscale" && <ImageUpscaler />}
      </main>

      {/* 푸터 */}
      <footer className="bg-slate-950/50 backdrop-blur-md py-4 mt-auto border-t border-white/5 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-slate-500 text-xs">
          <span className="font-mono text-indigo-400 bg-indigo-950/30 border border-indigo-900/30 px-2 py-0.5 rounded-full">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          <span className="font-medium">&copy; 2026 pdfnovu &middot; 모든 연산은 웹에서 안전하게 처리됩니다</span>
        </div>
      </footer>
    </div>
  );
}
