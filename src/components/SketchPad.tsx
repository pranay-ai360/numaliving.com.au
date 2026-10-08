"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Point = { x: number; y: number };
type Stroke = { points: Point[]; width: number };

/**
 * A simple drawing pad for hand sketches (finger, stylus or mouse).
 * Calls onChange with a PNG of the sketch, or null when empty.
 */
export function SketchPad({ onChange }: { onChange: (png: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [count, setCount] = useState(0);
  const [width, setWidth] = useState(2.5);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const { width: w, height: h } = canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    // light grid to help with proportions
    ctx.strokeStyle = "#efe9df";
    ctx.lineWidth = 1;
    const step = w / 24;
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.strokeStyle = "#1c1b19";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const all = current.current ? [...strokes.current, current.current] : strokes.current;
    for (const s of all) {
      ctx.lineWidth = s.width * (w / 800);
      ctx.beginPath();
      s.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h)));
      if (s.points.length === 1) ctx.lineTo(s.points[0].x * w + 0.1, s.points[0].y * h);
      ctx.stroke();
    }
  }, []);

  // Size the canvas to its box at device resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(r.width * dpr);
      canvas.height = Math.round(r.height * dpr);
      redraw();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  const emit = useCallback(() => {
    setCount(strokes.current.length);
    if (strokes.current.length === 0) return onChange(null);
    canvasRef.current?.toBlob((b) => onChange(b), "image/png");
  }, [onChange]);

  const toPoint = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        aria-label="Sketch area. Draw with a finger, stylus or mouse."
        className="aspect-[4/3] w-full cursor-crosshair touch-none rounded-sm border border-line bg-white sm:aspect-[16/9]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = { points: [toPoint(e)], width };
          redraw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.points.push(toPoint(e));
          redraw();
        }}
        onPointerUp={() => {
          if (!current.current) return;
          strokes.current.push(current.current);
          current.current = null;
          redraw();
          emit();
        }}
        onPointerCancel={() => {
          current.current = null;
          redraw();
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-1 text-ink-muted">Pen</span>
        {[
          { w: 1.5, label: "Fine" },
          { w: 2.5, label: "Medium" },
          { w: 5, label: "Bold" },
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={width === p.w}
            onClick={() => setWidth(p.w)}
            className={`rounded-sm border px-3 py-1.5 ${width === p.w ? "border-gold bg-gold-soft" : "border-line"}`}
          >
            {p.label}
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            strokes.current.pop();
            redraw();
            emit();
          }}
          className="rounded-sm border border-line px-3 py-1.5 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          disabled={count === 0}
          onClick={() => {
            strokes.current = [];
            redraw();
            emit();
          }}
          className="rounded-sm border border-line px-3 py-1.5 disabled:opacity-40"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
