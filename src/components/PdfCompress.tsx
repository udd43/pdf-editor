

import React, { useState, useRef } from "react";
import { Archive, Upload, Download, Share2, Mail, FileText, Loader2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import * as pdfjsLib from "pdfjs-dist";
import { compressPdfBuffer } from "@/lib/pdfUtils";

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.mjs`;

interface CompressItem {
  file: File;
  originalSize: number; // bytes
  numPages: number;
  buffer: ArrayBuffer;
}

export default function PdfCompress() {
  const [compressItem, setCompressItem] = useState<CompressItem | null>(null);
  const [qualityLevel, setQualityLevel] = useState<"high" | "medium" | "low">("medium");
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressedResult, setCompressedResult] = useState<{
    buffer: ArrayBuffer;
    size: number;
    filename: string;
    autoRetried?: boolean;
  } | null>(null);

  const TARGET_SIZE_MB = 20; // 메일 전송 목표 용량 (MB)

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const buffer = await f.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: buffer.slice(0) });
      const pdf = await loadingTask.promise;

      setCompressItem({
        file: f,
        originalSize: f.size,
        numPages: pdf.numPages,
        buffer,
      });
      setCompressedResult(null);
    } catch (err: any) {
      console.error(err);
      toast.error("PDF 파일 파싱에 실패했습니다.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCompress = async () => {
    if (!compressItem) return;

    setIsCompressing(true);
    const toastId = toast.loading("PDF를 압축하는 중입니다...");

    try {
      // quality map
      const q = qualityLevel === "high" ? 0.8 : qualityLevel === "medium" ? 0.6 : 0.4;
      const scale = qualityLevel === "high" ? 1.4 : qualityLevel === "medium" ? 1.1 : 0.9;

      let compressedBuf = await compressPdfBuffer(compressItem.buffer.slice(0), q, scale);
      let autoRetried = false;

      // 20MB 초과 시 자동 재압축 (최대 압축 강도로 재시도)
      const TARGET_BYTES = TARGET_SIZE_MB * 1024 * 1024;
      if (compressedBuf.byteLength > TARGET_BYTES && qualityLevel !== "low") {
        toast.loading(`결과가 ${TARGET_SIZE_MB}MB 초과 → 강도를 높여 자동 재압축 중...`, { id: toastId });
        compressedBuf = await compressPdfBuffer(compressItem.buffer.slice(0), 0.3, 0.85);
        autoRetried = true;
      }

      setCompressedResult({
        buffer: compressedBuf,
        size: compressedBuf.byteLength,
        filename: `${compressItem.file.name.replace(/\.pdf$/i, "")}_compressed.pdf`,
        autoRetried,
      });

      toast.success("PDF 압축이 완료되었습니다!", { id: toastId });
    } catch (err: any) {
      console.error(err);
      toast.error("PDF 압축 중 오류가 발생했습니다.", { id: toastId });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDownload = () => {
    if (!compressedResult) return;
    const blob = new Blob([compressedResult.buffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = compressedResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleShareOrMail = async () => {
    if (!compressedResult) return;

    const blob = new Blob([compressedResult.buffer], { type: "application/pdf" });
    const file = new File([blob], compressedResult.filename, { type: "application/pdf" });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "압축된 PDF 문서",
          text: "압축 처리된 PDF 문서입니다.",
        });
        toast.success("공유가 완료되었습니다!");
        return;
      } catch (err) {
        console.warn("Share cancelled or failed:", err);
      }
    }

    // Fallback: mailto template link
    const subject = encodeURIComponent(`[PDF 서류] ${compressedResult.filename}`);
    const body = encodeURIComponent(
      `안녕하세요.\n\n요청하신 PDF 서류 (${compressedResult.filename}) 압축 파일입니다.\n다운로드받은 파일을 메일에 첨부하여 발송해주세요.`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    toast.success("메일 작성창을 열었습니다. 저장된 파일을 메일에 첨부해주세요!");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const calculateReductionRatio = () => {
    if (!compressItem || !compressedResult) return 0;
    const ratio = ((compressItem.originalSize - compressedResult.size) / compressItem.originalSize) * 100;
    return Math.max(0, Math.round(ratio));
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-6">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100 dark:border-gray-700">
          <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/30 text-amber-500 rounded-2xl flex items-center justify-center border border-amber-100 dark:border-amber-800">
            <Archive className="w-6 h-6" />
          </div>
        <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              PDF 전용 압축기 (Compress)
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              이메일 전송이나 저장 공간 절약을 위해 PDF 용량을 최적화하여 축소합니다.
            </p>
            <div className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-full">
              <Mail className="w-3 h-3 text-blue-500" />
              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">목표: 메일 첨부용 20MB 이하</span>
            </div>
          </div>
        </div>

        {!compressItem ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 dark:border-gray-600 hover:border-amber-500 dark:hover:border-amber-400 rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer bg-gray-50 dark:bg-gray-900/50 transition-all group"
          >
            <Upload className="w-12 h-12 text-gray-400 group-hover:text-amber-500 mb-3 transition-colors" />
            <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">
              압축할 PDF 파일 선택
            </span>
            <span className="text-xs text-gray-400 mt-1">용량을 줄일 PDF 문서를 올려주세요</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-amber-500" />
                <div>
                  <p className="font-bold text-sm text-gray-800 dark:text-gray-200">
                    {compressItem.file.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    원본 크기: <span className="font-mono">{formatSize(compressItem.originalSize)}</span> &middot; {compressItem.numPages}페이지
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setCompressItem(null);
                  setCompressedResult(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl"
              >
                다른 파일
              </button>
            </div>

            {/* Quality option buttons */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-700 dark:text-gray-300">
                압축 강도 선택
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: "high", title: "보통 압축 (고화질)", desc: "화질 유지 위주" },
                  { id: "medium", title: "권장 압축 (권장)", desc: "균형 잡힌 압축" },
                  { id: "low", title: "최대 압축 (최소 용량)", desc: "메일 전송 추천" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setQualityLevel(item.id as any)}
                    className={`p-3.5 rounded-2xl border text-left transition-all ${
                      qualityLevel === item.id
                        ? "border-amber-500 bg-amber-50/50 dark:bg-amber-900/20 ring-2 ring-amber-500/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                  >
                    <p className="font-bold text-xs text-gray-800 dark:text-gray-200 mb-0.5">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-400">{item.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-center">
              <button
                onClick={handleCompress}
                disabled={isCompressing}
                className="flex items-center gap-2 px-8 py-3.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-sm"
              >
                {isCompressing ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Archive className="w-5 h-5" />
                )}
                PDF 압축 실행하기
              </button>
            </div>

            {/* Compression result box */}
            {compressedResult && (
              <div className="mt-6 p-6 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl space-y-4 animate-in fade-in duration-300">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-sm">
                  <CheckCircle2 className="w-5 h-5" />
                  압축이 성공적으로 끝났습니다! ({calculateReductionRatio()}% 감소)
                  {compressedResult.autoRetried && (
                    <span className="ml-2 text-[10px] font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded-full border border-blue-200 dark:border-blue-700">
                      자동 강화 압축 적용됨
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between bg-white dark:bg-gray-900 p-4 rounded-xl border border-amber-100 dark:border-amber-900">
                  <div>
                    <p className="text-xs text-gray-400">압축 완료된 크기</p>
                    <p className={`text-lg font-mono font-bold ${
                      compressedResult.size > TARGET_SIZE_MB * 1024 * 1024
                        ? "text-red-500"
                        : "text-green-600 dark:text-green-400"
                    }`}>
                      {formatSize(compressedResult.size)}
                      {compressedResult.size <= TARGET_SIZE_MB * 1024 * 1024 && (
                        <span className="ml-2 text-[11px] text-green-500 font-bold">✓ {TARGET_SIZE_MB}MB 이하</span>
                      )}
                      {compressedResult.size > TARGET_SIZE_MB * 1024 * 1024 && (
                        <span className="ml-2 text-[11px] text-red-400 font-bold">⚠ {TARGET_SIZE_MB}MB 초과</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">절감된 용량</p>
                    <p className="text-sm font-mono font-bold text-green-600">
                      -{formatSize(compressItem!.originalSize - compressedResult.size)}
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDownload}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-sm transition-all active:scale-95 text-xs"
                  >
                    <Download className="w-4 h-4" />
                    압축 파일 다운로드
                  </button>

                  <button
                    onClick={handleShareOrMail}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 font-bold rounded-xl shadow-sm transition-all active:scale-95 text-xs"
                  >
                    <Mail className="w-4 h-4 text-blue-500" />
                    이메일 전송 / 공유하기
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
