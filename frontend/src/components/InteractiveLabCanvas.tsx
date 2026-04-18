import React, { useRef, useEffect, useState, useCallback } from "react";
import classNames from "classnames";
import { SimulationStep } from "../simulation/model";
import ApparatusDetailModal from "./ApparatusDetailModal";
import ProtocolSidebar from "./ProtocolSidebar";
import { getInitialApparatus, Apparatus } from "./apparatusData";

const drawBeaker = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, maxVol: number, currentVol: number = 0) => {
  const radius = 5;
  const usableHeight = h * 0.7;
  const bottomPadding = h * 0.15;

  // 1. Draw Liquid First (so glass is on top)
  if (currentVol > 0) {
    const fillPercentage = Math.min(currentVol / maxVol, 1);
    const liquidHeight = usableHeight * fillPercentage;
    const liquidY = (y + h - bottomPadding) - liquidHeight;

    ctx.fillStyle = "rgba(56, 189, 248, 0.6)"; // Water color
    ctx.beginPath();
    ctx.roundRect(x + 2, liquidY, w - 4, (y + h - radius) - liquidY, [0, 0, radius, radius]);
    ctx.fill();
    // Surface line
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(x + 2, liquidY);
    ctx.lineTo(x + w - 2, liquidY);
    ctx.stroke();
  }

  // 2. Glass Body
  const glassGradient = ctx.createLinearGradient(x, y, x + w, y);
  glassGradient.addColorStop(0, "rgba(200, 230, 255, 0.3)");
  glassGradient.addColorStop(0.5, "rgba(230, 245, 255, 0.1)");
  glassGradient.addColorStop(1, "rgba(180, 210, 240, 0.4)");

  ctx.fillStyle = glassGradient;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h - radius);
  ctx.quadraticCurveTo(x, y + h, x + radius, y + h);
  ctx.lineTo(x + w - radius, y + h);
  ctx.quadraticCurveTo(x + w, y + h, x + w, y + h - radius);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  ctx.fill();

  // 3. Markings & Numbers
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = "8px Arial";
  const step = 50;
  for (let i = 0; i <= maxVol / step; i++) {
    const markY = (y + h - bottomPadding) - (i * (usableHeight / (maxVol / step)));
    ctx.beginPath();
    ctx.moveTo(x + 2, markY);
    ctx.lineTo(x + 10, markY);
    ctx.stroke();
    ctx.fillText(`${i * step}`, x + 12, markY + 3);
  }
};

const drawCylinder = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, maxVol: number) => {
  // Base of the cylinder
  ctx.fillStyle = "rgba(180, 210, 240, 0.6)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glass Body
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "rgba(220, 240, 255, 0.4)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
  grad.addColorStop(1, "rgba(200, 230, 255, 0.5)");

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.strokeRect(x, y, w, h);

  // Dynamic Markings and Numbers
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1;
  ctx.font = "7px Arial";
  ctx.textAlign = "left";

  // For 100mL, use 10mL steps
  const step = 10;
  const numberOfMarks = maxVol / step;

  const usableHeight = h * 0.8;
  const bottomPadding = h * 0.1;

  for (let i = 0; i <= numberOfMarks; i++) {
    const currentVol = i * step;
    const markY = (y + h - bottomPadding) - (i * (usableHeight / numberOfMarks));

    ctx.beginPath();
    const lineLength = w * 0.3;
    ctx.moveTo(x, markY);
    ctx.lineTo(x + lineLength, markY);
    ctx.stroke();

    if (currentVol % 20 === 0) { // Label every 20mL
      ctx.fillText(`${currentVol}`, x + lineLength + 2, markY + 2);
    }
  }

  // Label "mL"
  ctx.font = "bold 6px Arial";
  ctx.fillText("mL", x + 5, y + 12);
};

