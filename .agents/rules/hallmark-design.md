# Hallmark Anti-AI-Slop Design System Rules (`nutlope/hallmark`)

이 프로젝트는 오픈소스 **Hallmark (`nutlope/hallmark`)** 디자인 규율을 준수하여 AI 생성 특유의 양산형 UI(AI Slop)를 배제합니다.

## 1. 절대 금지 안티패턴 (The Slop Floor)
- **아이브로우 캡슐 배지 금지**: 메인 제목(`h1`, `h2`) 위에 `<Sparkles />` 아이콘과 함께 `rounded-full bg-blue-50` 형태의 작은 홍보성 캡슐 배지(Eyebrow pill)를 배치하지 않는다.
- **무지개빛 그라데이션 & 네온 글로우 금지**: 카드마다 서로 다른 그라데이션(`from-blue-500 to-indigo-600`, `from-purple-500 to-pink-500` 등), `blur-sm` 후광 효과, `animate-pulse` 배지를 사용하지 않는다.
- **획일적인 파스텔 아이콘 박스 + `rounded-3xl` 카드 금지**: 모든 카드를 `rounded-3xl` + 좌측 상단 파스텔 배경 아이콘(`bg-blue-50`, `bg-purple-50`)으로 찍어내지 않는다.
- **무의미한 이모지 남발 금지**: 패널 헤더나 제목에 `✨`, `📷`, `🔍`, `🎨`, `💪` 같은 장식용 이모지를 넣지 않는다.
- **하드코딩된 `Inter` 인라인 스타일 지양**: `style={{ fontFamily: "Inter, sans-serif" }}` 같은 기계적 인라인 폰트 강제를 피하고 프로젝트 타이포그래피 시스템을 따른다.

## 2. 프로젝트 고유 테마: Archival Press & Precision Workbench (인쇄 공방 & 정밀 문서 작업대)
- **표면 물성 (Material Palette)**:
  - 라이트 모드: 따뜻한 코튼지 배경(`#F6F3EA` / `#F9F6ED`), 작업 시트(`#FDFBF7`), 보조 트레이(`#EFECE2`), 정교한 헤어라인 보더(`#DCD6C8` / `#C8C1B0`)
  - 다크 모드: 매트 카본 배경(`#121211`), 작업 시트(`#1A1918`), 보더(`#2C2B28`)
- **컬러 앵커 (Color Anchor)**:
  - 주조색: 카본 잉크(`#161514` / 다크모드 `#F2EFE9`)
  - 단일 포인트 컬러: 교정 인주/스탬프 버밀리온(`#C83E2B` / 다크모드 `#E05A47`)
- **타이포그래피 & 인덱스 위계**:
  - 디스플레이/헤드라인: 에디토리얼 명조(`NanumMyeongjo`) 또는 강건한 산세리프(`NotoSansKR`) 대비
  - 메타데이터/스펙/인덱스(`01`, `02`, 해상도, 용량): 고정폭 서체(`font-mono`)와 대문자 트래킹(`tracking-wider uppercase`)을 활용하여 정밀 도구 느낌 부여
- **매크로스트럭처 (Workbench & Architectural Ledger)**:
  - 기능 나열 시 1px 보더로 구획된 정교한 원장(Ledger) 그리드와 명확한 번호 인덱스(`01`~`12`)를 사용한다.

