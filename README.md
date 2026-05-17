# 📄 PDF OCR Editor MVP

웹 브라우저에서 PDF를 업로드하면 OCR로 텍스트를 인식하고, 바로 수정/추가하여 새 PDF로 내보낼 수 있는 웹 편집기입니다.

> **핵심 컨셉**: PDF 위에 텍스트 상자와 이미지를 오버레이로 얹고, 내보내기 시 모든 레이어가 하나로 합쳐져 새 PDF로 출력됩니다. 모든 처리는 클라이언트(브라우저)에서 수행되어 서버 부하가 없습니다.

---

## ✨ 주요 기능

### 📝 텍스트 편집
- PDF 업로드 → **OCR 자동 텍스트 인식** (한국어 + 영어)
- 인식된 텍스트를 **클릭하여 즉시 수정**
- **더블클릭**으로 PDF 위 아무 곳에 새 텍스트 상자 추가
- 텍스트 상자 삭제 가능 (hover 시 ❌ 버튼)

### 🖼️ 이미지 편집
- PDF 위에 **이미지 업로드 및 오버레이** 배치
- **드래그**로 이미지 위치 이동
- **모서리 드래그**로 이미지 크기 조절

### ✂️ 배경 제거 (누끼)
- AI 기반 **클라이언트 사이드 배경 제거** (서버 불필요)
- `@imgly/background-removal` 라이브러리 사용
- 첫 실행 시 AI 모델 다운로드 (약 30~50MB, 이후 캐시됨)

### 🎨 색상 변경
- 배경이 제거된 이미지의 **전경(피사체) 부분만 색상 변경**
- 12개 프리셋 컬러 + 커스텀 컬러 피커
- 투명도(Opacity) 조절 가능

### 📤 PDF 내보내기
- 텍스트 상자 + 이미지 오버레이가 **원본 PDF와 합쳐져** 하나의 파일로 출력
- **한글 폰트** 내장 (Noto Sans CJK KR)
- 수정된 텍스트는 원본 위에 흰색 마스킹 후 새 텍스트로 대체

---

## 🛠️ 기술 스택

| 기술 | 용도 |
|------|------|
| **Next.js 16** (App Router) | 프론트엔드 프레임워크 |
| **Tailwind CSS** | 스타일링 |
| **pdfjs-dist** | PDF 렌더링 (Canvas) |
| **Tesseract.js v7** | OCR 텍스트 인식 (Web Worker) |
| **pdf-lib** | PDF 생성 및 합성 |
| **@imgly/background-removal** | AI 배경 제거 |
| **Lucide React** | UI 아이콘 |

---

## 🚀 로컬 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
```

http://localhost:3000 에서 접속

---

## 📦 프로덕션 빌드 및 배포

```bash
# 프로덕션 빌드
npm run build

# Vercel 배포
npx vercel
```

---

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── layout.tsx          # 루트 레이아웃
│   ├── page.tsx            # 메인 페이지 (클라이언트 전용)
│   └── globals.css         # 글로벌 스타일
├── components/
│   ├── ClientApp.tsx       # 메인 앱 UI
│   ├── PdfUploader.tsx     # PDF 파일 업로드 (Drag & Drop)
│   ├── PdfEditor.tsx       # 핵심 편집기 (OCR + 오버레이)
│   ├── ImageOverlay.tsx    # 이미지 오버레이 (드래그/리사이즈/누끼/색변경)
│   └── ColorPicker.tsx     # 색상 선택기
├── lib/
│   └── pdfUtils.ts         # PDF 내보내기 유틸리티
public/
└── NotoSansKR-Regular.otf  # 한글 폰트 (번들링)
```

---

## ⚙️ 핵심 동작 흐름

```
PDF 업로드 → Canvas 렌더링 (pdf.js)
                ↓
        OCR 텍스트 인식 (Tesseract.js)
                ↓
     텍스트 상자 오버레이 표시
     + 이미지 오버레이 추가 가능
                ↓
      사용자 편집 (수정/추가/삭제)
      + 배경 제거, 색상 변경
                ↓
    내보내기 (pdf-lib로 모든 레이어 합성)
                ↓
         새 PDF 다운로드 🎉
```

---

## 📋 제약사항

- **MVP 기준 단일 페이지** PDF만 지원 (다중 페이지 확장 가능)
- OCR 정확도는 PDF 해상도 및 글꼴에 따라 달라질 수 있음
- 배경 제거 AI 모델은 첫 실행 시 다운로드 필요 (이후 브라우저 캐시)
- Vercel 서버리스 함수 제한을 우회하기 위해 모든 처리가 클라이언트에서 수행됨

---

## 📜 License

MIT
