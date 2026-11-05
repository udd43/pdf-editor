

import React, { useState } from "react";
import { Languages, Copy, Check, ArrowRight } from "lucide-react";
import { koreanToRoman } from "@/lib/romanize";
import toast from "react-hot-toast";

export default function RomanizerTab() {
  const [koreanName, setKoreanName] = useState("");
  const [copied, setCopied] = useState(false);

  // 로마자 변환 후 전체를 대문자로
  const romanized = koreanName.trim() === "" ? "" : koreanToRoman(koreanName.trim())
    .split('_')
    .join(' ')
    .toUpperCase();

  const handleCopy = async () => {
    if (!romanized) return;
    try {
      await navigator.clipboard.writeText(romanized);
      setCopied(true);
      toast.success("영문명이 복사되었습니다!");
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-8 px-4 transition-colors">
      <div className="w-full bg-[#FDFBF7] dark:bg-[#1A1918] p-8 border border-[#C8C1B0] dark:border-[#34322E]">
        <div className="border-b border-[#DCD6C8] dark:border-[#2C2B28] pb-5 mb-6 flex items-start justify-between gap-4">
          <div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#C83E2B] dark:text-[#E05A47] font-bold block mb-1">
              STATION 12 &middot; PASSPORT &amp; OFFICIAL ROMANIZATION
            </span>
            <h3 className="font-editorial text-2xl font-bold text-[#161514] dark:text-[#F2EFE9]">
              국문 성명 로마자 변환기
            </h3>
            <p className="text-xs text-[#57534E] dark:text-[#A6A096] mt-1">
              국어의 로마자 표기법 및 여권 관용 성씨 기준에 맞춰 대문자 영문 성명을 산출합니다.
            </p>
          </div>
          <div className="w-11 h-11 bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] flex items-center justify-center border border-[#DCD6C8] dark:border-[#2C2B28] shrink-0">
            <Languages className="w-5 h-5" />
          </div>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] mb-2">
              KOREAN NAME &middot; 한글 성명
            </label>
            <input
              type="text"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
              placeholder="예: 홍길동, 김철수"
              className="w-full px-4 py-3 border border-[#C8C1B0] dark:border-[#3A3834] bg-[#F6F3EA] dark:bg-[#121211] text-[#161514] dark:text-[#F2EFE9] focus:border-[#161514] dark:focus:border-[#F2EFE9] outline-none transition-colors text-lg"
            />
          </div>

          <div className="flex justify-center text-[#8A847C]">
            <ArrowRight className="w-5 h-5 rotate-90 sm:rotate-0" />
          </div>

          <div>
            <label className="block font-mono text-xs font-bold uppercase tracking-wider text-[#57534E] dark:text-[#A6A096] mb-2">
              ROMANIZED OUTPUT &middot; 영문 표기
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={romanized}
                placeholder="변환 결과가 표시됩니다"
                className="w-full px-4 py-3 border border-[#DCD6C8] dark:border-[#2C2B28] bg-[#EFECE2] dark:bg-[#22211F] text-[#161514] dark:text-[#F2EFE9] font-mono font-bold tracking-wider text-lg outline-none"
              />
              {romanized && (
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#161514] dark:bg-[#F2EFE9] text-[#F9F6ED] dark:text-[#161514] hover:bg-[#C83E2B] dark:hover:bg-[#E05A47] dark:hover:text-[#F9F6ED] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-xs font-bold">{copied ? "복사됨" : "복사"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-[#F6F3EA] dark:bg-[#121211] border border-[#DCD6C8] dark:border-[#2C2B28] text-xs text-[#57534E] dark:text-[#A6A096] leading-relaxed">
          <ul className="list-disc pl-4 space-y-1">
            <li>일반적으로 쓰이는 성씨(KIM, LEE, PARK 등)는 여권 관용 표기로 자동 변환됩니다.</li>
            <li>이름 음절은 문화체육관광부 고시 국어의 로마자 표기법에 따라 변환됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
