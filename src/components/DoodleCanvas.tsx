import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const COLORS = ["#2f3e5c", "#d1603d", "#2e8b6f", "#e0b13a", "#7a5ea8"];

export function DoodleCanvas({
  onSave,
  saving,
}: {
  onSave?: (dataUrl: string) => void;
  saving?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(4);
  const [eraser, setEraser] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.globalCompositeOperation = eraser ? "destination-out" : "source-over";
    ctx.strokeStyle = color;
    ctx.lineWidth = eraser ? size * 4 : size;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Colore ${c}`}
            onClick={() => {
              setColor(c);
              setEraser(false);
            }}
            className={`size-7 rounded-full border-2 transition-transform ${
              color === c && !eraser ? "scale-110 border-foreground" : "border-border"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
        <Button
          type="button"
          size="sm"
          variant={eraser ? "default" : "outline"}
          onClick={() => setEraser((v) => !v)}
        >
          Gomma
        </Button>
        <input
          type="range"
          min={2}
          max={16}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="w-24 accent-primary"
          aria-label="Spessore del tratto"
        />
        <div className="ml-auto flex gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={clear}>
            Pulisci
          </Button>
          {onSave && (
            <Button
              type="button"
              size="sm"
              disabled={saving}
              onClick={() => {
                const url = canvasRef.current?.toDataURL("image/png");
                if (url) onSave(url);
              }}
            >
              Salva nel diario
            </Button>
          )}
        </div>
      </div>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="ruled h-72 w-full touch-none rounded-2xl border border-border bg-card"
      />
    </div>
  );
}
