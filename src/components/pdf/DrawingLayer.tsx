"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";

export interface StrokePoint {
  x: number;
  y: number;
}

export interface DrawingStroke {
  id: string;
  pageIndex: number;
  mode: "pen" | "highlighter";
  color: string;
  size: number;
  points: StrokePoint[];
}

interface DrawingLayerProps {
  scale: number;
  pageIndex: number;
  isDrawingActive: boolean;
  drawingMode: "pen" | "highlighter";
  drawingColor: string;
  drawingSize: number;
  strokes: DrawingStroke[];
  onAddStroke: (stroke: DrawingStroke) => void;
  width: number;
  height: number;
}

export default function DrawingLayer({
  scale,
  pageIndex,
  isDrawingActive,
  drawingMode,
  drawingColor,
  drawingSize,
  strokes,
  onAddStroke,
  width,
  height,
}: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentPoints = useRef<StrokePoint[]>([]);

  // ── Redraw strokes ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const pageStrokes = strokes.filter((s) => s.pageIndex === pageIndex);

    pageStrokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (stroke.mode === "highlighter") {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = stroke.size * scale * 2.5;
      } else {
        ctx.strokeStyle = stroke.color;
        ctx.globalAlpha = 1.0;
        ctx.lineWidth = stroke.size * scale;
      }

      ctx.moveTo(stroke.points[0].x * scale, stroke.points[0].y * scale);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scale, stroke.points[i].y * scale);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    });
  }, [strokes, pageIndex, scale]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingActive) return;
    e.preventDefault();
    setIsDrawing(true);
    const point = getCanvasCoords(e);
    currentPoints.current = [point];
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawingActive || !isDrawing) return;
    const point = getCanvasCoords(e);
    currentPoints.current.push(point);

    // Live preview
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const pts = currentPoints.current;
    if (pts.length < 2) return;

    ctx.beginPath();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (drawingMode === "highlighter") {
      ctx.strokeStyle = drawingColor;
      ctx.globalAlpha = 0.4;
      ctx.lineWidth = drawingSize * scale * 2.5;
    } else {
      ctx.strokeStyle = drawingColor;
      ctx.globalAlpha = 1.0;
      ctx.lineWidth = drawingSize * scale;
    }

    const prev = pts[pts.length - 2];
    const curr = pts[pts.length - 1];
    ctx.moveTo(prev.x * scale, prev.y * scale);
    ctx.lineTo(curr.x * scale, curr.y * scale);
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  };

  const handleMouseUp = () => {
    if (!isDrawingActive || !isDrawing) return;
    setIsDrawing(false);
    if (currentPoints.current.length > 1) {
      const newStroke: DrawingStroke = {
        id: `stroke-${Date.now()}`,
        pageIndex,
        mode: drawingMode,
        color: drawingColor,
        size: drawingSize,
        points: [...currentPoints.current],
      };
      onAddStroke(newStroke);
    }
    currentPoints.current = [];
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      className={`absolute inset-0 z-20 ${
        isDrawingActive ? "cursor-crosshair pointer-events-auto" : "pointer-events-none"
      }`}
    />
  );
}
