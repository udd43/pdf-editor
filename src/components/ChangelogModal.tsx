import React from "react";
import { X, History } from "lucide-react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANGELOG_DATA = [
  {
    version: "v1.0.52",
    date: "2026-05-31",
    changes: [
      "주주명부 매크로: 아래쪽 줄(주주 5~7)로 갈수록 칸을 벗어나는 문제 해결 (줄 간격 오차 수정)",
      "주주명부 매크로: 텍스트 상자가 테이블 칸에 딱 맞게 들어가도록 좌우 위치 미세 조정",
      "공통 정보(상호, 대표이사 등) 입력 시 글자와 겹치지 않고 우측 빈 공간에 들어가도록 위치 수정"
    ]
  },
  {
    version: "v1.0.51",
    date: "2026-05-31",
    changes: [
      "툴바에 '주주명부 매크로 폼' 수동 열기/닫기 토글 버튼 추가",
      "파일명이 완벽히 일치하지 않아도 사용자가 원할 때 언제든 매크로를 띄울 수 있도록 조건 개선"
    ]
  },
  {
    version: "v1.0.50",
    date: "2026-05-31",
    changes: [
      "우측 추출 텍스트 패널을 플로팅 오버레이 서랍으로 변경",
      "PDF 영역을 넓게 사용하면서 텍스트 목록을 원할 때만 열어볼 수 있도록 개선",
      "고배율 스크롤 시 우측 패널이 잘리거나 화면 밖으로 밀리던 문제 해결"
    ]
  },
  {
    version: "v1.0.48",
    date: "2026-05-31",
    changes: [
      "편집기 툴바를 한 줄 컴팩트 레이아웃으로 개선 (버튼 줄바꿈 제거)",
      "좌측 썸네일 사이드바 폭 축소 (128px→96px)",
      "우측 추출 텍스트 패널 폭 축소 (320px→192px)",
      "PDF 편집 영역 가용 공간 대폭 확대",
      "상태 메시지를 툴바 위 별도 줄로 분리",
    ]
  },
  {
    version: "v1.0.47",
    date: "2026-05-31",
    changes: [
      "이미지 회전 핸들 위치를 우측 상단으로 개선 (UX 향상)",
      "편집기 상단 도구 바 레이아웃 정돈 (텍스트/이미지/뷰어 그룹 분리)",
      "업로드 화면에서 AI 모델명 표시 제거",
      "다크모드 서명/그리기 캔버스 색상 수정 (흰색→회색 배경)",
    ]
  },
  {
    version: "v1.0.46",
    date: "2026-05-29",
    changes: [
      "모바일 환경 최적화 (서명 탭 캔버스 크기 및 여백 개선)",
      "모바일 우측 슬라이드 햄버거 메뉴 추가 (작은 화면에서 탭 내비게이션 숨김)",
      "서명 모달 및 하단 도구 모음 줄바꿈 등 반응형 레이아웃 적용"
    ]
  },
  {
    version: "v1.0.45",
    date: "2026-05-29",
    changes: [
      "다크 모드 토글 버그 수정 (Tailwind v4 @custom-variant 적용)",
      "다크 모드 전체 컴포넌트 일관성 개선 (누끼따기, 업스케일러, 색상변경, 서명 등)",
      "업데이트 내역 모달 다크모드 적용 및 새 버전 시 자동 팝업",
      "다크 모드 설정 localStorage 유지",
    ]
  },
  {
    version: "v1.0.44",
    date: "2026-05-29",
    changes: [
      "PDF 페이지 썸네일 네비게이션 사이드바 추가",
      "드래그 앤 드롭 PDF 병합 기능 추가 (pdf-lib 활용)",
      "다크 모드 지원 추가 (전체 UI 테마 토글)",
      "키보드 방향키 1px 정밀 이동 지원",
      "Ctrl+Z / Ctrl+Y 실행 취소 / 다시 실행 지원",
    ]
  },
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
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: "80vh" }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h3 className="text-lg font-bold text-gray-800 dark:text-white" style={{ fontFamily: "Inter, sans-serif" }}>업데이트 내역</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* 내용 */}
        <div className="flex-1 overflow-y-auto p-6 bg-white dark:bg-gray-800">
          <div className="space-y-8">
            {CHANGELOG_DATA.map((log, index) => (
              <div key={log.version} className="relative">
                {/* 연결선 */}
                {index !== CHANGELOG_DATA.length - 1 && (
                  <div className="absolute left-[11px] top-6 bottom-[-24px] w-0.5 bg-gray-100 dark:bg-gray-700" />
                )}
                
                <div className="flex gap-4">
                  {/* 타임라인 점 */}
                  <div className="relative z-10 mt-1.5 shrink-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${index === 0 ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30" : "border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700"}`}>
                      <div className={`w-2 h-2 rounded-full ${index === 0 ? "bg-blue-500" : "bg-gray-300 dark:bg-gray-500"}`} />
                    </div>
                  </div>
                  
                  {/* 업데이트 내용 */}
                  <div className="flex-1 pb-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`font-mono font-bold text-sm ${index === 0 ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200"}`}>
                        {log.version}
                      </span>
                      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-md">
                        {log.date}
                      </span>
                      {index === 0 && (
                        <span className="text-[10px] font-bold text-white bg-blue-500 px-2 py-0.5 rounded-full">NEW</span>
                      )}
                    </div>
                    <ul className="space-y-1.5">
                      {log.changes.map((change, i) => (
                        <li key={i} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2 leading-relaxed">
                          <span className="text-gray-300 dark:text-gray-600 mt-0.5">•</span>
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
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/80 rounded-b-2xl shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors font-medium shadow-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
