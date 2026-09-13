import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Image as ImageIcon,
  Download,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileCheck,
  RefreshCw,
  Eye,
  ExternalLink,
  Smartphone,
  Sparkles,
  ArrowRight,
  X,
  FileText,
} from "lucide-react";
import toast from "react-hot-toast";
import { isHeicFile, convertHeicToPng } from "@/lib/imageUtils";
import { useAppStore } from "@/stores/appStore";

interface HeicItem {
  id: string;
  file: File;
  name: string;
  size: number;
  status: "idle" | "converting" | "done" | "error";
  errorMsg?: string;
  pngBlob?: Blob;
  pngUrl?: string;
  pngSize?: number;
  width?: number;
  height?: number;
}

export default function HeicConverter() {
  const [items, setItems] = useState<HeicItem[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [previewItem, setPreviewItem] = useState<HeicItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openPdfEditor } = useAppStore();

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 파일 추가
  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles: HeicItem[] = [];

    fileArray.forEach((f) => {
      if (isHeicFile(f)) {
        validFiles.push({
          id: `${f.name}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          file: f,
          name: f.name,
          size: f.size,
          status: "idle",
        });
      } else {
        toast.error(`'${f.name}'은(는) HEIC/HEIF 파일이 아닙니다.`);
      }
    });

    if (validFiles.length > 0) {
      setItems((prev) => [...prev, ...validFiles]);
      toast.success(`${validFiles.length}개의 HEIC 파일이 추가되었습니다.`);
    }
  }, []);

  // 단일 파일 변환
  const convertSingle = async (item: HeicItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, status: "converting", errorMsg: undefined } : it
      )
    );

    try {
      const pngBlob = await convertHeicToPng(item.file);
      const pngUrl = URL.createObjectURL(pngBlob);

      // 해상도 확인
      const img = new Image();
      img.src = pngUrl;
      await new Promise((resolve) => {
        img.onload = resolve;
      });

      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "done",
                pngBlob,
                pngUrl,
                pngSize: pngBlob.size,
                width: img.width,
                height: img.height,
              }
            : it
        )
      );
      toast.success(`'${item.name}' 변환 완료!`);
    } catch (err: any) {
      console.error("HEIC conversion error:", err);
      setItems((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                status: "error",
                errorMsg: err?.message || "변환에 실패했습니다.",
              }
            : it
        )
      );
      toast.error(`'${item.name}' 변환 실패`);
    }
  };

  // 전체 변환
  const convertAll = async () => {
    const pendingItems = items.filter((it) => it.status === "idle" || it.status === "error");
    if (pendingItems.length === 0) {
      toast("변환할 대기 파일이 없습니다.");
      return;
    }

    toast.loading(`${pendingItems.length}개 파일 변환을 시작합니다...`, { duration: 2000 });
    for (const it of pendingItems) {
      await convertSingle(it);
    }
  };

  // 파일 다운로드
  const downloadPng = (item: HeicItem) => {
    if (!item.pngUrl) return;
    const baseName = item.name.replace(/\.[^/.]+$/, "");
    const a = document.createElement("a");
    a.href = item.pngUrl;
    a.download = `${baseName}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // 전체 다운로드
  const downloadAll = () => {
    const doneItems = items.filter((it) => it.status === "done" && it.pngUrl);
    if (doneItems.length === 0) {
      toast.error("다운로드 가능한 변환 완료 파일이 없습니다.");
      return;
    }

    doneItems.forEach((it, idx) => {
      setTimeout(() => {
        downloadPng(it);
      }, idx * 200);
    });
    toast.success(`${doneItems.length}개 PNG 파일을 다운로드합니다.`);
  };

  // PDF 편집기로 바로 열기
  const openInPdfEditor = async (item: HeicItem) => {
    if (!item.pngBlob) return;
    try {
      const { PDFDocument } = await import("pdf-lib");
      const ab = await item.pngBlob.arrayBuffer();
      const pdfDoc = await PDFDocument.create();
      const embeddedImg = await pdfDoc.embedPng(ab);
      const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
      page.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: embeddedImg.width,
        height: embeddedImg.height,
      });
      const pdfBytes = await pdfDoc.save();
      const baseName = item.name.replace(/\.[^/.]+$/, "");
      const pdfFile = new File([pdfBytes as any], `${baseName}.pdf`, {
        type: "application/pdf",
      });
      openPdfEditor(pdfFile);
      toast.success("PDF 편집기로 이동합니다!");
    } catch (err) {
      console.error(err);
      toast.error("PDF 생성 중 오류가 발생했습니다.");
    }
  };

  const [isCreatingPdf, setIsCreatingPdf] = useState(false);

  // 전체 HEIC 이미지를 하나의 통합 PDF로 생성 (다운로드 또는 편집기로 열기)
  const createCombinedPdf = async (action: "download" | "editor" = "download") => {
    if (items.length === 0) {
      toast.error("변환할 파일이 없습니다.");
      return;
    }

    setIsCreatingPdf(true);
    const toastId = toast.loading("HEIC 이미지를 PDF 문서로 생성하는 중...");

    try {
      // 1. 아직 변환되지 않은 파일이 있다면 자동 변환 수행
      let currentItems = [...items];
      const pendingItems = currentItems.filter((it) => it.status !== "done" || !it.pngBlob);

      if (pendingItems.length > 0) {
        toast.loading(`${pendingItems.length}개 파일 자동 변환 중...`, { id: toastId });
        for (const item of pendingItems) {
          try {
            const pngBlob = await convertHeicToPng(item.file);
            const pngUrl = URL.createObjectURL(pngBlob);
            const img = new Image();
            img.src = pngUrl;
            await new Promise((resolve) => {
              img.onload = resolve;
            });

            currentItems = currentItems.map((it) =>
              it.id === item.id
                ? {
                    ...it,
                    status: "done",
                    pngBlob,
                    pngUrl,
                    pngSize: pngBlob.size,
                    width: img.width,
                    height: img.height,
                  }
                : it
            );
          } catch (err) {
            console.error(`Error converting ${item.name}:`, err);
          }
        }
        setItems(currentItems);
      }

      const validItems = currentItems.filter((it) => it.status === "done" && it.pngBlob);
      if (validItems.length === 0) {
        toast.error("변환에 성공한 이미지가 없어 PDF를 생성할 수 없습니다.", { id: toastId });
        setIsCreatingPdf(false);
        return;
      }

      toast.loading(`${validItems.length}장의 사진을 하나의 PDF로 결합하는 중...`, { id: toastId });

      // 2. pdf-lib로 각 이미지를 개별 페이지로 추가
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();

      for (const item of validItems) {
        if (!item.pngBlob) continue;
        const ab = await item.pngBlob.arrayBuffer();
        const embeddedImg = await pdfDoc.embedPng(ab);
        const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: embeddedImg.width,
          height: embeddedImg.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const filename = `heic_combined_${new Date().toISOString().slice(0, 10)}.pdf`;

      if (action === "download") {
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success(`총 ${validItems.length}장의 사진이 담긴 PDF가 다운로드되었습니다!`, { id: toastId });
      } else {
        const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
        const pdfFile = new File([blob], filename, { type: "application/pdf" });
        openPdfEditor(pdfFile);
        toast.success(`총 ${validItems.length}장의 사진으로 PDF 편집기에 열었습니다!`, { id: toastId });
      }
    } catch (err: any) {
      console.error("PDF 일괄 생성 실패:", err);
      toast.error("PDF 생성 중 오류가 발생했습니다.", { id: toastId });
    } finally {
      setIsCreatingPdf(false);
    }
  };

  // 아이템 삭제
  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((it) => it.id === id);
      if (target?.pngUrl) {
        URL.revokeObjectURL(target.pngUrl);
      }
      return prev.filter((it) => it.id !== id);
    });
  };

  // 전체 비우기
  const clearAll = () => {
    items.forEach((it) => {
      if (it.pngUrl) URL.revokeObjectURL(it.pngUrl);
    });
    setItems([]);
  };

  // 컴포넌트 언마운트 시 메모리 정리
  useEffect(() => {
    return () => {
      items.forEach((it) => {
        if (it.pngUrl) URL.revokeObjectURL(it.pngUrl);
      });
    };
  }, []);

  const totalFiles = items.length;
  const doneFiles = items.filter((it) => it.status === "done").length;
  const isConvertingAny = items.some((it) => it.status === "converting");

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center">
      {/* ── 헤더 ── */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-50 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 text-xs font-bold mb-3 border border-sky-200 dark:border-sky-800">
          <Smartphone className="w-3.5 h-3.5" />
          <span>아이폰 고효율 사진 (HEIC/HEIF) 전용 변환기</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-2">
          HEIC → PNG 무손실 변환
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
          아이폰으로 촬영된 <span className="font-semibold text-gray-800 dark:text-gray-200">.heic</span> 사진을
          윈도우, 안드로이드, 웹에서 완벽하게 호환되는 고화질 <span className="font-semibold text-gray-800 dark:text-gray-200">.png</span>로
          서버 전송 없이 100% 브라우저에서 안전하게 변환합니다.
        </p>
      </div>

      {/* ── 파일 드롭존 ── */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.length) {
            handleFiles(e.dataTransfer.files);
          }
        }}
        onClick={() => fileInputRef.current?.click()}
        className={`w-full p-8 sm:p-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center bg-white dark:bg-gray-800/80 shadow-sm ${
          isDragOver
            ? "border-sky-500 bg-sky-50/50 dark:bg-sky-900/20 scale-[1.01]"
            : "border-gray-200 dark:border-gray-700 hover:border-sky-400 dark:hover:border-sky-500 hover:bg-gray-50/50 dark:hover:bg-gray-800"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".heic,.heif,.HEIC,.HEIF,image/heic,image/heif"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) {
              handleFiles(e.target.files);
              e.target.value = "";
            }
          }}
        />

        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 mb-4 group-hover:scale-105 transition-transform">
          <Smartphone className="w-8 h-8" />
        </div>

        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
          HEIC 파일을 끌어다 놓거나 클릭하여 선택
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          여러 파일을 한 번에 선택하여 일괄 변환할 수 있습니다 (.heic, .heif 지원)
        </p>

        <span className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold transition-all shadow-sm">
          사진 파일 선택하기
        </span>
      </div>

      {/* ── 변환 파일 목록 ── */}
      {items.length > 0 && (
        <div className="w-full mt-8 flex flex-col gap-4">
          {/* 상단 컨트롤 바 */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900 dark:text-white">
                총 {totalFiles}개 파일
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-semibold">
                완료 {doneFiles}/{totalFiles}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* 전체를 하나의 PDF로 생성 및 다운로드 */}
              <button
                onClick={() => createCombinedPdf("download")}
                disabled={isCreatingPdf || isConvertingAny}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm active:scale-95 shadow-red-500/20"
                title="모든 HEIC 사진을 하나의 다중 페이지 PDF 문서로 묶어 다운로드합니다"
              >
                {isCreatingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileText className="w-4 h-4" />
                )}
                <span>전체 PDF 다운로드</span>
              </button>

              {/* 전체를 하나의 PDF로 만들어 편집기에서 바로 열기 */}
              <button
                onClick={() => createCombinedPdf("editor")}
                disabled={isCreatingPdf || isConvertingAny}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm active:scale-95 shadow-indigo-500/20"
                title="모든 HEIC 사진으로 PDF를 생성하여 편집기에서 바로 엽니다"
              >
                <ExternalLink className="w-4 h-4" />
                <span>PDF 편집기로 열기</span>
              </button>

              {doneFiles > 0 && (
                <button
                  onClick={downloadAll}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                  title="변환된 PNG 파일들을 개별 다운로드합니다"
                >
                  <Download className="w-4 h-4" />
                  <span>PNG 다운로드 ({doneFiles})</span>
                </button>
              )}

              {totalFiles > doneFiles && (
                <button
                  onClick={convertAll}
                  disabled={isConvertingAny}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gray-700 hover:bg-gray-800 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-sm active:scale-95"
                >
                  {isConvertingAny ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  <span>전체 변환</span>
                </button>
              )}

              <button
                onClick={clearAll}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-red-500 transition-colors"
                title="목록 비우기"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 파일 카드 그리드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all"
              >
                {/* 썸네일 영역 */}
                <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-900 shrink-0 border border-gray-100 dark:border-gray-700 flex items-center justify-center">
                  {item.pngUrl ? (
                    <img
                      src={item.pngUrl}
                      alt={item.name}
                      className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                      onClick={() => setPreviewItem(item)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      {item.status === "converting" ? (
                        <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                      ) : item.status === "error" ? (
                        <AlertCircle className="w-6 h-6 text-red-500" />
                      ) : (
                        <Smartphone className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  )}

                  {item.status === "done" && (
                    <span className="absolute bottom-1 right-1 p-0.5 rounded-full bg-green-500 text-white shadow">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </span>
                  )}
                </div>

                {/* 파일 정보 */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate mb-1" title={item.name}>
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                    <span>{formatFileSize(item.size)}</span>
                    {item.status === "done" && item.pngSize && (
                      <>
                        <span>→</span>
                        <span className="font-semibold text-sky-600 dark:text-sky-400">
                          {formatFileSize(item.pngSize)}
                        </span>
                        {item.width && item.height && (
                          <span className="text-[10px] text-gray-400">
                            ({item.width}×{item.height})
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {/* 상태 배지 */}
                  {item.status === "idle" && (
                    <button
                      onClick={() => convertSingle(item)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>변환하기</span>
                    </button>
                  )}

                  {item.status === "converting" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>PNG 변환 중...</span>
                    </span>
                  )}

                  {item.status === "error" && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500">
                      <AlertCircle className="w-3 h-3" />
                      <span>{item.errorMsg || "변환 실패"}</span>
                    </span>
                  )}

                  {item.status === "done" && (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => downloadPng(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-800/50 text-[11px] font-bold transition-colors"
                      >
                        <Download className="w-3 h-3" />
                        <span>다운로드</span>
                      </button>
                      <button
                        onClick={() => openInPdfEditor(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold transition-colors"
                        title="이 이미지를 새 PDF 문서로 편집기에 불러옵니다"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>PDF로 열기</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 우측 삭제 버튼 */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors shrink-0"
                  title="삭제"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 이미지 미리보기 모달 ── */}
      {previewItem?.pngUrl && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-800">
              <span className="text-sm font-bold text-gray-900 dark:text-white truncate max-w-md">
                {previewItem.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadPng(previewItem)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold hover:bg-sky-700"
                >
                  <Download className="w-3.5 h-3.5" /> 다운로드
                </button>
                <button
                  onClick={() => setPreviewItem(null)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
              <img
                src={previewItem.pngUrl}
                alt={previewItem.name}
                className="max-h-[70vh] object-contain rounded-xl shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
