# PDF Editor Architecture & Agent Guidelines

- **Framework**: Vite + React 19 SPA (Single Page Application)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`)
- **State Management**: Zustand (`src/stores/appStore.ts`)
- **PDF Engines**: `pdfjs-dist` (client-side rendering), `pdf-lib` (vector manipulation & export)
- **AI Engines**: `@imgly/background-removal`, `onnxruntime-web` (WebGPU / WASM inpainting), Real-ESRGAN backend
- **Backend API**: Node.js Express (`server.js`) for Real-ESRGAN upscaling fallback
