import React, { useRef } from 'react';
import { Loader2, Scissors, ZoomIn, Pen, Minus, Plus, Download, Image as ImageIcon } from 'lucide-react';

interface PdfToolbarProps {
  status: string;
  statusMsg: string;
  handleRunOcr: () => void;
  handleAddText: (isTransparent: boolean) => void;
  handleAddRomanizedName: () => void;
  isCorporateDoc: boolean;
  isMacroFormOpen: boolean;
  setIsMacroFormOpen: (open: boolean) => void;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isRemovingBg: boolean;
  handleBgRemoveUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUpscaling: boolean;
  handleUpscaleUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setIsSignatureOpen: (open: boolean) => void;
  numPages: number;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  handleZoom: (type: "in" | "out" | "reset") => void;
  scale: number;
  handleExport: () => void;
  isLoading: boolean;
  hasContent: boolean;
}

export default function PdfToolbar({
  status, statusMsg, handleRunOcr, handleAddText, handleAddRomanizedName,
  isCorporateDoc, isMacroFormOpen, setIsMacroFormOpen,
  handleImageUpload, isRemovingBg, handleBgRemoveUpload,
  isUpscaling, handleUpscaleUpload, setIsSignatureOpen,
  numPages, currentPage, setCurrentPage, handleZoom, scale,
  handleExport, isLoading, hasContent
}: PdfToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const bgRemoveInputRef = useRef<HTMLInputElement>(null);
  const upscaleInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5 mb-2">
      <div className="flex items-center gap-2 px-3 py-1">
        <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${status === "done" ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : status === "error" ? "bg-red-500" : "bg-yellow-500 animate-pulse"}`} />
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate">
          {statusMsg}
        </span>
      </div>
      <div className="flex items-center gap-1.5 p-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 w-full overflow-x-auto custom-scrollbar">
    
        <style>{`
          @font-face { font-family: "NotoSansKR"; src: url("/NotoSansKR-Regular.otf"); }
          @font-face { font-family: "NanumMyeongjo"; src: url("/NanumMyeongjo.ttf"); }
          @font-face { font-family: "Jua"; src: url("/Jua.ttf"); }
        `}</style>

        <button onClick={handleRunOcr} disabled={status !== "done"}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"
          title="문서 내의 글자를 자동으로 인식하여 편집 가능한 박스로 만듭니다">
          📝 텍스트 추출
        </button>
        <button onClick={() => handleAddText(false)} disabled={status !== "done"}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
          텍스트(흰배경)
        </button>
        <button onClick={() => handleAddText(true)} disabled={status !== "done"}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
          텍스트(투명)
        </button>
        <button onClick={handleAddRomanizedName} disabled={status !== "done"}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 text-[11px] font-bold rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/50 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0"
          title="한글 이름을 입력하면 소리나는 대로 영문으로 변환하여 추가합니다">
          영문명 변환
        </button>

        <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />

        {isCorporateDoc && (
          <>
            <button onClick={() => setIsMacroFormOpen(!isMacroFormOpen)} disabled={status !== "done"}
              className={`flex items-center gap-1 px-2.5 py-1.5 border text-[11px] font-bold rounded-md transition-all shadow-sm whitespace-nowrap flex-shrink-0 ${
                isMacroFormOpen 
                ? 'bg-indigo-100 dark:bg-indigo-900 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-300' 
                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
              title="매크로 양식을 열거나 닫습니다">
              🏢 매크로 폼
            </button>
            <div className="w-px h-5 bg-gray-200 dark:bg-gray-600 flex-shrink-0" />
          </>
        )}

        {/* 이미지 도구 드롭다운 */}
        <div className="relative group flex-shrink-0">
          <button 
            disabled={status !== "done"}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> 이미지 도구 ▾
          </button>
          <div className="absolute left-0 top-full mt-1 w-36 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 flex flex-col p-1">
            <button onClick={() => imageInputRef.current?.click()} disabled={status !== "done"}
              className="flex items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm w-full">
              <ImageIcon className="w-3 h-3 text-blue-500" /> 이미지 추가
            </button>
            <button onClick={() => bgRemoveInputRef.current?.click()} disabled={status !== "done" || isRemovingBg}
              className="flex items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm w-full">
              {isRemovingBg ? <Loader2 className="w-3 h-3 animate-spin text-pink-500" /> : <Scissors className="w-3 h-3 text-pink-500" />}
              누끼따기 추가
            </button>
            <button onClick={() => upscaleInputRef.current?.click()} disabled={status !== "done" || isUpscaling}
              className="flex items-center gap-2 px-2 py-1.5 text-left text-[11px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-sm w-full">
              {isUpscaling ? <Loader2 className="w-3 h-3 animate-spin text-purple-500" /> : <ZoomIn className="w-3 h-3 text-purple-500" />}
              업스케일링 추가
            </button>
          </div>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
        <input ref={bgRemoveInputRef} type="file" accept="image/*" className="hidden" onChange={handleBgRemoveUpload} />
        <input ref={upscaleInputRef} type="file" accept="image/*" className="hidden" onChange={handleUpscaleUpload} />
        
        <button onClick={() => setIsSignatureOpen(true)} disabled={status !== "done"}
          className="flex items-center gap-1 px-2.5 py-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 text-[11px] font-semibold rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 transition-all shadow-sm whitespace-nowrap flex-shrink-0">
          <Pen className="w-3.5 h-3.5 text-emerald-500" /> 서명/그리기
        </button>
        
        <div className="flex-1" />

        {numPages > 1 && (
          <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
            <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage <= 1 || status !== "done"}
              className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-r border-gray-200 dark:border-gray-600">
              이전
            </button>
            <span className="text-[10px] font-mono px-2 py-1 text-gray-800 dark:text-gray-200 bg-gray-50 dark:bg-gray-800 select-none">
              {currentPage}/{numPages}
            </span>
            <button onClick={() => setCurrentPage(prev => Math.min(numPages, prev + 1))} disabled={currentPage >= numPages || status !== "done"}
              className="px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-[11px] font-bold text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-gray-600">
              다음
            </button>
          </div>
        )}
        
        <div className="flex items-center bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md overflow-hidden shadow-sm flex-shrink-0">
          <button onClick={() => handleZoom("out")} disabled={status !== "done" || scale <= 0.5}
            className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300" title="축소">
            <Minus className="w-3 h-3" />
          </button>
          <span onClick={() => handleZoom("reset")} 
            className="text-[10px] font-mono px-1.5 py-1 text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-700 border-x border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 select-none font-bold" title="원래 크기 (1.5x)">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={() => handleZoom("in")} disabled={status !== "done" || scale >= 3.0}
            className="p-1 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-30 text-gray-600 dark:text-gray-300" title="확대">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <button onClick={handleExport} disabled={isLoading || !hasContent}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white text-[11px] font-semibold rounded-md shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap flex-shrink-0">
          <Download className="w-3.5 h-3.5" /> 내보내기
        </button>
      </div>
    </div>
  );
}
