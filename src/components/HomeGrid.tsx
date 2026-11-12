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
  spec: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: "primary" | "vision" | "bindery";
  action: "expand" | "upload" | "navigate";
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
      spec: "PDF · JPG · PNG · HEIC",
      title: "PDF 문서 편집",
      description: "텍스트 계층 추가, 이미지·서명 배치, 보안 마스킹 및 원본 대조 작업을 수행합니다.",
      icon: <FileText className="w-5 h-5" />,
      category: "primary",
      action: "upload",
    },
    {
      id: "smartpdf",
      spec: "표 · 선 · 텍스트 자동 분해",
      title: "스마트 워드·표 편집",
      description: "문서 내부의 표와 선, 텍스트 셀을 자동 인식하여 워드 파일처럼 셀 단위로 직접 교정합니다.",
      icon: <Wand2 className="w-5 h-5" />,
      category: "primary",
      action: "upload",
    },
    {
      id: "eraser",
      spec: "WebGPU 인페인팅",
      title: "AI 스마트 지우개",
      description: "문서 속 도장, 서명, 오타, 불필요한 흔적을 주변 배경 질감에 맞춰 자연스럽게 지웁니다.",
      icon: <Eraser className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "bgremove",
      spec: "투명 PNG 추출",
      title: "배경 제거 (누끼)",
      description: "직인, 서명, 인물·사물 이미지에서 배경만 정밀하게 분리합니다.",
      icon: <Scissors className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "upscale",
      spec: "Real-ESRGAN 2x",
      title: "해상도 업스케일",
      description: "저해상도 스캔 문서나 흐릿한 사진을 선명하게 2배 확대합니다.",
      icon: <ZoomIn className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "heic",
      spec: "HEIC / HEIF → PNG",
      title: "HEIC 무손실 변환",
      description: "아이폰 고효율 사진을 표준 PNG 이미지나 단일 PDF로 즉시 변환합니다.",
      icon: <Smartphone className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "colorize",
      spec: "틴트 · 오버레이 · 단색 교체",
      title: "색상 변경 · 인주 교정",
      description: "도장 인주 색상 조정이나 단색 교체 등 이미지 색조를 정밀하게 제어합니다.",
      icon: <Palette className="w-4 h-4" />,
      category: "vision",
      action: "expand",
    },
    {
      id: "mergesplit",
      spec: "병합 · 추출 · 회전",
      title: "PDF 합치기 · 분할",
      description: "여러 PDF 문서를 하나로 병합하거나 특정 페이지 추출 및 90° 회전을 처리합니다.",
      icon: <Merge className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "compress",
      spec: "용량 최적화",
      title: "PDF 용량 압축",
      description: "이메일 첨부 및 전자결재 업로드 제한에 맞춰 문서 용량을 경량화합니다.",
      icon: <Archive className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "img2pdf",
      spec: "다중 이미지 병합",
      title: "이미지 → PDF 제본",
      description: "여러 장의 스캔본(PNG, JPG, HEIC)을 순서대로 배열하여 단일 PDF로 묶습니다.",
      icon: <Layers className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "signature",
      spec: "드로잉 · 서체 변환",
      title: "서명 그리기",
      description: "직접 필기하거나 서체를 지정하여 문서 삽입용 투명 서명 이미지를 제작합니다.",
      icon: <PenTool className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "romanize",
      spec: "여권 · 국어 로마자 표기",
      title: "영문 성명 표기",
      description: "국어 로마자 표기법 및 여권 관용 성씨 기준에 맞춘 대문자 영문명을 산출합니다.",
      icon: <Languages className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
    {
      id: "calculator",
      spec: "일반 · 지분율 연산",
      title: "실무 계산기",
      description: "문서 수치 검산 및 법인 주식 지분율 시뮬레이션을 지원합니다.",
      icon: <Calculator className="w-4 h-4" />,
      category: "bindery",
      action: "expand",
    },
  ];

  if (isSecretMode) {
    CARDS.push({
      id: "corporate",
      spec: "사내 등록 양식",
      title: "법인 서류 양식",
      description: "등록된 법인 기본 서류 양식을 즉시 호출하여 편집 스튜디오로 불러옵니다.",
      icon: <Building2 className="w-4 h-4" />,
      category: "bindery",
      action: "navigate",
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
    <div className="w-full max-w-6xl mx-auto px-4 py-6">
      <input
        ref={fileInputRef}
        id="home-file-upload"
        type="file"
        accept="application/pdf, image/jpeg, image/png, .heic, .heif"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* ── Page Header (No eyebrow kicker, balanced H1 + concise context) ── */}
      <div className="pb-6 mb-8 border-b border-[#E2E6EE] dark:border-[#232936] flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            문서 편집 및 이미지 처리 워크스페이스
          </h1>
          <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1.5 max-w-2xl">
            모든 파일 처리와 AI 연산은 외부 서버 전송 없이 브라우저 로컬 메모리에서 안전하게 실행됩니다.
          </p>
        </div>
        <span className="text-xs font-mono text-[#697586] dark:text-[#647087] shrink-0">
          로컬 전용 실행 &middot; 서버 저장 없음
        </span>
      </div>

      {/* ── Section 1: Primary PDF Workstations ── */}
      <section aria-labelledby="section-primary">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="section-primary" className="text-lg font-semibold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            핵심 문서 편집기
          </h2>
          <span className="text-xs text-[#697586] dark:text-[#647087]">
            파일을 드래그 앤 드롭하거나 클릭하여 시작
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Primary Station A: Standard PDF Editor (Flat card, no nested card box) */}
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
            className={`lg:col-span-7 rounded-xl border p-6 sm:p-7 flex flex-col justify-between cursor-pointer transition-colors select-none group ${
              isDragging
                ? "border-[#2563EB] bg-[#2563EB]/5 dark:bg-[#3B82F6]/10"
                : "border-[#CBD2E0] dark:border-[#333B4D] bg-white dark:bg-[#12151C] hover:border-[#2563EB] dark:hover:border-[#3B82F6]"
            }`}
          >
            <div>
              {/* Side-by-side icon + heading (satisfies icon-tile-stack rule) */}
              <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#2563EB] dark:text-[#3B82F6]">
                    {pdfStation.icon}
                  </span>
                  <h3 className="text-xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
                    {pdfStation.title}
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#697586] dark:text-[#647087]">
                  {pdfStation.spec}
                </span>
              </div>

              <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] leading-relaxed max-w-xl">
                {pdfStation.description}
              </p>
            </div>

            <div className="pt-5 mt-6 border-t border-[#E2E6EE] dark:border-[#232936] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-xs text-[#4B5565] dark:text-[#94A0B8]">
                <Upload className="w-4 h-4 text-[#2563EB] dark:text-[#3B82F6]" />
                {isDragging
                  ? "여기에 파일을 놓으면 편집기가 열립니다"
                  : "이 영역에 PDF·이미지를 끌어다 놓거나 버튼을 누르세요"}
              </span>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(pdfStation);
                }}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-semibold transition-colors shrink-0 cursor-pointer"
              >
                <span>파일 선택하기</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Primary Station B: Smart Structural Editor */}
          <div
            onClick={() => handleCardClick(smartStation)}
            className="lg:col-span-5 rounded-xl border border-[#E2E6EE] dark:border-[#232936] hover:border-[#2563EB] dark:hover:border-[#3B82F6] bg-white dark:bg-[#12151C] p-6 sm:p-7 flex flex-col justify-between cursor-pointer transition-colors select-none group"
          >
            <div>
              <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 mb-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-[#2563EB] dark:text-[#3B82F6]">
                    {smartStation.icon}
                  </span>
                  <h3 className="text-xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
                    {smartStation.title}
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#697586] dark:text-[#647087]">
                  {smartStation.spec}
                </span>
              </div>

              <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] leading-relaxed">
                {smartStation.description}
              </p>
            </div>

            <div className="pt-5 mt-6 border-t border-[#E2E6EE] dark:border-[#232936] flex items-center justify-between gap-3">
              <span className="text-xs text-[#697586] dark:text-[#647087]">
                표 셀 인식 &middot; 벡터 라인 유지 &middot; 영구 마스킹
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] dark:text-[#3B82F6] group-hover:translate-x-0.5 transition-transform shrink-0">
                열기 <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── Section 2: AI Vision & Image Tools (More space above mt-10 than below mb-3 for heading-rhythm) ── */}
      <section aria-labelledby="section-vision" className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="section-vision" className="text-lg font-semibold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            AI 이미지 복원 및 변환
          </h2>
          <span className="text-xs text-[#697586] dark:text-[#647087]">
            도장·서명 추출 및 화질 개선
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {visionTools.map((tool) => (
            <ToolCard
              key={tool.id}
              card={tool}
              onClick={() => handleCardClick(tool)}
            />
          ))}
        </div>
      </section>

      {/* ── Section 3: Document Bindery & Utilities ── */}
      <section aria-labelledby="section-bindery" className="mt-10">
        <div className="flex items-baseline justify-between mb-3">
          <h2 id="section-bindery" className="text-lg font-semibold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
            문서 병합·압축 및 실무 도구
          </h2>
          <span className="text-xs text-[#697586] dark:text-[#647087]">
            페이지 관리 및 부가 유틸리티
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {binderyTools.map((tool) => (
            <ToolCard
              key={tool.id}
              card={tool}
              onClick={() => handleCardClick(tool)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ───── Impeccable Tool Card (Inline icon + H3, no nested containers, >=12px text) ───── */

interface ToolCardProps {
  card: FeatureCardMeta;
  onClick: () => void;
}

function ToolCard({ card, onClick }: ToolCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group text-left rounded-xl border border-[#E2E6EE] dark:border-[#232936] hover:border-[#2563EB] dark:hover:border-[#3B82F6] bg-white dark:bg-[#12151C] p-5 flex flex-col justify-between min-h-[148px] transition-colors cursor-pointer select-none"
    >
      <div className="w-full">
        {/* Side-by-side icon + heading */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[#4B5565] dark:text-[#94A0B8] group-hover:text-[#2563EB] dark:group-hover:text-[#3B82F6] transition-colors shrink-0">
              {card.icon}
            </span>
            <h3 className="text-base font-semibold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight group-hover:text-[#2563EB] dark:group-hover:text-[#3B82F6] transition-colors">
              {card.title}
            </h3>
          </div>
        </div>

        <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] leading-relaxed">
          {card.description}
        </p>
      </div>

      <div className="w-full pt-3 mt-4 border-t border-[#F1F3F7] dark:border-[#181C26] flex items-center justify-between text-xs text-[#697586] dark:text-[#647087]">
        <span>{card.spec}</span>
        <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:text-[#2563EB] dark:group-hover:text-[#3B82F6] transition-transform" />
      </div>
    </button>
  );
}
