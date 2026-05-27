"use client";

import React, { useState } from "react";
import { FileText, Scissors, ZoomIn, Palette } from "lucide-react";
import PdfUploader from "@/components/PdfUploader";
import PdfEditor from "@/components/PdfEditor";
import BgRemover from "@/components/BgRemover";
import ImageUpscaler from "@/components/ImageUpscaler";
import ImageColorizer from "@/components/ImageColorizer";
import RomanizerTab from "@/components/RomanizerTab";
import SignatureTab from "@/components/SignatureTab";
import CalculatorTab from "@/components/CalculatorTab";
import { Languages, PenTool, Calculator } from "lucide-react";

type Tab = "pdf" | "bgremove" | "upscale" | "colorize" | "romanize" | "signature" | "calculator";

export default function ClientApp() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("pdf");
  
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleSecretClick = () => {
    if (showEasterEgg) return;
    setSecretClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowEasterEgg(true);
        setTimeout(() => {
          setShowEasterEgg(false);
          setSecretClickCount(0);
        }, 5000);
      }
      return next;
    });
  };

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setReferenceFile(file);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string; activeBg: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "upscale", label: "업스케일링", icon: <ZoomIn className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "colorize", label: "색상 변경", icon: <Palette className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "romanize", label: "영문명 변환", icon: <Languages className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "signature", label: "서명 그리기", icon: <PenTool className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
    { id: "calculator", label: "계산기", icon: <Calculator className="w-3.5 h-3.5" />, color: "text-gray-600", activeBg: "bg-white text-gray-900 shadow-sm" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col relative font-sans antialiased">
      {/* 헤더 */}
      <header className="bg-gray-50 border-b border-gray-200 sticky top-0 z-40 transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* 로고 (깔끔한 Sans-serif) */}
          <div className="flex-1 flex justify-start">
            <button 
              onClick={() => {
                setFile(null);
                setReferenceFile(null);
                setActiveTab("pdf");
              }}
              className="shrink-0 outline-none flex items-center gap-2"
            >
              <span className="text-xl font-bold tracking-tight text-gray-900" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                PDF <span className="font-normal text-gray-500">Editor</span>
              </span>
            </button>
          </div>

          {/* 중앙 네비게이션 탭 */}
          <nav className="shrink-0 flex items-center bg-gray-200/50 rounded-full p-1 border border-gray-200 gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                  activeTab === tab.id
                    ? `${tab.activeBg}`
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-200/50"
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
                  className="text-xs text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-all font-semibold">
                  대조 원본 추가
                </button>
                <input id="ref-upload" type="file" accept="application/pdf" className="hidden" onChange={handleReferenceSelect} />
                <button onClick={() => { setFile(null); setReferenceFile(null); }}
                  className="text-xs text-gray-500 hover:text-gray-900 px-3 py-1.5 rounded-full hover:bg-gray-100 transition-all font-medium">
                  처음으로
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 메인 내용 */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 z-10 w-full max-w-6xl mx-auto">
        {activeTab === "pdf" && (
          !file ? <PdfUploader onFileSelect={setFile} /> : (
            <div className={`w-full flex gap-6 ${referenceFile ? "flex-row" : "justify-center"}`}>
              {referenceFile && (
                <div className="w-1/2 flex flex-col border border-gray-200 shadow-sm rounded-2xl overflow-hidden bg-white h-[80vh] sticky top-24">
                  <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center shrink-0">
                    <span className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      대조 원본 PDF
                    </span>
                    <button onClick={() => setReferenceFile(null)} className="text-xs px-3 py-1 bg-white hover:bg-red-50 rounded-lg text-red-500 border border-red-100 transition-all">닫기</button>
                  </div>
                  <iframe src={URL.createObjectURL(referenceFile)} className="w-full h-full border-0" />
                </div>
              )}
              <div className={`${referenceFile ? "w-1/2" : "w-full"}`}>
                <PdfEditor file={file} />
              </div>
            </div>
          )
        )}
        {activeTab === "bgremove" && <BgRemover />}
        {activeTab === "upscale" && <ImageUpscaler />}
        {activeTab === "colorize" && <ImageColorizer />}
        {activeTab === "romanize" && <RomanizerTab />}
        {activeTab === "signature" && <SignatureTab />}
        {activeTab === "calculator" && <CalculatorTab />}
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 py-8 border-t border-gray-200 z-10 mt-12">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-gray-400 text-xs">
          <span className="font-mono bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-md text-gray-500">v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          <span className="font-medium">&copy; 2026 PDF Editor &middot; Private by default.</span>
        </div>
      </footer>

      {/* 이스터에그 클릭 영역 (오른쪽 구석) */}
      <div 
        onClick={handleSecretClick}
        className="fixed bottom-0 right-0 w-24 h-24 z-50 cursor-default"
      />

      {/* 이스터에그 메시지 */}
      {showEasterEgg && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none" style={{ animation: "fadeInOut 5s ease-in-out forwards" }}>
          <style>{`
            @keyframes fadeInOut {
              0% { opacity: 0; transform: scale(0.9) translateY(20px); filter: blur(10px); }
              15% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
              85% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0px); }
              100% { opacity: 0; transform: scale(1.1) translateY(-20px); filter: blur(10px); }
            }
          `}</style>
          <div className="bg-white/90 backdrop-blur-md px-10 py-8 rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.2)] border border-indigo-100 text-center">
            <h2 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 mb-4 tracking-tight">
              Thanks to
            </h2>
            <p className="text-xl font-bold text-gray-700 leading-relaxed max-w-2xl break-keep">
              현지, 요한, 지연, 시우, 비헌, 상아, 강희, 정민, 백천, 보원, 경주, 나경, 희진, 준수, 성범
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
