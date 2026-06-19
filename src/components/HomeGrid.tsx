"use client";

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
  ArrowRight,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { PDFDocument } from "pdf-lib";
import toast from "react-hot-toast";

export interface FeatureCardMeta {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  accent: string;
  iconBg: string;
  iconBgDark: string;
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
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<string | null>(null);
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
    if (file.type.startsWith("image/")) {
      try {
        const ab = await file.arrayBuffer();
        const pdfDoc = await PDFDocument.create();
        let img;
        if (file.type === "image/png") img = await pdfDoc.embedPng(ab);
        else if (file.type === "image/jpeg" || file.type === "image/jpg")
          img = await pdfDoc.embedJpg(ab);
        else { toast.error("JPG 또는 PNG만 가능합니다."); return; }
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
      title: "PDF 편집",
      description: "텍스트 추가, 이미지 삽입, 서명 배치 등 PDF를 자유롭게 편집하세요.",
      icon: <FileText className="w-7 h-7" />,
      accent: "from-blue-500 to-indigo-600",
      iconBg: "bg-blue-50 text-blue-600 border-blue-100",
      iconBgDark: "dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      action: "upload",
      badge: "핵심 기능",
    },
    {
      id: "upscale",
      title: "이미지 업스케일",
      description: "저화질 이미지를 AI로 선명하게 2배 확대합니다.",
      icon: <Sparkles className="w-6 h-6" />,
      accent: "from-amber-400 to-orange-500",
      iconBg: "bg-amber-50 text-amber-600 border-amber-100",
      iconBgDark: "dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
      action: "expand",
    },
    {
      id: "bgremove",
      title: "누끼따기",
      description: "AI로 이미지 배경을 자동 제거합니다.",
      icon: <Scissors className="w-6 h-6" />,
      accent: "from-purple-500 to-pink-500",
      iconBg: "bg-purple-50 text-purple-600 border-purple-100",
      iconBgDark: "dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
      action: "expand",
    },
    {
      id: "colorize",
      title: "색상 변경",
      description: "이미지 색상을 자유롭게 바꾸세요.",
      icon: <Palette className="w-6 h-6" />,
      accent: "from-orange-400 to-red-500",
      iconBg: "bg-orange-50 text-orange-600 border-orange-100",
      iconBgDark: "dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800",
      action: "expand",
    },
    {
      id: "romanize",
      title: "영문명 변환",
      description: "한글 이름을 로마자로 정확하게 변환합니다.",
      icon: <Languages className="w-6 h-6" />,
      accent: "from-teal-500 to-cyan-500",
      iconBg: "bg-teal-50 text-teal-600 border-teal-100",
      iconBgDark: "dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800",
      action: "expand",
    },
    {
      id: "signature",
      title: "서명 그리기",
      description: "직접 서명을 그리고 PDF에 삽입하세요.",
      icon: <PenTool className="w-6 h-6" />,
      accent: "from-violet-500 to-indigo-500",
      iconBg: "bg-violet-50 text-violet-600 border-violet-100",
      iconBgDark: "dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
      action: "expand",
    },
    {
      id: "calculator",
      title: "계산기",
      description: "빠르고 정확한 과학 계산기.",
      icon: <Calculator className="w-6 h-6" />,
      accent: "from-green-500 to-emerald-500",
      iconBg: "bg-green-50 text-green-600 border-green-100",
      iconBgDark: "dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
      action: "expand",
    },
  ];

  if (isSecretMode) {
    CARDS.push({
      id: "corporate",
      title: "법인 서류",
      description: "등록된 법인 서류 양식을 빠르게 편집합니다.",
      icon: <Building2 className="w-6 h-6" />,
      accent: "from-red-500 to-rose-500",
      iconBg: "bg-red-50 text-red-600 border-red-100",
      iconBgDark: "dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
      action: "navigate",
      badge: "비공개",
    });
  }

