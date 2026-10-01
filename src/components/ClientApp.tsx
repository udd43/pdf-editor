import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText, Scissors, Palette, Moon, Sun, Menu, X,
  Languages, PenTool, Calculator, Building2, Sparkles, Merge, Archive, Smartphone
} from "lucide-react";
import PdfUploader from "@/components/PdfUploader";
import PdfEditor from "@/components/PdfEditor";
import ChangelogModal from "@/components/ChangelogModal";
import HomeGrid from "@/components/HomeGrid";
import toast, { Toaster } from "react-hot-toast";
import { useAppStore, Tab } from "@/stores/appStore";

const BgRemover = React.lazy(() => import("@/components/BgRemover"));
const ImageUpscaler = React.lazy(() => import("@/components/ImageUpscaler"));
const ImageColorizer = React.lazy(() => import("@/components/ImageColorizer"));
const RomanizerTab = React.lazy(() => import("@/components/RomanizerTab"));
const SignatureTab = React.lazy(() => import("@/components/SignatureTab"));
const CalculatorTab = React.lazy(() => import("@/components/CalculatorTab"));
const SmartPdfEditor = React.lazy(() => import("@/components/SmartPdfEditor"));
const ImageToPdfConverter = React.lazy(() => import("@/components/ImageToPdfConverter"));
const PdfMergeSplit = React.lazy(() => import("@/components/PdfMergeSplit"));
const PdfCompress = React.lazy(() => import("@/components/PdfCompress"));
const HeicConverter = React.lazy(() => import("@/components/HeicConverter"));
import { Loader2 } from "lucide-react";

