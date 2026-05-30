"use client";

import React, { useState, useEffect, useRef } from "react";
import { FileText, Scissors, ZoomIn, Palette, Moon, Sun, Menu, X } from "lucide-react";
import PdfUploader from "@/components/PdfUploader";
import PdfEditor from "@/components/PdfEditor";
import BgRemover from "@/components/BgRemover";
import ImageUpscaler from "@/components/ImageUpscaler";
import ImageColorizer from "@/components/ImageColorizer";
import RomanizerTab from "@/components/RomanizerTab";
import SignatureTab from "@/components/SignatureTab";
import CalculatorTab from "@/components/CalculatorTab";
import ChangelogModal from "@/components/ChangelogModal";
import { Languages, PenTool, Calculator, FileText as FileTextIcon, Building2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

type Tab = "pdf" | "bgremove" | "upscale" | "colorize" | "romanize" | "signature" | "calculator" | "corporate";

export default function ClientApp() {
  const [file, setFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("pdf");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

  // localStorage에서 다크모드 초기값 로드
  useEffect(() => {
    const stored = localStorage.getItem("darkMode");
    if (stored === "true") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // 다크모드 토글 시 localStorage 저장 및 클래스 반영
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("darkMode", String(isDarkMode));
  }, [isDarkMode]);

  // 새 버전일 때 자동으로 업데이트 내역 팝업
  useEffect(() => {
    const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "";
    const lastSeenVersion = localStorage.getItem("lastSeenVersion");
    if (currentVersion && currentVersion !== lastSeenVersion) {
      setShowChangelog(true);
      localStorage.setItem("lastSeenVersion", currentVersion);
    }
  }, []);

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

  const loadCorporateDoc = async (filename: string, displayName: string) => {
    const toastId = toast.loading(`${displayName} 불러오는 중...`);
    try {
      const res = await fetch(`/${encodeURIComponent(filename)}`);
      if (!res.ok) throw new Error("파일 로드 실패");
      const blob = await res.blob();
      const loadedFile = new File([blob], filename, { type: "application/pdf" });
      setFile(loadedFile);
      setReferenceFile(null);
      setActiveTab("pdf");
      toast.success("문서를 성공적으로 불러왔습니다!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("문서를 불러오는 중 오류가 발생했습니다.", { id: toastId });
    }
  };

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === "application/pdf") {
      setReferenceFile(file);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string; activeBg: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "corporate", label: "법인 서류", icon: <Building2 className="w-3.5 h-3.5" />, color: "text-blue-600 dark:text-blue-300", activeBg: "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "upscale", label: "업스케일링", icon: <ZoomIn className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "colorize", label: "색상 변경", icon: <Palette className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "romanize", label: "영문명 변환", icon: <Languages className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "signature", label: "서명 그리기", icon: <PenTool className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "calculator", label: "계산기", icon: <Calculator className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col relative font-sans antialiased transition-colors duration-300">
      {/* 헤더 */}
      <header className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300">
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
              <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
                PDF <span className="font-normal text-gray-500 dark:text-gray-400">Editor</span>
              </span>
            </button>
          </div>

          {/* 중앙 네비게이션 탭 (데스크톱 전용) */}
          <nav className="hidden lg:flex shrink-0 items-center bg-gray-200/50 dark:bg-gray-800/50 rounded-full p-1 border border-gray-200 dark:border-gray-700 gap-1 transition-colors duration-300">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-200 ${
                  activeTab === tab.id
                    ? `${tab.activeBg}`
                    : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* 우측 컨트롤 */}
          <div className="flex-1 flex justify-end gap-2 items-center">
            {activeTab === "pdf" && file && (
              <>
                <button onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-all font-semibold">
                  대조 원본 추가
                </button>
                <input id="ref-upload" type="file" accept="application/pdf" className="hidden" onChange={handleReferenceSelect} />
                <button onClick={() => { setFile(null); setReferenceFile(null); }}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-medium">
                  처음으로
                </button>
              </>
            )}
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              title={isDarkMode ? "라이트 모드로 전환" : "다크 모드로 전환"}
            >
              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            
            {/* 모바일 햄버거 메뉴 버튼 */}
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 ml-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* 메인 내용 */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 z-10 w-full max-w-6xl mx-auto">
        {activeTab === "pdf" && (
          !file ? <PdfUploader onFileSelect={setFile} /> : (
            <div className={`w-full flex gap-6 ${referenceFile ? "flex-row" : "justify-center"}`}>
              {referenceFile && (
                <div className="w-1/2 flex flex-col border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-gray-800 h-[80vh] sticky top-24 transition-colors">
                  <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                      대조 원본 PDF
                    </span>
                    <button onClick={() => setReferenceFile(null)} className="text-xs px-3 py-1 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-500 border border-red-100 dark:border-red-900/50 transition-all">닫기</button>
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
        {activeTab === "corporate" && (
          <div className="w-full max-w-4xl mx-auto py-8">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800/50">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">법인 서류 양식</h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">프로젝트에 등록된 기본 서류 양식을 선택하여 바로 편집할 수 있습니다.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { name: "개인 공동대표 서류", file: "개인_공동대표서류_v1.3.pdf", icon: <FileTextIcon className="w-6 h-6" /> },
                  { name: "법인 소유 지배자 확인서", file: "법인-소유-지배자-확인서_v1.2.pdf", icon: <FileTextIcon className="w-6 h-6" /> },
                  { name: "주주명부", file: "주주명부.pdf", icon: <FileTextIcon className="w-6 h-6" /> }
                ].map((doc, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadCorporateDoc(doc.file, doc.name)}
                    className="flex flex-col items-center justify-center p-6 bg-gray-50 dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl transition-all group text-center"
                  >
                    <div className="p-3 bg-white dark:bg-gray-800 text-blue-500 rounded-xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      {doc.icon}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{doc.name}</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500 mt-2 line-clamp-1">{doc.file}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="bg-gray-50 dark:bg-gray-900 py-8 border-t border-gray-200 dark:border-gray-800 z-10 mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-gray-400 dark:text-gray-500 text-xs">
          <div 
            className="font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-2.5 py-1 rounded-lg text-gray-500 dark:text-gray-400 flex items-center gap-1.5"
          >
            <span className="inline-block w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            v{process.env.NEXT_PUBLIC_APP_VERSION}
          </div>
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

      {/* 모바일 사이드바 (우측) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg text-gray-900 dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>메뉴</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <nav className="flex flex-col gap-2 flex-1 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold"
                      : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 font-medium"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* 업데이트 내역 모달 */}
      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      
      {/* Toast 알림 */}
      <Toaster position="bottom-center" toastOptions={{ duration: 3000, style: { borderRadius: '10px', background: '#333', color: '#fff', fontSize: '14px' } }} />
    </div>
  );
}