  const handleCardClick = useCallback((card: FeatureCardMeta) => {
    if (card.action === "upload") {
      fileInputRef.current?.click();
    } else {
      onTabSelect(card.id);
    }
  }, [onTabSelect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = "";
  };

  const card = (id: string) => CARDS.find((c) => c.id === id)!;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold border border-blue-100 dark:border-blue-800 mb-5">
          <Sparkles className="w-3.5 h-3.5" />
          업로드된 파일은 서버에 저장되지 않습니다
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-3">
          원하는 기능을 선택하세요
        </h1>
        <p className="text-gray-500 dark:text-gray-400 text-base max-w-xl mx-auto">
          PDF 편집부터 이미지 처리까지, 필요한 도구를 클릭하면 바로 시작됩니다.
        </p>
      </div>

      <input
        ref={fileInputRef}
        id="home-file-upload"
        type="file"
        accept="application/pdf, image/jpeg, image/png"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Bento Grid */}
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(12, 1fr)" }}>
        <BentoCard card={card("pdf")} isHovered={hoveredCard === "pdf"} isDragging={isDragging === "pdf"}
          onMouseEnter={() => setHoveredCard("pdf")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("pdf"))}
          onDragOver={(e) => { e.preventDefault(); setIsDragging("pdf"); }}
          onDragLeave={() => setIsDragging(null)}
          onDrop={(e) => { e.preventDefault(); setIsDragging(null); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          style={{ gridColumn: "1 / 8", gridRow: "1 / 3" }} size="xl" />

        <BentoCard card={card("bgremove")} isHovered={hoveredCard === "bgremove"} isDragging={false}
          onMouseEnter={() => setHoveredCard("bgremove")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("bgremove"))}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "8 / 13", gridRow: "1 / 2" }} size="md" />

        <BentoCard card={card("colorize")} isHovered={hoveredCard === "colorize"} isDragging={false}
          onMouseEnter={() => setHoveredCard("colorize")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("colorize"))}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "8 / 13", gridRow: "2 / 3" }} size="md" />

        <BentoCard card={card("romanize")} isHovered={hoveredCard === "romanize"} isDragging={false}
          onMouseEnter={() => setHoveredCard("romanize")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("romanize"))}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "1 / 5", gridRow: "3 / 4" }} size="sm" />

        <BentoCard card={card("signature")} isHovered={hoveredCard === "signature"} isDragging={false}
          onMouseEnter={() => setHoveredCard("signature")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("signature"))}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "5 / 9", gridRow: "3 / 4" }} size="sm" />

        <BentoCard card={card("calculator")} isHovered={hoveredCard === "calculator"} isDragging={false}
          onMouseEnter={() => setHoveredCard("calculator")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => handleCardClick(card("calculator"))}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "9 / 13", gridRow: "3 / 4" }} size="sm" />

        <BentoCard card={{
            id: "img2pdf", title: "이미지 → PDF", description: "여러 장의 PNG/JPEG 이미지를 하나의 PDF로 병합합니다.",
            icon: <FileText className="w-6 h-6" />, accent: "from-blue-400 to-cyan-500",
            iconBg: "bg-cyan-50 text-cyan-600 border-cyan-100", iconBgDark: "dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
            action: "expand"
          }} isHovered={hoveredCard === "img2pdf"} isDragging={false}
          onMouseEnter={() => setHoveredCard("img2pdf")} onMouseLeave={() => setHoveredCard(null)}
          onClick={() => onTabSelect("img2pdf")}
          onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
          style={{ gridColumn: "1 / 13", gridRow: "4 / 5" }} size="sm" />

        {isSecretMode && (
          <BentoCard card={card("corporate")} isHovered={hoveredCard === "corporate"} isDragging={false}
            onMouseEnter={() => setHoveredCard("corporate")} onMouseLeave={() => setHoveredCard(null)}
            onClick={() => handleCardClick(card("corporate"))}
            onDragOver={() => {}} onDragLeave={() => {}} onDrop={() => {}}
            style={{ gridColumn: "1 / 13", gridRow: "5 / 6" }} size="sm" />
        )}
      </div>

      <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-8">
        PDF 편집 카드에 파일을 드래그 앤 드롭할 수도 있습니다 ·{" "}
        <span className="font-semibold">Private by default</span>
      </p>
    </div>
  );
}

