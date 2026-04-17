import React, { useRef, useEffect, useState, useCallback } from "react";
import { SimulationStep } from "../simulation/model";
import ApparatusDetailModal from "./ApparatusDetailModal";
import ProtocolSidebar from "./ProtocolSidebar";

interface Apparatus {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image?: string;
  data?: any;
  isInteractive: boolean;
}

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

  const apparatus: Apparatus[] = [
    {
      id: "p2-tips",
      type: "tips",
      name: "P2 Tips",
      x: 180,
      width: 65,
      height: 65,
      y: TABLE_Y - 65,
      isInteractive: true,
    },
    {
      id: "microcentrifuge",
      type: "centrifuge",
      name: "Microcentrifuge",
      x: 850,
      width: 95,
      height: 120,
      y: TABLE_Y - 120,
      isInteractive: true,
    },
  ];

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

      // 5. APPARATUS
      apparatus.forEach((item) => {
        const renderY = TABLE_Y - item.height;
        const labelX = item.x + item.width / 2;
        const labelY = renderY - 35;

        ctx.font = "bold 11px sans-serif";
        const tWidth = ctx.measureText(item.name).width;
        ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
        ctx.beginPath();
        ctx.roundRect(labelX - (tWidth/2 + 10), labelY - 12, tWidth + 20, 22, 4);
        ctx.fill();
        ctx.fillStyle = "#0f172a";
        ctx.textAlign = "center";
        ctx.fillText(item.name, labelX, labelY + 3);
        ctx.fillStyle = "white"; 
        ctx.fillRect(item.x, renderY, item.width, item.height);
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

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#003e63]">
      <div className="w-full h-full overflow-x-auto overflow-y-hidden custom-scrollbar">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="block"
          onClick={(e) => {
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
      </div>

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
      
      <ProtocolSidebar currentStep={currentStep} isOpen={showProtocolSidebar} onClose={() => setShowProtocolSidebar(false)} />
      
      {/* TOGGLE BUTTON RESTORED */}
      <div className="fixed top-2 right-4 z-50 flex items-center ">
        <button 
          onClick={() => setShowProtocolSidebar(!showProtocolSidebar)} 
          className="px-4 py-2 bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700 transition-all text-sm font-bold uppercase tracking-wider"
        >
          {showProtocolSidebar ? "Hide" : "Show"} Protocol
        </button>
      </div>
    </div>
  );
};

export default InteractiveLabCanvas;