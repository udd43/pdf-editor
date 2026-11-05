import React, {
  useState,
  useCallback,
  useRef,
} from "react";
import {
  FileText,
  Scissors,
  Palette,
  Languages,
  PenTool,
  Calculator,
  Building2,
  Upload,
  ArrowUpRight,
  Wand2,
  Smartphone,
  Eraser,
  Merge,
  Archive,
  ZoomIn,
  Layers,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import toast from "react-hot-toast";
import { isHeicFile, convertHeicToPng } from "@/lib/imageUtils";

export interface FeatureCardMeta {
  id: string;
  index: string;
  spec: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "primary" | "vision" | "bindery";
  action: "expand" | "upload" | "navigate";
  badge?: string;
}

interface HomeGridProps {
  onTabSelect: (tab: string) => void;
  onFileSelect: (file: File) => void;
  isSecretMode: boolean;
}

export default function HomeGrid({
  onTabSelect,
  onFileSelect,
  isSecretMode,
}: HomeGridProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      onFileSelect(file);
      onTabSelect("pdf");
      return;
    }
    if (isHeicFile(file)) {
      const toastId = toast.loading("아이폰 HEIC 이미지를 변환하는 중...");
      try {
        const pngBlob = await convertHeicToPng(file);
        const ab = await pngBlob.arrayBuffer();
        const pdfDoc = await PDFDocument.create();
        const img = await pdfDoc.embedPng(ab);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes as any], { type: "application/pdf" });
        const newFile = new File([blob], `${file.name.replace(/\.[^/.]+$/, "")}.pdf`, {
          type: "application/pdf",
        });
        toast.success("HEIC 변환 완료! PDF 편집기로 열립니다.", { id: toastId });
        onFileSelect(newFile);
        onTabSelect("pdf");
        return;
      } catch {
        toast.error("HEIC 파일 변환 실패", { id: toastId });
        return;
      }
    }
    if (file.type.startsWith("image/")) {
      try {
        const ab = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.create();
        let img;
        if (file.type === "image/png") img = await pdfDoc.embedPng(ab);
        else if (file.type === "image/jpeg" || file.type === "image/jpg")
          img = await pdfDoc.embedJpg(ab);
        else {
          toast.error("JPG 또는 PNG만 가능합니다.");
          return;
        }
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        const bytes = await pdfDoc.save();
        const blob = new Blob([bytes as any], { type: "application/pdf" });
        const newFile = new File([blob], `${file.name.split(".")[0]}.pdf`, {
          type: "application/pdf",
        });
        onFileSelect(newFile);
        onTabSelect("pdf");
      } catch {
        toast.error("이미지를 PDF로 변환하는 중 오류가 발생했습니다.");
      }
    } else {
      toast.error("PDF 또는 이미지 파일(JPG, PNG)만 업로드 가능합니다.");
    }
  };

  const CARDS: FeatureCardMeta[] = [
    {
      id: "pdf",
      index: "01",
      spec: "VECTOR · PAGE STUDIO",
      title: "PDF 문서 편집",
      description: "텍스트 추가, 이미지·도장 배치, 보안 마스킹 및 원본 대조 작업을 수행합니다.",
      icon: <FileText className="w-5 h-5" />,
      category: "primary",
      action: "upload",
      badge: "PRIMARY",
    },
    {
      id: "smartpdf",
      index: "02",
      spec: "STRUCTURAL PARSER",
      title: "스마트 워드·표 편집",
      description: "PDF 내부의 표, 선, 텍스트 셀을 자동 분해하여 문서 구조 그대로 셀 단위 교정을 지원합니다.",
      icon: <Wand2 className="w-5 h-5" />,
      category: "primary",
      action: "upload",
      badge: "TABLE OCR",
    },
    {
      id: "eraser",
      index: "03",
      spec: "WEBGPU INPAINT",
      title: "AI 스마트 지우개",
      description: "문서 속 도장, 서명, 오타, 불필요한 흔적을 종이 질감을 유지한 채 지워냅니다.",
      icon: <Eraser className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "bgremove",
      index: "04",
      spec: "ALPHA MATTE",
      title: "배경 제거 (누끼)",
      description: "직인, 서명, 인물·사물 사진에서 배경만 정밀하게 분리하여 투명 PNG로 추출합니다.",
      icon: <Scissors className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "upscale",
      index: "05",
      spec: "REAL-ESRGAN 2X",
      title: "해상도 업스케일",
      description: "저화질 스캔 문서나 흐릿한 이미지를 신경망 복원으로 2배 선명하게 확대합니다.",
      icon: <ZoomIn className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "heic",
      index: "06",
      spec: "APPLE HEIF → PNG",
      title: "HEIC 무손실 변환",
      description: "아이폰 고효율 사진(.heic)을 표준 PNG 이미지 또는 단일 PDF 문서로 즉시 변환합니다.",
      icon: <Smartphone className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "colorize",
      index: "07",
      spec: "INK & TINT GRADE",
      title: "색상 변경 · 재착색",
      description: "도장 인주 색상 조정, 틴트 입히기, 단색 교체 등 이미지 색조를 정밀하게 제어합니다.",
      icon: <Palette className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "mergesplit",
      index: "08",
      spec: "BIND & ROTATE",
      title: "PDF 합치기 · 분할",
      description: "여러 PDF 문서를 한 권으로 병합하거나 특정 페이지 추출 및 90° 회전을 처리합니다.",
      icon: <Merge className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "compress",
      index: "09",
      spec: "SIZE OPTIMIZER",
      title: "PDF 용량 압축",
      description: "이메일 첨부 및 전자결재 업로드 제한에 맞춰 문서 해상도와 용량을 최적화합니다.",
      icon: <Archive className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "img2pdf",
      index: "10",
      spec: "SHEET BINDER",
      title: "이미지 → PDF 제본",
      description: "여러 장의 스캔본(PNG, JPG, HEIC)을 순서대로 배열하여 하나의 PDF로 묶어냅니다.",
      icon: <Layers className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "signature",
      index: "11",
      spec: "STROKE & SEAL",
      title: "서명 그리기",
      description: "직접 필기하거나 서체를 지정하여 문서 삽입용 고해상도 투명 서명 파일을 제작합니다.",
      icon: <PenTool className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "romanize",
      index: "12",
      spec: "KR → ROMAN",
      title: "영문 성명 표기",
      description: "국어 로마자 표기법 및 여권 관용 성씨 기준에 맞춘 대문자 영문명을 산출합니다.",
      icon: <Languages className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "calculator",
      index: "13",
      spec: "DECIMAL ENGINE",
      title: "실무 계산기",
      description: "문서 검산 및 공학 수식 계산을 위한 괄호·이력 지원 계산 도구입니다.",
      icon: <Calculator className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
  ];

  if (isSecretMode) {
    CARDS.push({
      id: "corporate",
      index: "14",
      spec: "RESTRICTED ARCHIVE",
      title: "법인 서류 양식",
      description: "등록된 법인 기본 서류 양식을 즉시 호출하여 편집 스튜디오로 불러옵니다.",
      icon: <Building2 className="w-4 h-4" />,
      category: "bindery",
      action: "navigate",
      badge: "CLASSIFIED",
    });
  }

  const handleCardClick = useCallback(
    (card: FeatureCardMeta) => {
      if (card.action === "upload") {
        if (card.id === "smartpdf") {
          onTabSelect("smartpdf");
        } else {
          fileInputRef.current?.click();
        }
      } else {
        onTabSelect(card.id);
      }
    },
    [onTabSelect]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const pdfStation = CARDS.find((c) => c.id === "pdf")!;
  const smartStation = CARDS.find((c) => c.id === "smartpdf")!;
  const visionTools = CARDS.filter((c) => c.category === "vision");
  const binderyTools = CARDS.filter((c) => c.category === "bindery");

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <input
        ref={fileInputRef}
        id="home-file-upload"
        type="file"
        accept="application/pdf, image/jpeg, image/png, .heic, .heif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Architectural Masthead ── */}
      <div className="border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-6 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tracking-wider uppercase text-[#8A847C] dark:text-[#6E6A63] mb-4">
          <span>WORKBENCH INDEX · EDITION 2.8</span>
          <span className="inline-flex items-center gap-2 text-[#161514] dark:text-[#F2EFE9]">
            <span className="w-1.5 h-1.5 bg-[#C83E2B] dark:bg-[#E05A47] inline-block" />
            CLIENT-SIDE EXECUTION · ZERO SERVER UPLOAD
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-7">
            <h1 className="font-editorial text-3xl sm:text-4xl lg:text-[42px] font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight leading-[1.15]">
              문서 교정 및 그래픽 작업대
            </h1>
          </div>
          <div className="lg:col-span-5">
            <p className="text-xs sm:text-sm text-[#57534E] dark:text-[#A6A096] leading-relaxed lg:text-right">
              모든 PDF 벡터 조작, 표 구조 인식 및 이미지 인페인팅 연산은 외부 서버 전송 없이 브라우저 로컬 메모리에서 즉시 처리됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* ── Primary Workstation Split Ledger (01 & 02) ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#57534E] dark:text-[#A6A096] font-semibold">
            I. PRIMARY DOCUMENT WORKSTATIONS
          </span>
          <span className="text-[11px] font-mono text-[#8A847C] dark:text-[#6E6A63]">
            01 — 02
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 border border-[#C8C1B0] dark:border-[#34322E] bg-[#C8C1B0] dark:bg-[#34322E] gap-px shadow-[0_2px_0_rgba(22,21,20,0.04)]">
          {/* Station 01: PDF Editor with Dropzone */}
          <div
            onClick={() => handleCardClick(pdfStation)}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files[0];
              if (f) processFile(f);
            }}
            className={`lg:col-span-7 relative p-6 sm:p-8 flex flex-col justify-between cursor-pointer transition-colors group select-none ${
              isDragging
                ? "bg-[#EFECE2] dark:bg-[#252421]"
                : "bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F7F4EC] dark:hover:bg-[#201F1D]"
            }`}
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#161514] text-[#F9F6ED] dark:bg-[#F2EFE9] dark:text-[#161514]">
                    {pdfStation.index}
                  </span>
                  <span className="font-mono text-[11px] tracking-wider uppercase text-[#57534E] dark:text-[#A6A096]">
                    {pdfStation.spec}
                  </span>
                </div>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border border-[#C8C1B0] dark:border-[#3A3834] text-[#57534E] dark:text-[#A6A096]">
                  {pdfStation.badge}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-2xl sm:text-[26px] font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
                  {pdfStation.title}
                </h2>
                <span className="p-2 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] group-hover:border-[#161514] dark:group-hover:border-[#F2EFE9] transition-colors">
                  {pdfStation.icon}
                </span>
              </div>

              <p className="text-sm text-[#57534E] dark:text-[#A6A096] leading-relaxed max-w-xl mb-6">
                {pdfStation.description}
              </p>
            </div>

            {/* Tactile Architectural Drop Tray */}
            <div
              className={`border border-dashed p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                isDragging
                  ? "border-[#C83E2B] bg-[#C83E2B]/5"
                  : "border-[#BFB7A6] dark:border-[#3A3834] bg-[#F6F3EA]/80 dark:bg-[#121211]/70 group-hover:border-[#161514] dark:group-hover:border-[#A6A096]"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#FDFBF7] dark:bg-[#1A1918] flex items-center justify-center text-[#161514] dark:text-[#F2EFE9] shrink-0">
                  <Upload className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-[#161514] dark:text-[#F2EFE9]">
                    {isDragging ? "여기에 파일을 놓아 작업을 시작하세요" : "PDF 또는 이미지를 드래그하거나 클릭하여 열기"}
                  </p>
                  <p className="font-mono text-[10px] text-[#8A847C] dark:text-[#6E6A63] mt-0.5">
                    ACCEPT: .PDF / .PNG / .JPG / .HEIC
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(pdfStation);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#161514] hover:bg-[#C83E2B] dark:bg-[#F2EFE9] dark:hover:bg-[#E05A47] text-[#F9F6ED] dark:text-[#161514] dark:hover:text-[#F9F6ED] text-xs font-bold tracking-tight transition-colors shrink-0"
              >
                <span>문서 불러오기</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Station 02: Smart Word/Table PDF Editor */}
          <div
            onClick={() => handleCardClick(smartStation)}
            className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between cursor-pointer bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F7F4EC] dark:hover:bg-[#201F1D] transition-colors group select-none"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 bg-[#C83E2B] text-[#FDFBF7]">
                    {smartStation.index}
                  </span>
                  <span className="font-mono text-[11px] tracking-wider uppercase text-[#C83E2B] dark:text-[#E05A47] font-semibold">
                    {smartStation.spec}
                  </span>
                </div>
                <span className="font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 border border-[#C83E2B]/40 text-[#C83E2B] dark:text-[#E05A47]">
                  {smartStation.badge}
                </span>
              </div>

              <div className="flex items-start justify-between gap-4 mb-3">
                <h2 className="text-2xl sm:text-[26px] font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight">
                  {smartStation.title}
                </h2>
                <span className="p-2 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA] dark:bg-[#121211] text-[#C83E2B] dark:text-[#E05A47] group-hover:border-[#C83E2B] transition-colors">
                  {smartStation.icon}
                </span>
              </div>

              <p className="text-sm text-[#57534E] dark:text-[#A6A096] leading-relaxed mb-6">
                {smartStation.description}
              </p>
            </div>

            <div className="border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#F6F3EA]/80 dark:bg-[#121211]/70 p-4 sm:p-5 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-3 font-mono text-[10px] text-[#57534E] dark:text-[#A6A096]">
                <div>
                  <span className="block text-[#8A847C] dark:text-[#6E6A63]">MODE</span>
                  <span className="font-bold text-[#161514] dark:text-[#F2EFE9]">CELL / TABLE</span>
                </div>
                <div>
                  <span className="block text-[#8A847C] dark:text-[#6E6A63]">VECTOR</span>
                  <span className="font-bold text-[#161514] dark:text-[#F2EFE9]">SVG LINES</span>
                </div>
                <div>
                  <span className="block text-[#8A847C] dark:text-[#6E6A63]">REDACT</span>
                  <span className="font-bold text-[#161514] dark:text-[#F2EFE9]">TRUE MASK</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-0.5">
                <span className="text-xs font-medium text-[#57534E] dark:text-[#A6A096]">
                  양식·표 문서 자동 구조화
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-[#C83E2B] dark:text-[#E05A47] group-hover:translate-x-0.5 transition-transform">
                  구조 분석 열기 <ArrowUpRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Section II: AI Vision & Raster Lab (03 — 07) ── */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#57534E] dark:text-[#A6A096] font-semibold">
            II. VISION &amp; RASTER PROCESSING LAB
          </span>
          <span className="text-[11px] font-mono text-[#8A847C] dark:text-[#6E6A63]">
            03 — 07
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
          {visionTools.map((tool) => (
            <LedgerCell
              key={tool.id}
              card={tool}
              onClick={() => handleCardClick(tool)}
            />
          ))}
        </div>
      </div>

      {/* ── Section III: Document Bindery & Utilities (08 — 13/14) ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#57534E] dark:text-[#A6A096] font-semibold">
            III. DOCUMENT BINDERY &amp; STUDIO INSTRUMENTS
          </span>
          <span className="text-[11px] font-mono text-[#8A847C] dark:text-[#6E6A63]">
            08 — {binderyTools[binderyTools.length - 1]?.index}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#DCD6C8] dark:bg-[#2C2B28] gap-px">
          {binderyTools.map((tool) => (
            <LedgerCell
              key={tool.id}
              card={tool}
              onClick={() => handleCardClick(tool)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───── Architectural Ledger Cell ───── */

interface LedgerCellProps {
  card: FeatureCardMeta;
  onClick: () => void;
}

function LedgerCell({ card, onClick }: LedgerCellProps) {
  const isClassified = card.id === "corporate";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left p-5 sm:p-6 flex flex-col justify-between min-h-[168px] transition-colors cursor-pointer select-none ${
        isClassified
          ? "bg-[#FDF6F5] dark:bg-[#221615] hover:bg-[#F9EBE8] dark:hover:bg-[#2B1B19]"
          : "bg-[#FDFBF7] dark:bg-[#1A1918] hover:bg-[#F3EFE4] dark:hover:bg-[#22211F]"
      }`}
    >
      <div className="w-full">
        {/* Top index & spec row */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="font-mono text-[11px] font-bold text-[#8A847C] dark:text-[#6E6A63] group-hover:text-[#C83E2B] dark:group-hover:text-[#E05A47] transition-colors">
            /{card.index}
          </span>
          <span className="font-mono text-[10px] tracking-wider uppercase text-[#8A847C] dark:text-[#6E6A63] truncate">
            {card.spec}
          </span>
        </div>

        {/* Title & icon */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-base font-bold text-[#161514] dark:text-[#F2EFE9] tracking-tight group-hover:text-[#C83E2B] dark:group-hover:text-[#E05A47] transition-colors">
            {card.title}
          </h3>
          <span className="text-[#57534E] dark:text-[#A6A096] group-hover:text-[#C83E2B] dark:group-hover:text-[#E05A47] transition-colors shrink-0">
            {card.icon}
          </span>
        </div>

        <p className="text-xs text-[#57534E] dark:text-[#A6A096] leading-relaxed">
          {card.description}
        </p>
      </div>

      {/* Bottom rule + action cue */}
      <div className="w-full pt-4 mt-4 border-t border-[#ECE7DA] dark:border-[#262522] flex items-center justify-between text-[11px] font-mono text-[#8A847C] dark:text-[#6E6A63]">
        <span>{card.badge || "OPEN STATION"}</span>
        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#161514] dark:group-hover:text-[#F2EFE9] transition-transform" />
      </div>
    </button>
  );
}
