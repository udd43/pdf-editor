/**
 * PDF Editor 핵심 도메인 데이터 모델 타입 정의
 * UI 컴포넌트, 훅, 유틸리티 간의 순환/역방향 참조를 방지하고 단일 진실 공급원 역할을 수행합니다.
 */

export interface TextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  isEdited: boolean;
  isNew?: boolean;
  isTransparent?: boolean;
  fontFamily?: string;
  pageIndex: number;
}

export interface ImageOverlayData {
  id: string;
  originalSrc: string;        // 원본 이미지
  displaySrc: string;         // 화면에 렌더링되는 이미지 (누끼/색상변경 적용)
  removedBgSrc: string | null;// 배경 제거된 이미지
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex: number;
  rotation?: number;          // 0 ~ 360 도 회전값
  buffer?: ArrayBuffer | null;
}

export interface RedactionData {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;             // 블라인드 색상 (#111827 or #FFFFFF)
}

export type EditorStatus = "idle" | "rendering" | "ocr" | "done" | "error";

export interface PageInfo {
  width: number;
  height: number;
}
