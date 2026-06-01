import React from "react";
import { X, History } from "lucide-react";

interface ChangelogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANGELOG_DATA = [
  {
    version: "v1.1.0",
    date: "2026-06-01",
    changes: [
      "정식 버전 1.1.0 릴리즈",
      "서버 및 클라이언트 안정화, PDF 에디터 내보내기 최적화 및 매크로 기능(지배자 확인서/주주명부) 분리 적용 완료"
    ]
  },
  {
    version: "v1.0.63",
    date: "2026-06-01",
    changes: [
      "버그 수정: PDF 내보내기가 간헐적으로(또는 두 번째 시도 시) 동작하지 않던 현상 수정 (메모리 버퍼 참조 방식 개선)",
      "버그 수정: 일부 환경에서 폰트 파일을 불러오지 못했을 때 PDF 변환 엔진이 멈추는 현상(에러 핸들링) 수정"
    ]
  },
  {
    version: "v1.0.62",
    date: "2026-06-01",
    changes: [
      "서버 설정 롤백: 자체 서버 환경에서 메모리 부족 등(PM2 크래시)으로 502 에러가 발생하는 문제를 해결하기 위해, 어제 도입했던 로컬 AI 모델(upscaler.js) 및 관련 무거운 의존성 라이브러리를 제거하고 서버 API 방식으로 원상 복구"
    ]
  },
  {
    version: "v1.0.61",
    date: "2026-06-01",
    changes: [
      "긴급 서버 안정화(502 에러 해결): 브라우저 전용 로컬 AI(upscaler.js) 엔진이 서버 렌더링(SSR) 과정에 개입하여 Vercel 서버를 통째로 다운시키던 치명적 버그 수정",
      "AI 모델 로딩 방식을 지연 호출(Dynamic Import) 방식으로 변경하여 초기 로딩 속도 최적화 및 서버 충돌 100% 방지"
    ]
  },
  {
    version: "v1.0.60",
    date: "2026-06-01",
    changes: [
      "긴급 버그 수정: PDF 에디터 내에서 '이미지 업스케일링 추가' 버튼을 누를 때 발생하던 서버 503 에러 해결",
      "삭제된 과거 서버 API를 호출하던 잔여 코드를 완전히 제거하고, 100% 로컬 AI 연산으로 통일되도록 구조 수정 완료"
    ]
  },
  {
    version: "v1.0.59",
    date: "2026-06-01",
    changes: [
      "법인 소유 지배자 확인서 전용 매크로 폼 추가",
      "문서 종류(주주명부 vs 지배자 확인서)를 자동으로 인식하여 툴바의 '매크로 폼' 버튼 클릭 시 상황에 맞는 서로 다른 매크로 폼이 열리도록 지능형 토글 적용"
    ]
  },
  {
    version: "v1.0.58",
    date: "2026-06-01",
    changes: [
      "텍스트 박스 크기 조절 제한 완화: 기존보다 훨씬 더 작게(최소 폭 20px, 높이 10px) 텍스트 박스를 줄일 수 있도록 수정"
    ]
  },
  {
    version: "v1.0.57",
    date: "2026-06-01",
    changes: [
      "업데이트 패치노트 자동 팝업 기능 비활성화"
    ]
  },
  {
    version: "v1.0.56",
    date: "2026-05-31",
    changes: [
      "100% 프라이버시 보장 및 AI 최적화: 서버 의존성을 완전히 제거하고 브라우저 내부에서만 초고속으로 작동하도록 설계 전면 개편",
      "누끼따기 마스크 분리 기법 적용: 이미지를 내부적으로 축소하여 배경을 분석한 뒤 고해상도 원본에 덧씌워 처리 속도 3~5배 향상",
      "업스케일링 로컬 AI 탑재: 기존 서버 API 의존도를 0%로 줄이고, 브라우저용 upscaler.js(TensorFlow.js 기반) 모델을 심어 오프라인에서도 업스케일링 가능"
    ]
  },
  {
    version: "v1.0.55",
    date: "2026-05-31",
    changes: [
      "매크로 폼 버튼 노출 조건 엄격화: 법인 서류(주주명부 등) 탭을 통해 문서를 열었거나 파일명이 법인 서류 형식일 때만 툴바에 '매크로 폼' 토글 버튼이 나타나도록 수정",
      "일반 PDF 문서 편집 시 불필요한 매크로 기능이 노출되어 사용성을 해치던 문제 해결"
    ]
  },
  {
    version: "v1.0.54",
    date: "2026-05-31",
    changes: [
      "주주명부 매크로: 텍스트 상자들이 전체적으로 왼쪽으로 치우쳐 칸을 벗어나던 문제 완벽 수정",
      "표의 모든 열(성명~지분율)과 공통 정보 위치를 우측으로 20px씩 정밀하게 이동하여 칸 안에 쏙 들어가도록 맞춤"
    ]
  },
  {
    version: "v1.0.53",
    date: "2026-05-31",
    changes: [
      "우측 추출 텍스트 바 UX 개선: 넓은 모니터(1920px 이상)에서 패널이 화면 밖으로 밀려나 허공에 떠 있던 버그 수정",
      "추출 텍스트 서랍이 PDF 편집 영역(워크스페이스) 내부에서만 깔끔하게 열리고 닫히도록 absolute 레이아웃으로 변경"
    ]
  },
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
