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

  const tabs: { id: Tab; index: string; label: string; icon: React.ReactNode }[] = [
    { id: "pdf", index: "01", label: "PDF 편집", icon: <FileText className="w-3.5 h-3.5" /> },
    { id: "smartpdf", index: "02", label: "스마트 편집", icon: <Wand2 className="w-3.5 h-3.5" /> },
    { id: "eraser", index: "03", label: "AI 지우개", icon: <Eraser className="w-3.5 h-3.5" /> },
    { id: "bgremove", index: "04", label: "누끼따기", icon: <Scissors className="w-3.5 h-3.5" /> },
    { id: "upscale", index: "05", label: "업스케일", icon: <Sparkles className="w-3.5 h-3.5" /> },
    { id: "heic", index: "06", label: "HEIC 변환", icon: <Smartphone className="w-3.5 h-3.5" /> },
    { id: "colorize", index: "07", label: "색상 교정", icon: <Palette className="w-3.5 h-3.5" /> },
    { id: "pdftools", index: "08", label: "PDF 제본·압축", icon: <Merge className="w-3.5 h-3.5" /> },
    { id: "signature", index: "09", label: "서명 제작", icon: <PenTool className="w-3.5 h-3.5" /> },
    { id: "romanize", index: "10", label: "영문 표기", icon: <Languages className="w-3.5 h-3.5" /> },
    { id: "calculator", index: "11", label: "계산기", icon: <Calculator className="w-3.5 h-3.5" /> },
  ];

  if (isSecretMode) {
    tabs.push({
      id: "corporate",
      index: "12",
      label: "법인 서류",
      icon: <Building2 className="w-3.5 h-3.5" />,
    });
  }

  const isHome = activeTab === "home" || (activeTab === "pdf" && !file);

  return (
    <div
      className={`min-h-screen bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] flex flex-col relative font-sans antialiased transition-[colors,filter] duration-200 ${
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

      {/* ── Architectural Workbench Header ── */}
      <header className="bg-[#F6F3EA]/95 dark:bg-[#121211]/95 backdrop-blur-xs border-b border-[#DCD6C8] dark:border-[#2C2B28] sticky top-0 z-40 transition-colors">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left: Editorial Brand Mark */}
          <div className="flex items-center shrink-0">
            <button
              onClick={goHome}
              className="group shrink-0 whitespace-nowrap outline-none flex items-center gap-2.5 text-left"
            >
              <span className="w-6 h-6 bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514] font-mono text-[11px] font-bold flex items-center justify-center tracking-tighter group-hover:bg-[#C83E2B] dark:group-hover:bg-[#E05A47] dark:group-hover:text-[#F9F6ED] transition-colors">
                P
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-editorial text-lg font-bold tracking-tight text-[#161514] dark:text-[#F2EFE9]">
                  PDF Studio
                </span>
                <span className="hidden sm:inline-block font-mono text-[10px] uppercase tracking-widest text-[#8A847C] dark:text-[#6E6A63]">
                  / WORKBENCH
                </span>
              </div>
            </button>
          </div>

          {/* Center: Precision Tool Strip */}
          <nav className="hidden lg:flex shrink min-w-0 items-center bg-[#EFECE2] dark:bg-[#1A1918] border border-[#DCD6C8] dark:border-[#2C2B28] p-0.5 gap-0.5 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const isActive = !isHome && activeTab === tab.id;
              const isRestricted = tab.id === "corporate";
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  title={tab.label}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] whitespace-nowrap font-medium transition-colors cursor-pointer ${
                    isActive
                      ? isRestricted
                        ? "bg-[#C83E2B] text-[#FDFBF7] font-bold"
                        : "bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514] font-bold"
                      : isRestricted
                      ? "text-[#C83E2B] dark:text-[#E05A47] hover:bg-[#C83E2B]/10"
                      : "text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9] hover:bg-[#FDFBF7]/60 dark:hover:bg-[#252421]"
                  }`}
                >
                  <span className="font-mono text-[9px] opacity-60 hidden xl:inline">{tab.index}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right: Contextual Controls */}
          <div className="flex items-center justify-end gap-1.5 shrink-0">
            {activeTab === "pdf" && file && (
              <>
                <button
                  onClick={() => document.getElementById("ref-upload")?.click()}
                  className="text-[11px] text-[#161514] dark:text-[#F2EFE9] bg-[#FDFBF7] dark:bg-[#1A1918] px-3 py-1 border border-[#C8C1B0] dark:border-[#34322E] hover:border-[#161514] dark:hover:border-[#F2EFE9] transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer"
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
                  className="text-[11px] text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9] px-2.5 py-1 border border-transparent hover:border-[#DCD6C8] dark:hover:border-[#2C2B28] transition-colors font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  작업대 홈
                </button>
              </>
            )}
            {!isHome && activeTab !== "pdf" && (
              <button
                onClick={goHome}
                className="text-[11px] font-mono uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9] px-2.5 py-1 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#FDFBF7] dark:bg-[#1A1918] transition-colors font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                ← INDEX
              </button>
            )}
            <button
              onClick={cycleDarkMode}
              className="p-1.5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#FDFBF7] dark:bg-[#1A1918] hover:border-[#161514] dark:hover:border-[#F2EFE9] text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9] transition-colors shrink-0 cursor-pointer"
              title={darkModeTitle}
            >
              {darkModeIcon}
            </button>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden p-1.5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#FDFBF7] dark:bg-[#1A1918] text-[#161514] dark:text-[#F2EFE9] transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Workspace ── */}
      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 z-10 w-full max-w-6xl mx-auto">
        {/* AutoSave recovery banner */}
        {savedSession && !file && (
          <AutoSaveBanner
            session={savedSession}
            onRestore={handleRestoreSession}
            onDiscard={handleDiscardSession}
          />
        )}

        {/* Home Architectural Workbench */}
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
              <div className="reference-pdf w-1/2 flex flex-col border border-[#C8C1B0] dark:border-[#34322E] overflow-hidden bg-[#FDFBF7] dark:bg-[#1A1918] h-[80vh] sticky top-20 transition-colors">
                <div className="bg-[#EFECE2] dark:bg-[#22211F] px-4 py-2.5 border-b border-[#DCD6C8] dark:border-[#2C2B28] flex justify-between items-center shrink-0">
                  <span className="text-xs font-mono uppercase tracking-wider font-semibold text-[#161514] dark:text-[#F2EFE9] flex items-center gap-2">
                    <span className="inline-block w-2 h-2 bg-[#C83E2B]" />
                    REFERENCE DOCUMENT · 대조 원본
                  </span>
                  <button
                    onClick={() => setReferenceFile(null)}
                    className="text-xs px-2.5 py-1 bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#C83E2B] hover:text-white text-[#C83E2B] border border-[#DCD6C8] dark:border-[#2C2B28] transition-colors font-semibold cursor-pointer"
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
                  <div className="flex items-center justify-center p-12 text-[#57534E]">
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
            <div className="flex items-center justify-center p-12 text-[#57534E]">
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
              {/* 서브 탭 헤더 */}
              <div className="inline-flex bg-[#EFECE2] dark:bg-[#1A1918] p-1 mb-8 border border-[#DCD6C8] dark:border-[#2C2B28] gap-1">
                <button
                  onClick={() => setPdfSubTab("img2pdf")}
                  className={`flex items-center gap-2 px-5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    pdfSubTab === "img2pdf"
                      ? "bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514]"
                      : "text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" /> 이미지 → PDF
                </button>
                <button
                  onClick={() => setPdfSubTab("mergesplit")}
                  className={`flex items-center gap-2 px-5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    pdfSubTab === "mergesplit"
                      ? "bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514]"
                      : "text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9]"
                  }`}
                >
                  <Merge className="w-3.5 h-3.5" /> 합치기 / 분할
                </button>
                <button
                  onClick={() => setPdfSubTab("compress")}
                  className={`flex items-center gap-2 px-5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                    pdfSubTab === "compress"
                      ? "bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514]"
                      : "text-[#57534E] dark:text-[#A6A096] hover:text-[#161514] dark:hover:text-[#F2EFE9]"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" /> PDF 압축
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
          <div className="w-full max-w-4xl mx-auto py-6">
            <div className="bg-[#FDFBF7] dark:bg-[#1A1918] border border-[#C8C1B0] dark:border-[#34322E] p-8">
              <div className="flex items-start justify-between gap-4 mb-8 pb-6 border-b border-[#DCD6C8] dark:border-[#2C2B28]">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#C83E2B] dark:text-[#E05A47] font-bold block mb-1">
                    RESTRICTED ARCHIVE · CORPORATE TEMPLATES
                  </span>
                  <h2 className="font-editorial text-2xl font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
                    법인 기본 서류 양식함
                  </h2>
                  <p className="text-xs text-[#57534E] dark:text-[#A6A096] mt-1">
                    프로젝트에 등록된 기본 서류 양식을 선택하여 편집 스튜디오로 즉시 호출합니다.
                  </p>
                </div>
                <div className="w-11 h-11 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#C83E2B] flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
                {[
                  { code: "DOC-01", name: "개인 공동대표 서류", file: "doc_personal_rep.pdf" },
                  { code: "DOC-02", name: "법인 소유 지배자 확인서", file: "doc_corp_owner.pdf" },
                  { code: "DOC-03", name: "주주명부", file: "doc_shareholder.pdf" },
                ].map((doc, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadCorporateDoc(doc.file, doc.name)}
                    className="flex flex-col items-start justify-between p-6 bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F] transition-colors group text-left min-h-[140px] cursor-pointer"
                  >
                    <div className="w-full flex items-center justify-between text-[11px] font-mono text-[#8A847C]">
                      <span>{doc.code}</span>
                      <FileText className="w-4 h-4 text-[#57534E] group-hover:text-[#C83E2B] transition-colors" />
                    </div>
                    <div className="mt-6">
                      <span className="font-bold text-sm text-[#161514] dark:text-[#F2EFE9] group-hover:text-[#C83E2B] transition-colors block">
                        {doc.name}
                      </span>
                      <span className="font-mono text-[10px] text-[#8A847C] mt-1 block">
                        {doc.file}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Architectural Footer ── */}
      <footer className="bg-[#F6F3EA] dark:bg-[#121211] py-6 border-t border-[#DCD6C8] dark:border-[#2C2B28] z-10 mt-12 transition-colors">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[#8A847C] dark:text-[#6E6A63] text-[11px] font-mono">
          <span>PDF STUDIO WORKBENCH · CLIENT-SIDE DOCUMENT ENGINE</span>
          <span>&copy; 2026 PDF Editor &middot; ZERO SERVER RETENTION</span>
        </div>
      </footer>

      {/* ── Mobile bottom navigation ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#FDFBF7] dark:bg-[#1A1918] border-t border-[#DCD6C8] dark:border-[#2C2B28] safe-area-bottom">
        <div className="flex items-center justify-around px-2 py-1.5">
          {[
            { id: "home" as Tab, label: "작업대", icon: <FileText className="w-4 h-4" /> },
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
                className={`flex flex-col items-center gap-1 px-3 py-1.5 transition-colors ${
                  active
                    ? "text-[#C83E2B] dark:text-[#E05A47] font-bold"
                    : "text-[#8A847C] dark:text-[#6E6A63]"
                }`}
              >
                {item.icon}
                <span className="text-[10px]">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="flex flex-col items-center gap-1 px-3 py-1.5 text-[#8A847C] dark:text-[#6E6A63]"
          >
            <Menu className="w-4 h-4" />
            <span className="text-[10px]">목차</span>
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
          <div className="bg-[#FDFBF7] dark:bg-[#1A1918] px-10 py-8 border-2 border-[#161514] dark:border-[#F2EFE9] shadow-2xl text-center">
            <p className="font-mono text-[11px] uppercase tracking-widest text-[#C83E2B] mb-2">
              COLOPHON &middot; CONTRIBUTORS
            </p>
            <h2 className="font-editorial text-3xl font-bold text-[#161514] dark:text-[#F2EFE9] mb-4 tracking-tight">
              Thanks to
            </h2>
            <p className="text-lg font-medium text-[#57534E] dark:text-[#A6A096] leading-relaxed max-w-2xl break-keep">
              현지, 요한, 지연, 시우, 비헌, 상아, 강희, 정민, 백천, 보원, 경주, 나경, 희진, 준수, 성범
            </p>
          </div>
        </div>
      )}

      {/* Mobile sidebar (full menu) */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-72 bg-[#FDFBF7] dark:bg-[#1A1918] border-l border-[#DCD6C8] dark:border-[#2C2B28] h-full shadow-2xl flex flex-col p-5">
            <div className="flex justify-between items-center pb-4 mb-4 border-b border-[#DCD6C8] dark:border-[#2C2B28]">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#8A847C] block">
                  STATION DIRECTORY
                </span>
                <span className="font-editorial font-bold text-lg text-[#161514] dark:text-[#F2EFE9]">
                  전체 도구 목차
                </span>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-1.5 border border-[#DCD6C8] dark:border-[#2C2B28] hover:border-[#161514]"
              >
                <X className="w-4 h-4 text-[#57534E] dark:text-[#A6A096]" />
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
                  className={`flex items-center justify-between px-3 py-2.5 text-xs transition-colors ${
                    activeTab === tab.id
                      ? "bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514] font-bold"
                      : "text-[#57534E] dark:text-[#A6A096] hover:bg-[#EFECE2] dark:hover:bg-[#22211F] font-medium"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {tab.icon}
                    <span>{tab.label}</span>
                  </span>
                  <span className="font-mono text-[10px] opacity-60">/{tab.index}</span>
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
            borderRadius: "2px",
            background: "#161514",
            color: "#F9F6ED",
            fontSize: "13px",
            border: "1px solid #34322E",
          },
        }}
      />
    </div>
  );
}
