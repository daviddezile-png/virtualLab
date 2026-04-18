import React from 'react';

interface GraduatedCylinderProps {
  id: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  volume: number;
  contents: string;
  temperature: number;
  measurements: string;
  isDraggable?: boolean;
  isHovered?: boolean;
  onDoubleClick?: () => void;
  onPositionChange?: (x: number, y: number) => void;
}

const GraduatedCylinderComponent: React.FC<GraduatedCylinderProps> = ({
  id,
  name,
  x,
  y,
  width,
  height,
  volume,
  contents,
  temperature,
  measurements,
  isDraggable = false,
  isHovered = false,
  onDoubleClick,
  onPositionChange,
}) => {
  const drawCylinder = (ctx: CanvasRenderingContext2D) => {
    // Draw cylinder body
    ctx.fillStyle = isHovered ? 'rgba(59, 130, 246, 0.1)' : 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(x, y + 15, width, height - 15);
    
    // Draw cylinder outline
    ctx.strokeStyle = isHovered ? '#3b82f6' : '#6b7280';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 15, width, height - 15);
    
    // Draw liquid
    if (contents && contents !== 'Empty') {
      ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
      const liquidHeight = Math.min((height - 25) * 0.7, (height - 25));
      ctx.fillRect(x + 3, y + height - liquidHeight - 5, width - 6, liquidHeight);
    }
    
    // Draw measurement marks
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.font = '9px sans-serif';
    
    // Draw main measurement marks
    for (let i = 0; i <= 10; i++) {
      const markY = y + 15 + ((height - 15) * (i / 10));
      const markValue = Math.round((volume / 10) * i);
      
      ctx.beginPath();
      ctx.moveTo(x - 8, markY);
      ctx.lineTo(x, markY);
      ctx.stroke();
      
      // Draw numbers for major marks
      if (i % 2 === 0) {
        ctx.fillStyle = '#475569';
        ctx.fillText(`${markValue}`, x - 25, markY + 3);
      }
    }
    
    // Draw cylinder rim
    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(x - 2, y + 13, width + 4, 6);
    
    // Draw label
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(x + width/2 - 45, y - 20, 90, 18);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, x + width/2, y - 5);
    
    // Draw contents label
    if (contents) {
      ctx.font = '9px sans-serif';
      ctx.fillStyle = '#64748b';
      ctx.fillText(contents, x + width/2, y + height + 10);
    }
  };

  return (
    <div>
      <canvas ref={(canvas) => {
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            drawCylinder(ctx);
          }
        }
      }} />
    </div>
  );
};

export default GraduatedCylinderComponent;
