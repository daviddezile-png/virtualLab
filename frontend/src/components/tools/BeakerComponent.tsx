import React from "react";

interface BeakerProps {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  volume: number;
  contents: string;
  temperature: number;
  color: string;
  isDraggable?: boolean;
  isHovered?: boolean;
  onDoubleClick?: () => void;
  onPositionChange?: (x: number, y: number) => void;
}

const BeakerComponent: React.FC<BeakerProps> = ({
  id,
  name,
  x,
  y,
  width,
  height,
  volume,
  contents,
  temperature,
  color,
  isDraggable = false,
  isHovered = false,
  onDoubleClick,
  onPositionChange,
}) => {
  const drawBeaker = (ctx: CanvasRenderingContext2D) => {
    // Draw beaker body
    ctx.fillStyle = isHovered
      ? "rgba(59, 130, 246, 0.1)"
      : "rgba(255, 255, 255, 0.1)";
    ctx.fillRect(x, y + 20, width, height - 20);

    // Draw beaker outline
    ctx.strokeStyle = isHovered ? "#3b82f6" : "#6b7280";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 20, width, height - 20);

    // Draw liquid
    if (contents && contents !== "Empty") {
      ctx.fillStyle =
        color === "Yellow"
          ? "rgba(255, 235, 59, 0.7)"
          : color === "Clear"
            ? "rgba(59, 130, 246, 0.3)"
            : color === "White"
              ? "rgba(255, 255, 255, 0.8)"
              : "rgba(200, 200, 200, 0.5)";
      const liquidHeight = Math.min((height - 30) * 0.6, height - 30);
      ctx.fillRect(
        x + 2,
        y + height - liquidHeight - 5,
        width - 4,
        liquidHeight,
      );
    }

    // Draw beaker rim
    ctx.fillStyle = "#e5e7eb";
    ctx.fillRect(x - 2, y + 18, width + 4, 8);

    // Draw measurement marks
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 1;
    ctx.font = "10px sans-serif";

    for (let i = 0; i <= 4; i++) {
      const markY = y + 20 + (height - 20) * (i / 4);
      ctx.beginPath();
      ctx.moveTo(x - 5, markY);
      ctx.lineTo(x, markY);
      ctx.stroke();

      if (i % 2 === 0) {
        const markVolume = Math.round(volume * (i / 4));
        ctx.fillText(`${markVolume}mL`, x - 35, markY + 3);
      }
    }

    // Draw label
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fillRect(x + width / 2 - 40, y - 25, 80, 20);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(name, x + width / 2, y - 10);

    // Draw contents label
    if (contents) {
      ctx.font = "9px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText(contents, x + width / 2, y + height + 15);
    }
  };

  return (
    <div>
      <canvas
        ref={(canvas) => {
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              drawBeaker(ctx);
            }
          }
        }}
      />
    </div>
  );
};

export default BeakerComponent;
