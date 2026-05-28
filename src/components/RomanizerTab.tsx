"use client";

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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto py-12 px-4">
      <div className="w-full bg-white p-8 rounded-3xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-center mb-8">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center border border-blue-100">
            <Languages className="w-8 h-8" />
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-gray-900 text-center mb-2" style={{ fontFamily: "Inter, sans-serif" }}>
          영문명 변환기
        </h3>
        <p className="text-gray-500 text-center mb-8 text-sm">
          한글 이름을 입력하면 올바른 로마자 표기와 자주 쓰이는 영문 성씨로 변환해드립니다.
        </p>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">한글 이름</label>
            <input
              type="text"
              value={koreanName}
              onChange={(e) => setKoreanName(e.target.value)}
              placeholder="예: 홍길동, 김철수"
              className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all text-lg"
            />
          </div>

          <div className="flex justify-center text-gray-400">
            <ArrowRight className="w-6 h-6 rotate-90 sm:rotate-0" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">영문 이름</label>
            <div className="relative">
              <input
                type="text"
                readOnly
                value={romanized}
                placeholder="결과가 여기에 표시됩니다"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-medium text-lg outline-none"
              />
              {romanized && (
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 text-gray-600 transition-all flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  <span className="text-xs font-semibold">{copied ? "복사됨" : "복사"}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-500 leading-relaxed">
          <ul className="list-disc pl-4 space-y-1">
            <li>일반적으로 쓰이는 성씨(Kim, Lee, Park 등)는 널리 쓰이는 표기로 자동 변환됩니다.</li>
            <li>이름 부분은 국어의 로마자 표기법에 따라 변환됩니다.</li>
            <li>공백은 띄어쓰기로 처리되며, 모든 글자는 대문자로 표기됩니다.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
