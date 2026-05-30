"use client";

import React, { useState, useEffect } from "react";
import { Download, Terminal } from "lucide-react";
import toast from "react-hot-toast";
import { exportEditedPdf } from "@/lib/pdfUtils";
import { TextBox } from "./PdfEditor";

interface MacroTabProps {
  file: File;
}

export default function MacroTab({ file }: MacroTabProps) {
  const [text, setText] = useState("");
  const [x, setX] = useState("100");
  const [y, setY] = useState("150");
  const [page, setPage] = useState("1");
  const [pdfBuffer, setPdfBuffer] = useState<ArrayBuffer | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    file.arrayBuffer().then((buf) => setPdfBuffer(buf.slice(0)));
  }, [file]);

  const handleExport = async () => {
    if (!text.trim()) {
      toast.error("삽입할 텍스트를 입력해주세요.");
      return;
    }
    if (!pdfBuffer) {
      toast.error("PDF 파일을 아직 불러오는 중입니다.");
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading("매크로 자동 생성 중...");

    try {
      const pageIndex = Math.max(1, parseInt(page, 10));
      const newBox: TextBox = {
        id: `macro-${Date.now()}`,
        text: text,
        x: parseFloat(x) || 100,
        y: parseFloat(y) || 150,
        width: Math.max(200, text.length * 14),
        height: 36 + (text.split('\n').length - 1) * 20,
        fontSize: 16,
        isEdited: true,
        isNew: true,
        isTransparent: true,
        fontFamily: "NotoSansKR",
        pageIndex: pageIndex,
      };

      let defaultName = file.name;
      if (defaultName.toLowerCase().endsWith(".pdf")) {
        defaultName = defaultName.slice(0, -4);
      }

      await exportEditedPdf(pdfBuffer, [newBox], [], 1, `${defaultName}_macro.pdf`);
      
      toast.success("내보내기 완료!", { id: toastId });
      setText(""); // 폼 초기화
    } catch (err: any) {
      console.error(err);
      toast.error("내보내기 실패", { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-gray-100 dark:border-gray-700">
          <div className="p-3 bg-red-50 dark:bg-red-900/30 text-red-500 rounded-xl">
            <Terminal className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">문서 매크로 (Secret)</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              지정된 위치에 텍스트를 몰래 삽입하고 즉시 내보냅니다.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">삽입할 텍스트</label>
            <textarea
              className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
              placeholder="여기에 몰래 삽입할 문구를 적으세요..."
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">페이지 번호</label>
              <input
                type="number"
                min="1"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={page}
                onChange={(e) => setPage(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">X 좌표</label>
              <input
                type="number"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={x}
                onChange={(e) => setX(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Y 좌표</label>
              <input
                type="number"
                className="w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-100 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={y}
                onChange={(e) => setY(e.target.value)}
              />
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={isExporting || !pdfBuffer}
            className="w-full mt-6 py-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            {isExporting ? (
              <span className="flex items-center gap-2">처리 중...</span>
            ) : (
              <>
                <Download className="w-5 h-5" />
                텍스트 삽입 및 강제 내보내기
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