/* ───── BentoCard ───── */

interface BentoCardProps {
  card: FeatureCardMeta;
  isHovered: boolean;
  isDragging: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  style: React.CSSProperties;
  size: "xl" | "md" | "sm";
}

function BentoCard({ card, isHovered, isDragging, onMouseEnter, onMouseLeave, onClick, onDragOver, onDragLeave, onDrop, style, size }: BentoCardProps) {
  const isXL = size === "xl";
  const isMd = size === "md";
  const isSm = size === "sm";

  return (
    <div
      style={style}
      className={`
        relative group rounded-3xl border cursor-pointer overflow-hidden select-none
        transition-all duration-300 ease-out
        ${isHovered ? "shadow-2xl -translate-y-1 scale-[1.01]" : "shadow-sm hover:shadow-lg"}
        ${isDragging ? "ring-4 ring-blue-400 ring-offset-2 scale-[1.02] border-blue-300 dark:border-blue-700" : "border-gray-200 dark:border-gray-700/80"}
        bg-white dark:bg-gray-800/90
        ${isXL ? "min-h-[280px]" : isMd ? "min-h-[130px]" : "min-h-[110px]"}
      `}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* hover gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${card.accent} opacity-0 transition-opacity duration-300 ${isHovered ? "opacity-[0.06]" : ""} ${isDragging ? "opacity-[0.1]" : ""}`} />
      {/* top color bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.accent} opacity-0 transition-opacity duration-300 ${isHovered || isDragging ? "opacity-100" : ""}`} />

      <div className={`relative h-full flex flex-col ${isXL ? "p-8" : isMd ? "p-6" : "p-5"}`}>
        {/* icon + badge */}
        <div className="flex items-start justify-between mb-auto">
          <div className={`rounded-2xl border flex items-center justify-center transition-transform duration-300 ${isHovered ? "scale-110" : ""} ${card.iconBg} ${card.iconBgDark} ${isXL ? "w-14 h-14" : "w-11 h-11"}`}>
            {card.icon}
          </div>
          {card.badge && (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${card.id === "corporate" ? "bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 border-red-100 dark:border-red-800" : "bg-blue-50 dark:bg-blue-900/30 text-blue-500 dark:text-blue-400 border-blue-100 dark:border-blue-800"}`}>
              {card.badge}
            </span>
          )}
        </div>

        {/* text */}
        <div className={isXL ? "mt-6" : "mt-4"}>
          <h3 className={`font-bold text-gray-900 dark:text-white tracking-tight ${isXL ? "text-2xl mb-3" : isMd ? "text-base mb-2" : "text-sm mb-1.5"}`}>{card.title}</h3>
          {(isXL || isMd) && <p className={`text-gray-500 dark:text-gray-400 leading-relaxed ${isXL ? "text-sm max-w-xs" : "text-xs"}`}>{card.description}</p>}
          {isSm && <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug line-clamp-2">{card.description}</p>}
        </div>

        {/* XL: drag hint + CTA */}
        {isXL && (
          <div className="mt-6 flex items-end justify-between">
            <div className={`flex items-center gap-2 text-xs transition-all duration-300 ${isDragging ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500"}`}>
              <Upload className="w-4 h-4" />
              <span>PDF 또는 이미지를 드래그하거나 클릭하세요</span>
            </div>
            <button
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r ${card.accent} shadow-md transition-all duration-200 hover:shadow-lg hover:scale-105 active:scale-95`}
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              시작하기 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MD/SM arrow */}
        {!isXL && (
          <div className={`absolute bottom-4 right-4 transition-all duration-300 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}>
            <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
          </div>
        )}
      </div>

      {/* drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-50/80 dark:bg-blue-900/30 backdrop-blur-[2px] z-10">
          <Upload className="w-10 h-10 text-blue-500 mb-2 animate-bounce" />
          <p className="text-sm font-bold text-blue-600 dark:text-blue-400">파일을 놓아주세요</p>
        </div>
      )}
    </div>
  );
}
