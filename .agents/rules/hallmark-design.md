# Impeccable Design System Rules (`pbakaus/impeccable`)

이 프로젝트는 오픈소스 **Impeccable (`pbakaus/impeccable`)** 디자인 규율과 62개 정적/시각 검증 규칙(`npx impeccable detect`)을 준수합니다.

## 핵심 규칙
1. **배경 및 컬러 (`cream-palette`, `ai-color-palette` 방지)**:
   - 반사적인 베이지/크림색 배경이나 보라-파랑 그라데이션을 쓰지 않는다.
   - 쿨 뉴트럴 슬레이트(`#F8F9FB` / 다크 `#0B0D11`)와 순백 시트(`#FFFFFF` / 다크 `#12151C`), 코발트 액센트(`#2563EB`)를 사용한다.
2. **타이포그래피 및 위계 (`kicker-above-heading`, `numbered-section-labels`, `skipped-heading`, `undersized-ui-text` 방지)**:
   - 제목(`h1`, `h2`, `h3`) 바로 위에 작은 대문자 Kicker나 캡슐 배지(Eyebrow chip)를 두지 않는다.
   - 섹션마다 `01`, `02` 번호 라벨을 반복하지 않는다.
   - 헤딩 레벨(`h1` → `h2` → `h3`)을 건너뛰지 않으며, 모든 인터랙티브 UI 텍스트는 최소 `12px`(`text-xs`) 이상을 유지한다.
3. **레이아웃 및 컴포넌트 (`icon-tile-stack`, `nested-cards`, `side-tab`, `bounce-easing` 방지)**:
   - 아이콘 박스를 제목 위에 수직으로 쌓지 않고(`icon-tile-stack`), 항상 제목과 나란히(`flex items-center gap-2.5`) 배치한다.
   - 카드 안에 또 카드를 중첩(`nested-cards`)하지 않고 구분선과 여백으로 계층을 나눈다.
   - 카드 한쪽 면에만 두꺼운 컬러 보더(`border-l-4`)를 넣지 않는다(`side-tab`).
   - `animate-bounce` 등 통통 튀는 이징을 사용하지 않는다(`bounce-easing`).
