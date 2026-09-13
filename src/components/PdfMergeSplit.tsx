

import React, { useState, useRef } from "react";
import { Merge, Split, RotateCw, Upload, FileText, Download, Trash2, ArrowUp, ArrowDown, Check, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { mergeMultiplePdfs, extractPdfPages, rotatePdfPages } from "@/lib/pdfUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface FileItem {
  id: string;
  file: File;
  numPages: number;
  buffer: ArrayBuffer;
}

interface PageItem {
  pageNumber: number; // 1-based
  selected: boolean;
  rotation: number; // 0, 90, 180, 270
  canvasDataUrl?: string;
}

export default function PdfMergeSplit() {
  const [activeSubTab, setActiveSubTab] = useState<"merge" | "split">("merge");

  // ── Merge state ──
  const [mergeFiles, setMergeFiles] = useState<FileItem[]>([]);
  const [isMerging, setIsMerging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Split & Rotate state ──
  const [splitFile, setSplitFile] = useState<FileItem | null>(null);
  const [splitPages, setSplitPages] = useState<PageItem[]>([]);
  const [isRenderingSplit, setIsRenderingSplit] = useState(false);
  const [isProcessingSplit, setIsProcessingSplit] = useState(false);
  const splitFileInputRef = useRef<HTMLInputElement>(null);

  // ── Merge handlers ──
  const handleAddMergeFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: FileItem[] = [];
    for (const f of Array.from(files)) {
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) continue;
      try {
        const buffer = await f.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
        const pdf = await loadingTask.promise;
        newItems.push({
          id: `${Date.now()}-${Math.random()}`,
          file: f,
          numPages: pdf.numPages,
          buffer,
        });
      } catch (err) {
        console.error("PDF load error:", err);
        toast.error(`${f.name} 파일 로딩 실패`);
      }
    }

    setMergeFiles((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const moveMergeFile = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mergeFiles.length) return;
    const updated = [...mergeFiles];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setMergeFiles(updated);
  };

  const removeMergeFile = (id: string) => {
    setMergeFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleMergeConfirm = async () => {
    if (mergeFiles.length < 2) {
      toast.error("합치려면 최소 2개 이상의 PDF 파일이 필요합니다.");
      return;
    }

    setIsMerging(true);
    const toastId = toast.loading("PDF를 합치는 중입니다...");
    try {
      const buffers = mergeFiles.map((f) => f.buffer.slice(0));
      const mergedBuffer = await mergeMultiplePdfs(buffers);

      const blob = new Blob([mergedBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `merged_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("성공적으로 합쳐졌습니다!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("PDF 합치기 실패", { id: toastId });
    } finally {
      setIsMerging(false);
    }
  };

  // ── Split & Rotate handlers ──
  const handleLoadSplitFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      setIsRenderingSplit(true);
      const buffer = await f.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const pdf = await loadingTask.promise;

      const fileItem: FileItem = {
        id: `split-${Date.now()}`,
        file: f,
        numPages: pdf.numPages,
        buffer,
      };

      setSplitFile(fileItem);

      // Render thumbnail images for each page
      const pages: PageItem[] = [];
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.25 });
        if (ctx) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: ctx, viewport }).promise;
          pages.push({
            pageNumber: i,
            selected: true,
            rotation: 0,
            canvasDataUrl: canvas.toDataURL("image/png"),
          });
        }
      }

      setSplitPages(pages);
    } catch (err: any) {
      console.error(err);
      toast.error("PDF 파싱 실패");
    } finally {
      setIsRenderingSplit(false);
      if (splitFileInputRef.current) splitFileInputRef.current.value = "";
    }
  };

  const toggleSelectPage = (pageNumber: number) => {
    setSplitPages((prev) =>
      prev.map((p) => (p.pageNumber === pageNumber ? { ...p, selected: !p.selected } : p))
    );
  };

  const toggleSelectAll = (select: boolean) => {
    setSplitPages((prev) => prev.map((p) => ({ ...p, selected: select })));
  };

  const rotatePage = (pageNumber: number) => {
    setSplitPages((prev) =>
      prev.map((p) =>
        p.pageNumber === pageNumber ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      )
    );
  };

  const handleSplitExport = async () => {
    if (!splitFile) return;

    const selectedPages = splitPages.filter((p) => p.selected);
    if (selectedPages.length === 0) {
      toast.error("추출할 페이지를 1개 이상 선택해 주세요.");
      return;
    }

    setIsProcessingSplit(true);
    const toastId = toast.loading("선택한 페이지를 추출 중...");

    try {
      const pageIndices = selectedPages.map((p) => p.pageNumber - 1);
      let newBuffer = await extractPdfPages(splitFile.buffer.slice(0), pageIndices);

      // Apply rotations if any
      const rotationMap = new Map<number, number>();
      selectedPages.forEach((p, newIdx) => {
        if (p.rotation !== 0) rotationMap.set(newIdx, p.rotation);
      });

      if (rotationMap.size > 0) {
        newBuffer = await rotatePdfPages(newBuffer, rotationMap);
      }

      const blob = new Blob([newBuffer], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${splitFile.file.name.replace(/\.pdf$/i, "")}_selected.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("성공적으로 다운로드되었습니다!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("페이지 추출 실패", { id: toastId });
    } finally {
      setIsProcessingSplit(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto py-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
        {/* Header tabs */}
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveSubTab("merge")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeSubTab === "merge"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              <Merge className="w-4 h-4" />
              PDF 합치기 (Merge)
            </button>
            <button
              onClick={() => setActiveSubTab("split")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                activeSubTab === "split"
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200"
              }`}
            >
              <Split className="w-4 h-4" />
              PDF 분할 / 회전 (Split & Rotate)
            </button>
          </div>
        </div>

        {/* ── SubTab 1: PDF 합치기 ── */}
        {activeSubTab === "merge" && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              여러 PDF 파일을 추가하고 원하는 순서대로 배치한 뒤 하나로 병합하세요.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-900/50 transition-all group"
            >
              <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
              <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                PDF 파일 선택 또는 여기에 드래그
              </span>
              <span className="text-xs text-gray-400 mt-1">여러 개의 PDF 선택 가능</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                className="hidden"
                onChange={handleAddMergeFiles}
              />
            </div>

            {mergeFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <span>선택된 파일 ({mergeFiles.length}개)</span>
                  <span>총 {mergeFiles.reduce((acc, cur) => acc + cur.numPages, 0)}페이지</span>
                </div>

                <div className="space-y-2">
                  {mergeFiles.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <FileText className="w-5 h-5 text-gray-400 shrink-0" />
                        <div className="truncate">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">
                            {item.file.name}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            {(item.file.size / 1024 / 1024).toFixed(2)} MB &middot; {item.numPages}페이지
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => moveMergeFile(idx, "up")}
                          disabled={idx === 0}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveMergeFile(idx, "down")}
                          disabled={idx === mergeFiles.length - 1}
                          className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-800 rounded text-gray-500 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => removeMergeFile(item.id)}
                          className="p-1.5 hover:bg-red-50 hover:text-red-500 rounded text-gray-400"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleMergeConfirm}
                    disabled={isMerging || mergeFiles.length < 2}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                  >
                    {isMerging ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    PDF 하나로 합치기 다운로드
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SubTab 2: PDF 분할 & 회전 ── */}
        {activeSubTab === "split" && (
          <div className="space-y-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              PDF에서 추출하고 싶은 페이지를 선택하거나 90도 회전시킨 후 새로 저장하세요.
            </p>

            {!splitFile ? (
              <div
                onClick={() => splitFileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-900/50 transition-all group"
              >
                {isRenderingSplit ? (
                  <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-2" />
                ) : (
                  <Upload className="w-10 h-10 text-gray-400 group-hover:text-blue-500 mb-2 transition-colors" />
                )}
                <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">
                  {isRenderingSplit ? "페이지 썸네일 생성 중..." : "분할할 PDF 파일 선택"}
                </span>
                <input
                  ref={splitFileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={handleLoadSplitFile}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" />
                    <span className="font-bold text-sm text-gray-800 dark:text-gray-200">
                      {splitFile.file.name}
                    </span>
                    <span className="text-xs text-gray-400">({splitFile.numPages}페이지)</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleSelectAll(true)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      전체 선택
                    </button>
                    <button
                      onClick={() => toggleSelectAll(false)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50"
                    >
                      전체 해제
                    </button>
                    <button
                      onClick={() => setSplitFile(null)}
                      className="px-2.5 py-1 text-xs font-semibold text-red-500 bg-white dark:bg-gray-800 border border-red-100 dark:border-red-900 rounded-lg hover:bg-red-50"
                    >
                      다른 파일
                    </button>
                  </div>
                </div>

                {/* Page grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[500px] overflow-y-auto p-2">
                  {splitPages.map((page) => (
                    <div
                      key={page.pageNumber}
                      onClick={() => toggleSelectPage(page.pageNumber)}
                      className={`relative border-2 rounded-2xl p-2 cursor-pointer transition-all group flex flex-col items-center bg-white dark:bg-gray-900 ${
                        page.selected
                          ? "border-blue-500 shadow-md ring-2 ring-blue-500/20"
                          : "border-gray-200 dark:border-gray-700 opacity-50 hover:opacity-100"
                      }`}
                    >
                      <div className="absolute top-3 left-3 z-10">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-white text-xs font-bold ${
                            page.selected ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-700"
                          }`}
                        >
                          {page.selected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          rotatePage(page.pageNumber);
                        }}
                        className="absolute top-3 right-3 p-1.5 bg-white/90 dark:bg-gray-800/90 rounded-lg shadow-sm hover:bg-blue-50 text-gray-600 dark:text-gray-300 z-10"
                        title="90도 회전"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>

                      {page.canvasDataUrl && (
                        <div className="w-full h-36 flex items-center justify-center overflow-hidden my-2">
                          <img
                            src={page.canvasDataUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="max-h-full max-w-full object-contain transition-transform"
                            style={{ transform: `rotate(${page.rotation}deg)` }}
                          />
                        </div>
                      )}

                      <span className="text-xs font-bold text-gray-500">
                        {page.pageNumber}페이지 {page.rotation !== 0 && `(${page.rotation}°)`}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-4 flex justify-between items-center border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-500">
                    선택된 페이지: {splitPages.filter((p) => p.selected).length} / {splitPages.length}개
                  </span>

                  <button
                    onClick={handleSplitExport}
                    disabled={isProcessingSplit || splitPages.filter((p) => p.selected).length === 0}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold rounded-xl shadow-md transition-all active:scale-95 text-sm"
                  >
                    {isProcessingSplit ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    선택 페이지 추출 / 내보내기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
