<div align="center">
  <h1>✨ Advanced AI PDF & Image Studio ✨</h1>
  <p><strong>브라우저에서 완벽하게 동작하는 올인원 PDF 편집 및 AI 이미지 처리 플랫폼</strong></p>
  
  <br />

  <!-- Badges -->
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js" alt="Next.js" /></a>
  <a href="https://reactjs.org/"><img src="https://img.shields.io/badge/React-18-blue?style=for-the-badge&logo=react" alt="React" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" /></a>

  <br />
  <br />
</div>

## 💡 프로젝트 소개

**Advanced AI PDF & Image Studio**는 무거운 별도의 소프트웨어 설치 없이 브라우저 상에서 전문가 수준의 문서 편집과 AI 기반 이미지 처리를 제공하는 차세대 웹 애플리케이션입니다.
Next.js 14 App Router 기반으로 제작되었으며, PDF 텍스트 추가부터 Tesseract 기반의 표 OCR 추출, 클라이언트 사이드 누끼따기, 그리고 `waifu2x` GPU 가속을 활용한 화질 개선까지 하나의 앱에서 모두 해결할 수 있습니다.

<br />

## 🚀 주요 기능 (Features)

### 📄 1. 강력한 PDF 에디터
* **자유로운 텍스트 & 이미지 추가:** 클릭 몇 번으로 PDF 위에 텍스트와 이미지를 자유롭게 배치할 수 있습니다.
* **3종의 고품질 한글 폰트 지원:** 기본고딕, 나눔명조, 배달의민족 주아체를 실시간 미리보기 및 완벽한 PDF 내보내기(Embed)로 지원합니다.
* **배경 투명도 제어:** 흰색 배경 박스와 투명한 텍스트 박스를 미니 툴바에서 자유롭게 토글(🔳/⬜)할 수 있습니다.
* **👀 대조용 듀얼 뷰어 모드:** 원본 PDF와 수정 중인 PDF를 좌우(5:5)로 분할하여 동시에 대조하며 작업할 수 있는 분할 뷰어를 지원합니다.
* **수동 AI OCR (글자 추출):** 필요한 순간에만 `Tesseract.js` (PSM 11 모드 적용)를 호출하여 표/테이블 안의 파편화된 한글까지 깔끔하게 편집 가능한 텍스트 박스로 변환합니다.

### ✂️ 2. 초고속 AI 누끼따기 (Background Removal)
* **100% 브라우저 처리:** `@imgly/background-removal` 엔진을 사용하여 서버 통신 없이 사용자 PC 자원으로만 즉시 누끼를 땁니다. (프라이버시 완벽 보호 및 API 제한 없음)
* **투명도 및 배경색 합성:** 누끼를 딴 결과물에 실시간으로 원하는 컬러(헥사코드)와 투명도를 합성할 수 있습니다.
* **실시간 원본 대조:** 원본 이미지와 처리된 결과물을 나란히 비교하는 스플릿 뷰를 제공합니다.

### 🔍 3. waifu2x 화질 업스케일링 (Image Upscaling)
* **GPU 가속 엔진 탑재:** Linux 서버 내부에 구축된 `waifu2x-ncnn-vulkan` 엔진을 직접 호출하여 깨진 이미지, 노이즈가 심한 사진을 최대 4배까지 깨끗하게 확대합니다.
* **노이즈 및 배율 제어:** 디테일한 노이즈 캔슬링 단계(-1~3)와 배율(2x, 4x) 옵션을 제공합니다.

<br />

## 🛠️ 기술 스택 (Tech Stack)

* **Framework:** Next.js 14 (App Router)
* **Styling:** TailwindCSS, Lucide React (Icons)
* **PDF Processing:** `pdf-lib`, `@pdf-lib/fontkit`
* **AI & Image:** `tesseract.js` (OCR), `@imgly/background-removal` (누끼), `waifu2x-ncnn-vulkan` (서버 업스케일)
* **Infrastructure:** GitHub Actions CI/CD

<br />

## ⚙️ 설치 및 실행 방법 (Getting Started)

### 로컬 개발 환경 실행
```bash
# 1. 저장소 클론
git clone https://github.com/your-username/pdf-editor.git
cd pdf-editor

# 2. 패키지 설치
npm install

# 3. 개발 서버 실행
npm run dev
```
> **주의:** 화질 업스케일링 API 기능을 로컬에서 테스트하려면 macOS 또는 Linux용 `waifu2x-ncnn-vulkan`이 `/opt/waifu2x` 경로에 설치되어 있어야 합니다.

<br />

## 📖 사용 가이드 (How to Use)

1. **상단 탭 이동:** 화면 상단의 `PDF 편집`, `누끼따기`, `업스케일링` 탭을 클릭하여 원하는 기능으로 이동합니다.
2. **파일 업로드:** 화면 정중앙의 점선 박스에 파일을 드래그 앤 드롭하거나 클릭하여 파일을 선택합니다.
3. **PDF 편집 꿀팁:**
   - 빈 공간을 **더블클릭**하면 새로운 텍스트 상자가 즉시 생성됩니다.
   - 생성된 텍스트 박스를 한 번 클릭하면 나타나는 **미니 툴바**에서 폰트 종류, 배경색 유무, 글자 크기를 조절할 수 있습니다.
   - 표나 복잡한 문서가 있다면 상단의 **`📝 텍스트 자동 추출`** 버튼을 클릭하여 화면의 글자를 한 번에 추출하세요.
   - 기존 문서를 참고하며 작성해야 할 때는 우측 상단의 **`+ 대조용 원본 열기`**를 눌러 원본 PDF를 옆에 띄워두고 작업하세요.
4. **저장하기:** 모든 편집과 이미지 처리가 완료되면 각 탭 우측 상단의 `다운로드` 버튼을 눌러 결과물을 파일로 저장합니다.

<br />

## 🛡️ License
This project is licensed under the MIT License - see the LICENSE file for details.