const drawBottle = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, maxVol: number, name: string, hasLid: boolean, currentVol: number, isPouring: boolean = false) => {
  ctx.save();
  // If pouring, move the origin to the bottle neck and rotate
  if (isPouring) {
    ctx.translate(x + w / 2, y);
    ctx.rotate(Math.PI / 2.5); // Tilt 72 degrees
    ctx.translate(-(x + w / 2), -y);
  }
  const neckHeight = h * 0.2;
  const bodyHeight = h - neckHeight;
  const bodyY = y + neckHeight;
  const isWater = name.toLowerCase().includes("water");

  // 1. Liquid Level
  if (currentVol > 0 && isWater) {
    const fillLevel = currentVol / maxVol;
    const liquidH = bodyHeight * fillLevel;
    ctx.fillStyle = "rgba(56, 189, 248, 0.5)";
    ctx.beginPath();
    ctx.roundRect(x, bodyY + (bodyHeight - liquidH), w, liquidH, [0, 0, 8, 8]);
    ctx.fill();
  }

  // 2. Bottle Body
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.fillStyle = isWater ? "rgba(255,255,255,0.1)" : "#f8fafc";
  ctx.beginPath();
  ctx.roundRect(x, bodyY, w, bodyHeight, [0, 0, 8, 8]);
  ctx.fill();
  ctx.stroke();

  // 3. Neck & Cap (Only draw cap if hasLid is true)
  if (hasLid) {
    ctx.fillStyle = isWater ? "#0ea5e9" : "#475569";
    ctx.fillRect(x + w * 0.3, y, w * 0.4, neckHeight);
  }

  // 4. Label
  ctx.fillStyle = "white";
  ctx.fillRect(x + 5, bodyY + 10, w - 10, 25);
  ctx.fillStyle = "black";
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name.split(' ')[0], x + w/2, bodyY + 25);
  ctx.restore();
};

interface InteractiveLabCanvasProps {
  currentStep: SimulationStep;
  onApparatusClick?: (apparatus: Apparatus) => void;
}

