import React from "react";
import { X, History } from "lucide-react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANGELOG_DATA = [
  {
    version: "v1.0.42",
    date: "2026-05-28",
    changes: [
      "지분율 계산기 - 보통주 및 우선주 입력 분리 적용",
      "보통주 기준 의결권 지분율 및 보통주+우선주 기준 전체 경제적 지분율 동시 확인 기능 추가"
    ]
  },
  {
    version: "v1.0.41",
    date: "2026-05-28",
    changes: [
      "좌측 하단 버전명 클릭 시 업데이트 내역 모달 표시 기능 추가"
    ]
  },
  {
    version: "v1.0.40",
    date: "2026-05-28",
    changes: [
      "계산기 탭 추가 (일반 계산기 및 주식 지분율 계산기 모드 지원)"
    ]
  },
  {
    version: "v1.0.39",
    date: "2026-05-28",
    changes: [
      "서명 탭에 '텍스트로 만들기' (손글씨 폰트) 기능 추가"
    ]
  },
  {
    version: "v1.0.38",
    date: "2026-05-28",
    changes: [
      "영문명 변환기 및 서명 그리기 독립된 탭으로 분리"
    ]
  },
  {
    version: "v1.0.37",
    date: "2026-05-28",
    changes: [
      "영문명 변환 시 일반적으로 쓰이는 영어 성씨(Kim, Lee 등)가 지원되도록 개선"
    ]
  },
  {
    version: "v1.0.36",
    date: "2026-05-25",
    changes: [
      "색상 변경 기능 탭 추가",
      "서명패드 펜 색상 지정 및 그림 다운로드 기능 추가",
      "이미지 오버레이 다운로드 기능 추가",
      "PDF 상태 초기화 버그 수정"
    ]
  },
  {
    version: "v1.0.35 이하",
    date: "이전",
    changes: [
      "PDF 텍스트/이미지 추가 및 서명 등 기본 편집 기능",
      "AI 기반 이미지 누끼따기 (배경 제거) 기능",
      "AI 기반 이미지 업스케일링 기능"
    ]
  }
];

export default function ChangelogModal({ isOpen, onClose }: ChangelogModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "80vh" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/80 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-bold text-gray-800" style={{ fontFamily: "Inter, sans-serif" }}>업데이트 내역</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6 bg-white">
          <div className="space-y-8">
            {CHANGELOG_DATA.map((log, index) => (
              <div key={log.version} className="relative">
                {/* 연결선 */}
                {index !== CHANGELOG_DATA.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-gray-100" />
                )}
                
                <div className="flex gap-4">
                  {/* 타임라인 점 */}
                  <div className="relative z-10 mt-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${index === 0 ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
                      <div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-blue-500" : "bg-gray-300"}`} />
                    </div>
                  </div>
                  
                  {/* 업데이트 내용 */}
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-mono font-bold text-sm ${index === 0 ? "text-blue-600" : "text-gray-800"}`}>
                        {log.version}
                      </span>
                      <span className="text-xs text-gray-400 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                        {log.date}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {log.changes.map((change, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-start gap-2 leading-relaxed">
                          <span className="text-gray-300 mt-0.5">•</span>
                          <span>{change}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/80 rounded-b-2xl shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-medium shadow-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
