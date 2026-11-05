import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  FileText, Scissors, Palette, Moon, Sun, Menu, X,
  Languages, PenTool, Calculator, Building2, Sparkles, Merge, Archive, Smartphone, Eraser, Wand2
} from "lucide-react";
import HomeGrid from "@/components/HomeGrid";
import toast, { Toaster } from "react-hot-toast";
import { useAppStore, Tab } from "@/stores/appStore";

const PdfEditor = React.lazy(() => import("@/components/PdfEditor"));
const ChangelogModal = React.lazy(() => import("@/components/ChangelogModal"));
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
const MagicEraser = React.lazy(() => import("@/components/MagicEraser"));
import AutoSaveBanner from "@/components/AutoSaveBanner";
import { loadEditorSession, clearEditorSession, AutoSaveSession } from "@/lib/autoSaveStorage";
import { Loader2 } from "lucide-react";

export default function ClientApp() {
  // Zustand store
  const {
    activeTab, setActiveTab,
    file,
    referenceFile, setReferenceFile,
    isCorporateMode,
    isDarkMode, setIsDarkMode,
    isMobileMenuOpen, setIsMobileMenuOpen,
    isSecretMode, setIsSecretMode,
    showChangelog, setShowChangelog,
    goHome, openPdfEditor,
  } = useAppStore();

  // Local-only states
  const [secretClickCount, setSecretClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [savedSession, setSavedSession] = useState<AutoSaveSession | null>(null);

  // Check for auto-saved session on initial load or file close
  useEffect(() => {
    loadEditorSession().then((session) => {
      if (session && !file) {
        setSavedSession(session);
      } else if (file) {
        setSavedSession(null);
      }
    });
  }, [file]);

  const handleRestoreSession = () => {
    if (!savedSession) return;
    try {
      const recoveredFile = new File([savedSession.fileBuffer], savedSession.fileName, {
        type: "application/pdf",
      });
      useAppStore.getState().setRecoveredSession(savedSession);
      openPdfEditor(recoveredFile);
      setSavedSession(null);
    } catch (e) {
      console.error("복구 실패:", e);
      toast.error("작업 복구 중 오류가 발생했습니다.");
    }
  };

  const handleDiscardSession = async () => {
    await clearEditorSession();
    setSavedSession(null);
    toast.success("저장된 작업 세션을 삭제했습니다.");
  };

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
  }, [isSecretMode, setIsSecretMode]);

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

  const cycleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const darkModeIcon = isDarkMode
    ? <Sun className="w-4 h-4" />
    : <Moon className="w-4 h-4" />;

  const darkModeTitle = isDarkMode
    ? "라이트 모드로 전환"
    : "다크 모드로 전환";

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "pdf", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "smartpdf", label: "스마트 편집", icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: "eraser", label: "AI 지우개", icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: "bgremove", label: "배경 제거", icon: <Scissors className="w-3.5 h-3.5" /> },
    { id: "upscale", label: "업스케일", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "heic", label: "HEIC 변환", icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: "colorize", label: "색상 변경", icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "pdftools", label: "PDF 병합·압축", icon: <Merge className="w-3.5 h-3.5" /> },
    { id: "signature", label: "서명 제작", icon: <PenTool className="w-3.5 h-3.5" /> },
    { id: "romanize", label: "영문 표기", icon: <Languages className="w-3.5 h-3.5" /> },
    { id: "calculator", label: "계산기", icon: <Calculator className="w-3.5 h-3.5" /> },
  ];

  if (isSecretMode) {
    tabs.push({
      id: "corporate",
      label: "법인 서류",
      icon: <Building2 className="w-3.5 h-3.5" />,
    });
  }

  const isHome = activeTab === "home" || (activeTab === "pdf" && !file);

  return (
    <div
      className={`min-h-screen bg-[#F8F9FB] dark:bg-[#0B0D11] text-[#0F141C] dark:text-[#F3F5F8] flex flex-col relative font-sans antialiased transition-[colors,filter] duration-200 ${
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

      {/* ── Impeccable Workspace Header (All nav items >= 12px text-xs) ── */}
      <header className="bg-white/95 dark:bg-[#12151C]/95 backdrop-blur-xs border-b border-[#E2E6EE] dark:border-[#232936] sticky top-0 z-40 transition-colors">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: Brand Mark */}
          <div className="flex items-center shrink-0">
            <button
              onClick={goHome}
              className="group shrink-0 whitespace-nowrap outline-none flex items-center gap-2.5 text-left cursor-pointer"
            >
              <span className="w-6 h-6 rounded-md bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center">
                P
              </span>
              <span className="text-base font-bold tracking-tight text-[#0F141C] dark:text-[#F3F5F8]">
                PDF Studio
              </span>
            </button>
          </div>

          {/* Center: Clean Functional Navigation (>= 12px text-xs) */}
          <nav className="hidden lg:flex shrink min-w-0 items-center bg-[#F1F3F7] dark:bg-[#181C26] rounded-lg p-1 gap-0.5 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = !isHome && activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-[#12151C] text-[#0F141C] dark:text-[#F3F5F8] font-semibold shadow-2xs"
                      : "text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8]"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Contextual Controls */}
          <div className="flex items-center justify-end gap-2 shrink-0">
            {activeTab === "pdf" && file && (
              <>
                <button
                  onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-xs text-[#2563EB] dark:text-[#3B82F6] bg-[#F1F3F7] dark:bg-[#181C26] px-3 py-1.5 rounded-lg border border-[#E2E6EE] dark:border-[#232936] hover:border-[#2563EB] transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  + 대조 원본
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
                  className="text-xs text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8] px-3 py-1.5 rounded-lg hover:bg-[#F1F3F7] dark:hover:bg-[#181C26] transition-colors font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  처음으로
                </button>
              </>
            )}
            {!isHome && activeTab !== "pdf" && (
              <button
                onClick={goHome}
                className="text-xs text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8] px-3 py-1.5 rounded-lg border border-[#E2E6EE] dark:border-[#232936] bg-white dark:bg-[#12151C] transition-colors font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                홈으로
              </button>
            )}
            <button
              onClick={cycleDarkMode}
              className="p-2 rounded-lg border border-[#E2E6EE] dark:border-[#232936] bg-white dark:bg-[#12151C] text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8] transition-colors shrink-0 cursor-pointer"
              title={darkModeTitle}
            >
              {darkModeIcon}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-[#E2E6EE] dark:border-[#232936] bg-white dark:bg-[#12151C] text-[#0F141C] dark:text-[#F3F5F8] transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 z-10 w-full max-w-6xl mx-auto">
        {savedSession && !file && (
          <AutoSaveBanner
            session={savedSession}
            onRestore={handleRestoreSession}
            onDiscard={handleDiscardSession}
          />
        )}

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
              <div className="reference-pdf w-1/2 flex flex-col rounded-xl border border-[#CBD2E0] dark:border-[#333B4D] overflow-hidden bg-white dark:bg-[#12151C] h-[80vh] sticky top-20 transition-colors">
                <div className="bg-[#F1F3F7] dark:bg-[#181C26] px-4 py-2.5 border-b border-[#E2E6EE] dark:border-[#232936] flex justify-between items-center shrink-0">
                  <span className="text-xs font-semibold text-[#0F141C] dark:text-[#F3F5F8]">
                    대조 원본 PDF
                  </span>
                  <button
                    onClick={() => setReferenceFile(null)}
                    className="text-xs px-2.5 py-1 rounded-md bg-white dark:bg-[#12151C] hover:bg-[#DC2626] hover:text-white text-[#DC2626] border border-[#E2E6EE] dark:border-[#232936] transition-colors font-semibold cursor-pointer"
                  >
                    닫기
                  </button>
                </div>
                <iframe src={referenceUrl ?? ""} className="w-full h-full border-0" />
              </div>
            )}
            <div className={`pdf-workspace ${referenceFile ? "w-1/2" : "w-full"}`}>
              <React.Suspense
                fallback={
                  <div className="flex items-center justify-center p-12 text-[#4B5565]">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                }
              >
                <PdfEditor file={file} isCorporateMode={isCorporateMode} />
              </React.Suspense>
            </div>
          </div>
        )}

        <React.Suspense
          fallback={
            <div className="flex items-center justify-center p-12 text-[#4B5565]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          }
        >
          {activeTab === "eraser" && <MagicEraser />}
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
              <div className="inline-flex bg-[#F1F3F7] dark:bg-[#181C26] rounded-lg p-1 mb-8 border border-[#E2E6EE] dark:border-[#232936] gap-1">
                <button
                  onClick={() => setPdfSubTab("img2pdf")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    pdfSubTab === "img2pdf"
                      ? "bg-white dark:bg-[#12151C] text-[#0F141C] dark:text-[#F3F5F8] shadow-2xs"
                      : "text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> 이미지 → PDF
                </button>
                <button
                  onClick={() => setPdfSubTab("mergesplit")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    pdfSubTab === "mergesplit"
                      ? "bg-white dark:bg-[#12151C] text-[#0F141C] dark:text-[#F3F5F8] shadow-2xs"
                      : "text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8]"
                  }`}
                >
                  <Merge className="w-3.5 h-3.5" /> 합치기 / 분할
                </button>
                <button
                  onClick={() => setPdfSubTab("compress")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    pdfSubTab === "compress"
                      ? "bg-white dark:bg-[#12151C] text-[#0F141C] dark:text-[#F3F5F8] shadow-2xs"
                      : "text-[#4B5565] dark:text-[#94A0B8] hover:text-[#0F141C] dark:hover:text-[#F3F5F8]"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" /> PDF 압축
                </button>
              </div>

              <div className="w-full">
                {pdfSubTab === "img2pdf" && <ImageToPdfConverter />}
                {pdfSubTab === "mergesplit" && <PdfMergeSplit />}
                {pdfSubTab === "compress" && <PdfCompress />}
              </div>
            </div>
          )}
        </React.Suspense>

        {activeTab === "corporate" && (
          <div className="w-full max-w-4xl mx-auto py-6">
            <div className="pb-5 mb-6 border-b border-[#E2E6EE] dark:border-[#232936]">
              <h1 className="text-2xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
                법인 기본 서류 양식함
              </h1>
              <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1">
                등록된 기본 서류 양식을 선택하여 편집 스튜디오로 바로 불러옵니다.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { name: "개인 공동대표 서류", file: "doc_personal_rep.pdf" },
                { name: "법인 소유 지배자 확인서", file: "doc_corp_owner.pdf" },
                { name: "주주명부", file: "doc_shareholder.pdf" },
              ].map((doc, idx) => (
                <button
                  key={idx}
                  onClick={() => loadCorporateDoc(doc.file, doc.name)}
                  className="flex flex-col items-start justify-between p-5 rounded-xl border border-[#E2E6EE] dark:border-[#232936] hover:border-[#2563EB] bg-white dark:bg-[#12151C] transition-colors group text-left min-h-[120px] cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
                    <h2 className="font-semibold text-base text-[#0F141C] dark:text-[#F3F5F8]">
                      {doc.name}
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-[#697586] dark:text-[#647087] mt-4">
                    {doc.file}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* ── Footer (12px text-xs minimum floor) ── */}
      <footer className="bg-white dark:bg-[#12151C] py-6 border-t border-[#E2E6EE] dark:border-[#232936] z-10 mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#697586] dark:text-[#647087] text-xs">
          <span>PDF Studio &middot; 브라우저 로컬 문서 편집 스튜디오</span>
          <span>&copy; 2026 PDF Editor &middot; Private by default</span>
        </div>
      </footer>

      {/* ── Mobile bottom navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#12151C] border-t border-[#E2E6EE] dark:border-[#232936] safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { id: "home" as Tab, label: "홈", icon: <FileText className="w-4 h-4" /> },
            { id: "smartpdf" as Tab, label: "스마트", icon: <Wand2 className="w-4 h-4" /> },
            { id: "mergesplit" as Tab, label: "합치기", icon: <Merge className="w-4 h-4" />, subTab: "mergesplit" as const },
            { id: "compress" as Tab, label: "압축", icon: <Archive className="w-4 h-4" />, subTab: "compress" as const },
            { id: "bgremove" as Tab, label: "누끼", icon: <Scissors className="w-4 h-4" /> },
          ].map((item) => {
            const active =
              (item.id === "home" && isHome) ||
              activeTab === item.id ||
              ("subTab" in item && activeTab === "pdftools" && pdfSubTab === item.subTab);
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "home") goHome();
                  else if ("subTab" in item && item.subTab) {
                    setActiveTab("pdftools" as Tab);
                    setPdfSubTab(item.subTab);
                  } else setActiveTab(item.id);
                  setIsMobileMenuOpen(false);
                }}
                className={`flex flex-col items-center gap-1 px-3 py-1 transition-colors ${
                  active
                    ? "text-[#2563EB] dark:text-[#3B82F6] font-semibold"
                    : "text-[#697586] dark:text-[#647087]"
                }`}
              >
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1 text-[#697586] dark:text-[#647087]"
          >
            <Menu className="w-4 h-4" />
            <span className="text-xs">메뉴</span>
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
              0%   { opacity:0; transform:scale(0.96) translateY(12px); }
              15%  { opacity:1; transform:scale(1) translateY(0); }
              85%  { opacity:1; transform:scale(1) translateY(0); }
              100% { opacity:0; transform:scale(1.02) translateY(-12px); }
            }
          `}</style>
          <div className="bg-white dark:bg-[#12151C] px-10 py-8 rounded-xl border border-[#CBD2E0] dark:border-[#333B4D] shadow-xl text-center">
            <h2 className="text-2xl font-bold text-[#0F141C] dark:text-[#F3F5F8] mb-3 tracking-tight">
              Thanks to
            </h2>
            <p className="text-base font-medium text-[#4B5565] dark:text-[#94A0B8] leading-relaxed max-w-2xl break-keep">
              현지, 요한, 지연, 시우, 비헌, 상아, 강희, 정민, 백천, 보원, 경주, 나경, 희진, 준수, 성범
            </p>
          </div>
        </div>
      )}

      {/* Mobile sidebar (full menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 bg-white dark:bg-[#12151C] border-l border-[#E2E6EE] dark:border-[#232936] h-full shadow-xl flex flex-col p-5">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#E2E6EE] dark:border-[#232936]">
              <span className="font-bold text-base text-[#0F141C] dark:text-[#F3F5F8]">
                전체 도구 메뉴
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 rounded-lg border border-[#E2E6EE] dark:border-[#232936]"
              >
                <X className="w-4 h-4 text-[#4B5565] dark:text-[#94A0B8]" />
              </button>
            </div>
            <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    activeTab === tab.id
                      ? "bg-[#2563EB] text-white font-semibold"
                      : "text-[#4B5565] dark:text-[#94A0B8] hover:bg-[#F1F3F7] dark:hover:bg-[#181C26] font-medium"
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

      {showChangelog && (
        <React.Suspense fallback={null}>
          <ChangelogModal isOpen={showChangelog} onClose={() => setShowChangelog(false)} />
        </React.Suspense>
      )}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3000,
          style: {
            borderRadius: "8px",
            background: "#0F141C",
            color: "#F3F5F8",
            fontSize: "13px",
          },
        }}
      />
    </div>
  );
}