const InteractiveLabCanvas: React.FC<InteractiveLabCanvasProps> = ({
  currentStep,
  onApparatusClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedApparatus, setSelectedApparatus] = useState<Apparatus | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showProtocolSidebar, setShowProtocolSidebar] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  
  // High-resolution canvas dimensions to cover full screen
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 800 });
  
  // PERSPECTIVE & LAYOUT CONSTANTS
  const NAV_BAR_HEIGHT = 60;         
  const TABLE_Y = 550;               // Table surface level
  const LIP_HEIGHT = 18;             
  const CABINET_WIDTH = 260;
  const LEFT_GAP = 25;               // Small space on left side
  const SIDE_DEPTH = 22;             // Angle on the right side

  // Dynamic calculation for 3/4 width
  const tableTotalWidth = canvasSize.width * 0.75; 
  const benchHeight = canvasSize.height - (TABLE_Y + LIP_HEIGHT); // Reaches bottom
  const shelfY = 220;

  const [apparatus, setApparatus] = useState<Apparatus[]>(getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y));
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pouringSource, setPouringSource] = useState<string | null>(null);
  const [pouringTarget, setPouringTarget] = useState<string | null>(null);
  const [showPourModal, setShowPourModal] = useState<{ sourceId: string, targetId: string } | null>(null);
  const [isAnimatingPour, setIsAnimatingPour] = useState(false);
  const [showLidModal, setShowLidModal] = useState<{ id: string } | null>(null);

  const drawApparatus = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      // COLORS
      const WALL_COLOR = "#003e63";      
      const NAV_COLOR = "#002d4a";       
      const TABLE_TOP_COLOR = "#b2c3d4";  
      const TABLE_FRONT_COLOR = "#879cb0"; 
      const CABINET_SIDE_COLOR = "#6a7e91"; 
      const DRAWER_COLOR = "#9cb1c4";     
      const HIGHLIGHT_STRIP = "#f8fafc"; 

      // 1. CLEAR & BACKGROUND
      ctx.fillStyle = WALL_COLOR;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);
      
      // 2. NAVIGATION BAR
      ctx.fillStyle = NAV_COLOR;
      ctx.fillRect(0, 0, canvasSize.width, NAV_BAR_HEIGHT);

      // 3. STORAGE SHELF
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(LEFT_GAP, shelfY, tableTotalWidth, 6);

      // 4. DRAW TABLE
      const drawCabinet = (x: number, isRight: boolean) => {
        ctx.fillStyle = TABLE_FRONT_COLOR;
        ctx.fillRect(x, TABLE_Y + LIP_HEIGHT, CABINET_WIDTH, benchHeight);

        if (isRight) {
          ctx.fillStyle = CABINET_SIDE_COLOR;
          ctx.fillRect(x + CABINET_WIDTH, TABLE_Y + LIP_HEIGHT, SIDE_DEPTH, benchHeight);
        }

        // Drawers
        for (let i = 0; i < 2; i++) {
          const dY = TABLE_Y + LIP_HEIGHT + 30 + (i * 90);
          if (dY + 70 < canvasSize.height) { // Only draw if room
            ctx.fillStyle = DRAWER_COLOR;
            ctx.fillRect(x + 10, dY, CABINET_WIDTH - 20, 65);
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.roundRect(x + (CABINET_WIDTH/2) - 25, dY + 30, 50, 6, 2);
            ctx.fill();
            ctx.fillStyle = HIGHLIGHT_STRIP;
            ctx.fillRect(x, dY + 75, CABINET_WIDTH, 4);
          }
        }
      };

      // Middle segment
      ctx.fillStyle = TABLE_FRONT_COLOR;
      ctx.fillRect(LEFT_GAP + CABINET_WIDTH, TABLE_Y + LIP_HEIGHT, tableTotalWidth - (CABINET_WIDTH * 2), benchHeight / 2.5);

      drawCabinet(LEFT_GAP, false); 
      drawCabinet(LEFT_GAP + tableTotalWidth - CABINET_WIDTH, true); 

      // Table Top Surface
      ctx.fillStyle = TABLE_TOP_COLOR;
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, LIP_HEIGHT);
      ctx.fillStyle = HIGHLIGHT_STRIP;
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, 2);

      // 5. APPARATUS RENDERING logic
      apparatus.forEach((item) => {
        const { x, y, width, height, type, name, id } = item;
        // -- Label Rendering --
        const labelX = x + width / 2;
        const labelY = y - 35;
        ctx.font = "bold 11px sans-serif";
        const tWidth = ctx.measureText(name).width;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(labelX - (tWidth / 2 + 8), labelY - 12, tWidth + 16, 20, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText(name, labelX, labelY + 3);

        // -- 3D Shadow for the object --
        ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 5;

        // Draw lid if present
        if (item.data?.hasLid) {
          ctx.save();
          ctx.fillStyle = "#64748b";
          ctx.beginPath();
          ctx.ellipse(x + width / 2, y - 6, width * 0.32, 8, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // Draw pouring stream if pouring
        if (item.data?.isPouring && item.data.pouringTargetId) {
          const target = apparatus.find(a => a.id === item.data?.pouringTargetId);
          if (target) {
            ctx.save();
            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(56, 189, 248, 0.8)";
            ctx.moveTo(x + width / 2, y);
            ctx.lineTo(target.x + target.width / 2, target.y);
            ctx.stroke();
            // Splash at target
            ctx.fillStyle = "#38bdf8";
            ctx.beginPath();
            ctx.arc(target.x + target.width / 2, target.y, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        // Draw apparatus
        if (type === "beaker") {
          const maxVol = item.data?.maxVolume || 250;
          const currentVol = item.data?.currentVolume || 0;
          drawBeaker(ctx, x, y, width, height, maxVol, currentVol);
        } else if (type === "cylinder") {
          const maxVol = item.data?.maxVolume || 100;
          drawCylinder(ctx, x, y, width, height, maxVol);
        } else if (type === "bottle") {
          const maxVol = item.data?.maxVolume || 250;
          const currentVol = item.data?.currentVolume || 0;
          const isPouring = !!item.data?.isPouring;
          drawBottle(ctx, x, y, width, height, maxVol, name, item.data?.hasLid, currentVol, isPouring);
        } else {
          ctx.fillStyle = "white";
          ctx.fillRect(x, y, width, height);
        }

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      });
    },
    [canvasSize, apparatus, benchHeight, tableTotalWidth]
  );

  useEffect(() => {
    const handleResize = () => {
      const container = canvasRef.current?.parentElement?.parentElement;
      if (container) {
        setCanvasSize({
          width: Math.max(container.clientWidth, 1200),
          height: container.clientHeight,
        });
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) drawApparatus(ctx);
    }
  }, [drawApparatus]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const clicked = apparatus.find(a => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height);
    if (clicked) {
      // If lid is present, show lid modal
      if (clicked.data?.hasLid) {
        setShowLidModal({ id: clicked.id });
        return;
      }
      setDragging({ id: clicked.id, offsetX: x - clicked.x, offsetY: y - clicked.y });
      e.preventDefault();
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const snapDistance = 50;
    setApparatus(prev => prev.map(app => {
      if (app.id === dragging.id) {
        let newY = y - dragging.offsetY;
        if (Math.abs((newY + app.height) - TABLE_Y) < snapDistance) {
          newY = TABLE_Y - app.height;
        }
        return { ...app, x: x - dragging.offsetX, y: newY };
      }
      return app;
    }));
  }, [dragging, TABLE_Y]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      // Check if dropped over a valid target (beaker or cylinder, lid off)
      const dragged = apparatus.find(a => a.id === dragging.id);
      if (dragged && !dragged.data?.hasLid && (dragged.type === 'bottle' || dragged.type === 'container')) {
        const dragRect = { x: dragged.x, y: dragged.y, w: dragged.width, h: dragged.height };
        const target = apparatus.find(a =>
          (a.type === 'beaker' || a.type === 'cylinder') &&
          !a.data?.hasLid &&
          dragRect.x + dragRect.w > a.x && dragRect.x < a.x + a.width &&
          dragRect.y + dragRect.h > a.y && dragRect.y < a.y + a.height
        );
        if (target) {
          setShowPourModal({ sourceId: dragged.id, targetId: target.id });
        }
      }
    }
    setDragging(null);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
  }, [dragging, apparatus, handleMouseMove]);

  return (
    <div className="lab-canvas-container">
      <div className="canvas-wrapper custom-scrollbar">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="lab-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setHoveredId(null)}
          onMouseMoveCapture={e => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hovered = apparatus.find(a => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height);
            setHoveredId(hovered?.id || null);
          }}
          onClick={(e) => {
            if (dragging) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const clicked = apparatus.find(a => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height);
            if (clicked) {
              setSelectedApparatus(clicked);
            }
          }}
          onDoubleClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const clicked = apparatus.find(a => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height);
            if (clicked) {
              setSelectedApparatus(clicked);
              setShowDetailModal(true);
              onApparatusClick?.(clicked);
            }
          }}
        />
        {/* Tooltip for volume */}
        {hoveredId && (() => {
          const item = apparatus.find(a => a.id === hoveredId);
          if (!item) return null;
          const vol = item.data?.currentVolume ?? 0;
          const max = item.data?.maxVolume ?? 0;
          return (
            <div style={{
              position: 'absolute',
              left: item.x + item.width / 2,
              top: item.y - 30,
              background: 'rgba(30,41,59,0.95)',
              color: 'white',
              padding: '4px 10px',
              borderRadius: 8,
              fontSize: 13,
              pointerEvents: 'none',
              transform: 'translate(-50%, 0)',
              zIndex: 20
            }}>
              {vol} mL / {max} mL
            </div>
          );
        })()}
      </div>
      {/* Pour Modal */}
      {showPourModal && (() => {
        const source = apparatus.find(a => a.id === showPourModal.sourceId);
        const target = apparatus.find(a => a.id === showPourModal.targetId);
        if (!source || !target) return null;
        const available = source.data?.currentVolume || 0;
        const targetMax = target.data?.maxVolume || 0;
        const targetCurrent = target.data?.currentVolume || 0;
        const maxPour = Math.min(available, targetMax - targetCurrent, 100);
        return (
          <div style={{
            position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.25)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 8px 32px #0002' }}>
              <h2 className="font-bold text-lg mb-2">Pour Liquid</h2>
              <p className="mb-4">How much would you like to pour from <b>{source.name}</b> into <b>{target.name}</b>?</p>
              <div className="mb-4">
                <input type="range" min={1} max={maxPour} defaultValue={maxPour} id="pourAmount" style={{ width: 200 }} disabled={isAnimatingPour} />
                <span className="ml-2 font-mono">{maxPour} mL</span>
              </div>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                disabled={isAnimatingPour}
                onClick={() => {
                  const amount = parseInt((document.getElementById('pourAmount') as HTMLInputElement)?.value || '0', 10);
                  setIsAnimatingPour(true);
                  // Animate pouring with tilt and real-time volume
                  let progress = 0;
                  const steps = 60;
                  const animate = () => {
                    progress += 1 / steps;
                    setApparatus(prev => prev.map(a => {
                      if (a.id === source.id) {
                        const newVol = Math.max(0, (a.data?.currentVolume || 0) - (amount / steps));
                        return { ...a, data: { ...a.data, isPouring: true, pouringTargetId: target.id, pouringProgress: progress, currentVolume: newVol } };
                      }
                      if (a.id === target.id) {
                        const newVol = Math.min(a.data?.maxVolume || 1000, (a.data?.currentVolume || 0) + (amount / steps));
                        return { ...a, data: { ...a.data, currentVolume: newVol } };
                      }
                      return a;
                    }));
                    if (progress < 1) {
                      setTimeout(animate, 18);
                    } else {
                      setApparatus(prev => prev.map(a => a.id === source.id ? { ...a, data: { ...a.data, isPouring: false, pouringTargetId: null, pouringProgress: 0 } } : a));
                      setIsAnimatingPour(false);
                      setShowPourModal(null);
                    }
                  };
                  animate();
                }}
              >Pour</button>
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                disabled={isAnimatingPour}
                onClick={() => setShowPourModal(null)}
              >Cancel</button>
            </div>
          </div>
        );
      })()}
      {showLidModal && (() => {
        const item = apparatus.find(a => a.id === showLidModal.id);
        if (!item) return null;
        return (
          <div style={{
            position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh',
            background: 'rgba(0,0,0,0.25)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ background: 'white', borderRadius: 12, padding: 32, minWidth: 320, boxShadow: '0 8px 32px #0002' }}>
              <h2 className="font-bold text-lg mb-2">{item.name}</h2>
              <p className="mb-4">This container is closed. Remove the lid to pour?</p>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                onClick={() => {
                  setApparatus(prev => prev.map(a => a.id === item.id ? { ...a, data: { ...a.data, hasLid: false } } : a));
                  setShowLidModal(null);
                }}
              >Remove Lid</button>
              <button
                className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                onClick={() => setShowLidModal(null)}
              >Cancel</button>
            </div>
          </div>
        );
      })()}

      {/* MODAL & SIDEBAR RESTORED */}
      {selectedApparatus && (
        <ApparatusDetailModal
          isOpen={showDetailModal}
          onClose={() => { setShowDetailModal(false); setSelectedApparatus(null); }}
          apparatusType={selectedApparatus.type}
          apparatusName={selectedApparatus.name}
          currentData={selectedApparatus.data}
        />
      )}

      <ProtocolSidebar 
        currentStep={currentStep} 
        isOpen={showProtocolSidebar} 
        onClose={() => setShowProtocolSidebar(false)} 
      />

      {/* Protocol Toggle Button */}
      <button 
        onClick={() => setShowProtocolSidebar(!showProtocolSidebar)} 
        className="protocol-toggle-btn"
      >
        {showProtocolSidebar ? "Hide Protocol" : "Show Protocol"}
      </button>
    </div>
  );
};

export default InteractiveLabCanvas;