export default function ClientApp() {
  // Zustand store
  const {
    activeTab, setActiveTab,
    file, setFile,
    referenceFile, setReferenceFile,
    isCorporateMode, setIsCorporateMode,
    isDarkMode, setIsDarkMode, toggleDarkMode,
    isMobileMenuOpen, setIsMobileMenuOpen,
    isSecretMode, setIsSecretMode,
    showChangelog, setShowChangelog,
    goHome, openPdfEditor,
  } = useAppStore();

  // Local-only states
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  // referenceFile Object URL 관리 (메모리 누수 방지)
  const referenceUrl = useMemo(() => {
    if (referenceFile) return URL.createObjectURL(referenceFile);
    return null;
  }, [referenceFile]);

  useEffect(() => {
    return () => {
      if (referenceUrl) URL.revokeObjectURL(referenceUrl);
    };
  }, [referenceUrl]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const currentVersion = import.meta.env.VITE_APP_VERSION || "";
    const lastSeenVersion = localStorage.getItem("lastSeenVersion");
    if (currentVersion && currentVersion !== lastSeenVersion) {
      localStorage.setItem("lastSeenVersion", currentVersion);
    }
  }, []);

  const handleSecretClick = () => {
    if (showEasterEgg) return;
    setSecretClickCount((prev) => {
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

  const pressedKeys = useRef<Set<string>>(new Set());
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      pressedKeys.current.add(e.code);
      if (pressedKeys.current.has("Space") && pressedKeys.current.has("KeyW")) {
        e.preventDefault();
        pressedKeys.current.clear();
        setIsSecretMode(!isSecretMode);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      pressedKeys.current.delete(e.code);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isSecretMode]);

  const loadCorporateDoc = async (filename: string, displayName: string) => {
    const toastId = toast.loading(`${displayName} 불러오는 중...`);
    try {
      const res = await fetch(`/${filename}`);
      if (!res.ok) throw new Error("파일 로드 실패");
      const blob = await res.blob();
      const loadedFile = new File([blob], filename, { type: "application/pdf" });
      openPdfEditor(loadedFile, true);
      toast.success("문서를 성공적으로 불러왔습니다!", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("문서를 불러오는 중 오류가 발생했습니다.", { id: toastId });
    }
  };

  const handleReferenceSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f && f.type === "application/pdf") setReferenceFile(f);
  };

  const [pdfSubTab, setPdfSubTab] = useState<"img2pdf" | "mergesplit" | "compress">("img2pdf");

  // ── Dark mode toggle (Light <-> Dark) ──
  const cycleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const darkModeIcon = isDarkMode
    ? <Sun className="w-4 h-4" />
    : <Moon className="w-4 h-4" />;

  const darkModeTitle = isDarkMode
    ? "라이트 모드로 전환"
    : "다크 모드로 전환";

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string; activeBg: string }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "bgremove", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "upscale", label: "업스케일", icon: <Sparkles className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "colorize", label: "색상 변경", icon: <Palette className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "romanize", label: "영문 변환", icon: <Languages className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "signature", label: "서명 그리기", icon: <PenTool className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "calculator", label: "계산기", icon: <Calculator className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
    { id: "heic", label: "HEIC 변환", icon: <Smartphone className="w-3.5 h-3.5 text-sky-500" />, color: "text-sky-600 dark:text-sky-400", activeBg: "bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 shadow-sm font-semibold border border-sky-200 dark:border-sky-800" },
    { id: "smartpdf", label: "스마트 편집", icon: <Sparkles className="w-3.5 h-3.5 text-amber-500" />, color: "text-amber-600 dark:text-amber-400", activeBg: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 shadow-sm font-bold border border-amber-200 dark:border-amber-800" },
    { id: "pdftools", label: "PDF 도구", icon: <Merge className="w-3.5 h-3.5" />, color: "text-gray-600 dark:text-gray-300", activeBg: "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm" },
  ];
  if (isSecretMode) {
    tabs.push({
      id: "corporate",
      label: "법인 서류",
      icon: <Building2 className="w-3.5 h-3.5" />,
      color: "text-red-600 dark:text-red-300",
      activeBg: "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-bold",
    });
  }

  const isHome = activeTab === "home" || (activeTab === "pdf" && !file);

  return (
    <div
      className={`min-h-screen bg-[#F9F6ED] dark:bg-gray-900 text-gray-900 dark:text-gray-100 flex flex-col relative font-sans antialiased transition-[colors,filter] duration-300 ${
        isSecretMode ? "secret-mode invert hue-rotate-180" : ""
      }`}
    >
      {isSecretMode && (
        <style
          dangerouslySetInnerHTML={{
            __html: `.secret-mode .pdf-workspace, .secret-mode .reference-pdf { filter: invert(100%) hue-rotate(180deg); }`,
          }}
        />
      )}

      {/* ── Header ── */}
      <header className="bg-[#F9F6ED] dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-300">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex-1 flex justify-start">
            <button onClick={goHome} className="shrink-0 outline-none flex items-center gap-2">
              <span
                className="text-xl font-bold tracking-tight text-gray-900 dark:text-white"
                style={{ fontFamily: "Inter, system-ui, sans-serif" }}
              >
                PDF <span className="font-normal text-gray-500 dark:text-gray-400">Editor</span>
              </span>
            </button>
          </div>

          <nav className="hidden lg:flex shrink-0 items-center bg-gray-200/50 dark:bg-gray-800/50 rounded-full p-1 border border-gray-200 dark:border-gray-700 gap-1 transition-colors duration-300">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id || (tab.id === "pdftools" && activeTab === "pdftools");
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full transition-all duration-200 ${
                    isActive
                      ? tab.activeBg
                      : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200/50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 flex justify-end gap-2 items-center">
            {activeTab === "pdf" && file && (
              <>
                <button
                  onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 px-4 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-800/50 transition-all font-semibold"
                >
                  대조 원본 추가
                </button>
                <input
                  id="ref-upload"
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleReferenceSelect}
                />
                <button
                  onClick={goHome}
                  className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-medium"
                >
                  처음으로
                </button>
              </>
            )}
            {!isHome && activeTab !== "pdf" && (
              <button
                onClick={goHome}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white px-3 py-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-all font-medium"
              >
                홈으로
              </button>
            )}
            <button
              onClick={cycleDarkMode}
              className="p-2 ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
              title={darkModeTitle}
            >
              {darkModeIcon}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 ml-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 z-10 w-full max-w-6xl mx-auto">
        {/* Home bento grid */}
        {isHome && (
          <HomeGrid
            onTabSelect={(tab) => {
              if (tab === "img2pdf" || tab === "mergesplit" || tab === "compress") {
                setActiveTab("pdftools" as Tab);
                setPdfSubTab(tab as "img2pdf" | "mergesplit" | "compress");
              } else {
                setActiveTab(tab as Tab);
              }
            }}
            onFileSelect={(f) => openPdfEditor(f)}
            isSecretMode={isSecretMode}
          />
        )}

        {/* PDF editor */}
        {activeTab === "pdf" && file && (
          <div className={`w-full flex gap-6 ${referenceFile ? "flex-row" : "justify-center"}`}>
            {referenceFile && (
              <div className="reference-pdf w-1/2 flex flex-col border border-gray-200 dark:border-gray-700 shadow-sm rounded-2xl overflow-hidden bg-white dark:bg-gray-800 h-[80vh] sticky top-24 transition-colors">
                <div className="bg-[#F9F6ED] dark:bg-gray-800 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center shrink-0">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-500" />
                    대조 원본 PDF
                  </span>
                  <button
                    onClick={() => setReferenceFile(null)}
                    className="text-xs px-3 py-1 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg text-red-500 border border-red-100 dark:border-red-900/50 transition-all"
                  >
                    닫기
                  </button>
                </div>
                <iframe src={referenceUrl ?? ""} className="w-full h-full border-0" />
              </div>
            )}
            <div className={`pdf-workspace ${referenceFile ? "w-1/2" : "w-full"}`}>
              <PdfEditor file={file} isCorporateMode={isCorporateMode} />
            </div>
          </div>
        )}

        <React.Suspense
          fallback={
            <div className="flex items-center justify-center p-12 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          }
        >
          {activeTab === "bgremove" && <BgRemover />}
          {activeTab === "upscale" && <ImageUpscaler />}
          {activeTab === "colorize" && <ImageColorizer />}
          {activeTab === "romanize" && <RomanizerTab />}
          {activeTab === "signature" && <SignatureTab />}
          {activeTab === "calculator" && <CalculatorTab />}
          {activeTab === "heic" && <HeicConverter />}
          {activeTab === "smartpdf" && <SmartPdfEditor />}

          {activeTab === "pdftools" && (
            <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
              {/* 서브 탭 헤더 */}
              <div className="flex bg-gray-200/70 dark:bg-gray-800 p-1.5 rounded-2xl mb-8 gap-2 border border-gray-200 dark:border-gray-700 shadow-sm">
                <button
                  onClick={() => setPdfSubTab("img2pdf")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pdfSubTab === "img2pdf"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm scale-[1.02]"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <FileText className="w-4 h-4" /> 이미지 → PDF
                </button>
                <button
                  onClick={() => setPdfSubTab("mergesplit")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pdfSubTab === "mergesplit"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm scale-[1.02]"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Merge className="w-4 h-4" /> 합치기 / 분할
                </button>
                <button
                  onClick={() => setPdfSubTab("compress")}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    pdfSubTab === "compress"
                      ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm scale-[1.02]"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <Archive className="w-4 h-4" /> PDF 압축
                </button>
              </div>

              {/* 서브 컴포넌트 렌더링 */}
              <div className="w-full">
                {pdfSubTab === "img2pdf" && <ImageToPdfConverter />}
                {pdfSubTab === "mergesplit" && <PdfMergeSplit />}
                {pdfSubTab === "compress" && <PdfCompress />}
              </div>
            </div>
          )}
        </React.Suspense>

        {activeTab === "corporate" && (
          <div className="w-full max-w-4xl mx-auto py-8">
            <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
              <div className="flex items-center gap-4 mb-8 pb-6 border-b border-gray-100 dark:border-gray-700">
                <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 rounded-2xl flex items-center justify-center border border-blue-100 dark:border-blue-800/50">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                    법인 서류 양식
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 mt-1">
                    프로젝트에 등록된 기본 서류 양식을 선택하여 바로 편집할 수 있습니다.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { name: "개인 공동대표 서류", file: "doc_personal_rep.pdf", icon: <FileText className="w-6 h-6" /> },
                  { name: "법인 소유 지배자 확인서", file: "doc_corp_owner.pdf", icon: <FileText className="w-6 h-6" /> },
                  { name: "주주명부", file: "doc_shareholder.pdf", icon: <FileText className="w-6 h-6" /> },
                ].map((doc, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadCorporateDoc(doc.file, doc.name)}
                    className="flex flex-col items-center justify-center p-6 bg-[#F9F6ED] dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-2 border-dashed border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 rounded-2xl transition-all group text-center"
                  >
                    <div className="p-3 bg-white dark:bg-gray-800 text-blue-500 rounded-xl shadow-sm mb-4 group-hover:scale-110 transition-transform">
                      {doc.icon}
                    </div>
                    <span className="font-bold text-gray-800 dark:text-gray-200">{doc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="bg-[#F9F6ED] dark:bg-gray-900 py-8 border-t border-gray-200 dark:border-gray-800 z-10 mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between text-gray-400 dark:text-gray-500 text-xs">
          <div />
          <span className="font-medium">&copy; 2026 PDF Editor &middot; Private by default.</span>
        </div>
      </footer>

      {/* ── Mobile bottom navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {[
            { id: "home" as Tab, label: "홈", icon: <FileText className="w-5 h-5" /> },
            { id: "smartpdf" as Tab, label: "스마트", icon: <Sparkles className="w-5 h-5" /> },
            { id: "mergesplit" as Tab, label: "합치기", icon: <Merge className="w-5 h-5" />, subTab: "mergesplit" as const },
            { id: "compress" as Tab, label: "압축", icon: <Archive className="w-5 h-5" />, subTab: "compress" as const },
            { id: "bgremove" as Tab, label: "누끼", icon: <Scissors className="w-5 h-5" /> },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === "home") goHome();
                else if ('subTab' in item && item.subTab) {
                  setActiveTab("pdftools" as Tab);
                  setPdfSubTab(item.subTab);
                } else setActiveTab(item.id);
                setIsMobileMenuOpen(false);
              }}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all ${
                (item.id === "home" && isHome) || activeTab === item.id || ('subTab' in item && activeTab === "pdftools" && pdfSubTab === item.subTab)
                  ? "text-blue-600 dark:text-blue-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          ))}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-gray-400 dark:text-gray-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold">더보기</span>
          </button>
        </div>
      </nav>

      {/* Easter-egg click area */}
      <div onClick={handleSecretClick} className="fixed bottom-0 right-0 w-24 h-24 z-50 cursor-default" />

      {showEasterEgg && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          style={{ animation: "fadeInOut 5s ease-in-out forwards" }}
        >
          <style>{`
            @keyframes fadeInOut {
              0%   { opacity:0; transform:scale(0.9) translateY(20px); filter:blur(10px); }
              15%  { opacity:1; transform:scale(1) translateY(0); filter:blur(0px); }
              85%  { opacity:1; transform:scale(1) translateY(0); filter:blur(0px); }
              100% { opacity:0; transform:scale(1.1) translateY(-20px); filter:blur(10px); }
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

      {/* Mobile sidebar (full menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-64 bg-white dark:bg-gray-900 h-full shadow-2xl flex flex-col p-4 animate-in slide-in-from-right duration-200">
            <div className="flex justify-between items-center mb-6">
              <span className="font-bold text-lg text-gray-900 dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>
                메뉴
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
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

      <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: { borderRadius: "10px", background: "#333", color: "#fff", fontSize: "14px" },
        }}
      />
    </div>
  );
}
