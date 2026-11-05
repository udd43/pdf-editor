

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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-6 px-4 transition-colors">
      <div className="w-full bg-white dark:bg-[#12151C] p-6 sm:p-8 rounded-xl border border-[#E2E6EE] dark:border-[#232936]">
        <div className="border-b border-[#E2E6EE] dark:border-[#232936] pb-5 mb-6">
          <div className="flex items-center gap-2.5">
            <Languages className="w-5 h-5 text-[#2563EB] dark:text-[#3B82F6]" />
            <h1 className="text-2xl font-bold text-[#0F141C] dark:text-[#F3F5F8] tracking-tight">
              국문 성명 로마자 변환기
            </h1>
          </div>
          <p className="text-sm text-[#4B5565] dark:text-[#94A0B8] mt-1">
            국어의 로마자 표기법 및 여권 관용 성씨 기준에 맞춰 대문자 영문 성명을 산출합니다.
          </p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] mb-2">
              한글 성명
            </label>
            <input
              type="text"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
              placeholder="예: 홍길동, 김철수"
              className="w-full px-4 py-3 rounded-lg border border-[#CBD2E0] dark:border-[#333B4D] bg-[#F8F9FB] dark:bg-[#181C26] text-[#0F141C] dark:text-[#F3F5F8] focus:border-[#2563EB] outline-none transition-colors text-base"
            />
          </div>

          <div className="flex justify-center text-[#697586]">
            <ArrowRight className="w-5 h-5 rotate-90 sm:rotate-0" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#4B5565] dark:text-[#94A0B8] mb-2">
              영문 표기 결과
            </label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={romanized}
                placeholder="변환 결과가 표시됩니다"
                className="w-full px-4 py-3 rounded-lg border border-[#E2E6EE] dark:border-[#232936] bg-[#F1F3F7] dark:bg-[#181C26] text-[#0F141C] dark:text-[#F3F5F8] font-mono font-bold tracking-wider text-base outline-none"
              />
              {romanized && (
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-md bg-[#2563EB] hover:bg-[#1D4ED8] text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="text-xs font-semibold">{copied ? "복사됨" : "복사"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 rounded-lg bg-[#F8F9FB] dark:bg-[#181C26] border border-[#E2E6EE] dark:border-[#232936] text-xs text-[#4B5565] dark:text-[#94A0B8] leading-relaxed">
          <ul className="list-disc pl-4 space-y-1">
            <li>일반적으로 쓰이는 성씨(KIM, LEE, PARK 등)는 여권 관용 표기로 자동 변환됩니다.</li>
            <li>이름 음절은 문화체육관광부 고시 국어의 로마자 표기법에 따라 변환됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
