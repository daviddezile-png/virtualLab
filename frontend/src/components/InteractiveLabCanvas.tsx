import React, { useRef, useEffect, useState, useCallback } from "react";
import { SimulationStep } from "../simulation/model";
import ApparatusDetailModal from "./ApparatusDetailModal";
import ProtocolSidebar from "./ProtocolSidebar";
import EvaluationPanel from "./EvaluationPanel";
import { getInitialApparatus, getInitialApparatusColdCream, Apparatus } from "./apparatusData";
import { Assignment, BASE_RECIPES } from "../utils/assignmentStore";
import { logLabMilestone } from "../utils/auditStore";

// Maps source bottle ID → composition key
const BOTTLE_INGREDIENT: Record<string, string> = {
  "distilled-water-bottle":        "water",
  "container-stearic-acid":        "stearicAcid",
  "container-liquid-paraffin":     "liquidParaffin",
  "container-glycerin":            "glycerin",
  "container-koh-triethanolamine": "koh",
  "container-borax":               "borax",   // cold cream
};

const parseRgba = (color: string): [number, number, number, number] => {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return [+m[1], +m[2], +m[3], m[4] !== undefined ? +m[4] : 1];
  return [56, 189, 248, 0.8];
};

const drawBeaker = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  maxVol: number,
  currentVol: number = 0,
  liquidColor: string = "rgba(56, 189, 248, 0.6)",
  liquidTemperature: number = 25,
  frame: number = 0,
  isStirring: boolean = false,
  solidStearicGrams: number = 0,
  tiltAngle: number = 0,
  emulsificationProgress: number = 0,
) => {
  ctx.save();
  if (tiltAngle !== 0) {
    ctx.translate(x + w / 2, y);
    ctx.rotate(tiltAngle);
    ctx.translate(-(x + w / 2), -y);
  }
  const radius = 5;
  const usableHeight = h * 0.7;
  const bottomPadding = h * 0.15;
  const solidFloorY = y + h - bottomPadding; // bottom of usable area

  // 0. Draw solid stearic acid chunks (before liquid so liquid renders on top)
  if (solidStearicGrams > 0) {
    const chunkH = Math.min(h * 0.28, 4 + solidStearicGrams * 0.6);
    const chunkY = solidFloorY - chunkH;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 3, chunkY, w - 6, chunkH + 4, [0, 0, radius, radius]);
    ctx.clip();

    // Base wax fill
    ctx.fillStyle = "rgba(255, 250, 238, 0.97)";
    ctx.fillRect(x + 3, chunkY, w - 6, chunkH + 4);

    // Individual wax chunk rectangles with gaps
    const numChunks = Math.max(3, Math.floor((w - 10) / 10));
    const chunkW = (w - 10) / numChunks;
    ctx.fillStyle = "rgba(240, 228, 210, 0.80)";
    for (let i = 0; i < numChunks; i++) {
      const cx2 = x + 5 + i * chunkW;
      const ch2 = chunkH * (0.55 + ((i * 3) % 5) * 0.09);
      ctx.beginPath();
      ctx.roundRect(cx2, chunkY + (chunkH - ch2), chunkW - 2, ch2, 2);
      ctx.fill();
    }

    // Wax surface sheen
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.beginPath();
    ctx.roundRect(x + 5, chunkY, (w - 10) * 0.42, 3, 1);
    ctx.fill();

    ctx.restore();
  }

  // 1. Draw Liquid First (so glass is on top)
  if (currentVol > 0) {
    const fillPercentage = Math.min(currentVol / maxVol, 1);
    const liquidHeight = usableHeight * fillPercentage;
    const liquidY = y + h - bottomPadding - liquidHeight;
    const [lr, lg, lb, la] = parseRgba(liquidColor);

    // Depth gradient — lighter at surface, richer/deeper at bottom
    const liqGrad = ctx.createLinearGradient(x, liquidY, x, y + h - radius);
    liqGrad.addColorStop(0, `rgba(${Math.min(255,lr+30)},${Math.min(255,lg+30)},${Math.min(255,lb+30)},${la*0.72})`);
    liqGrad.addColorStop(0.25, liquidColor);
    liqGrad.addColorStop(1, `rgba(${Math.max(0,lr-12)},${Math.max(0,lg-12)},${Math.max(0,lb-12)},${Math.min(1,la*1.18)})`);
    ctx.fillStyle = liqGrad;
    ctx.beginPath();
    ctx.roundRect(x + 2, liquidY, w - 4, y + h - radius - liquidY, [0, 0, radius, radius]);
    ctx.fill();

    // Meniscus — concave curve at liquid surface (water wets glass)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 3, liquidY + 2);
    ctx.quadraticCurveTo(x + w / 2, liquidY - 3, x + w - 3, liquidY + 2);
    ctx.stroke();

    // Surface shimmer/glare ellipse
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, liquidY, (w - 8) / 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Boiling bubbles (rise from bottom to surface) ──
    if (liquidTemperature > 60) {
      const boilIntensity = Math.min((liquidTemperature - 60) / 40, 1);
      const liqBottom = y + h - bottomPadding;
      const liqColH = liqBottom - liquidY;
      const numBubbles = Math.floor(4 + boilIntensity * 12);

      ctx.save();
      // Clip bubbles to the liquid area so they don't overdraw the glass
      ctx.beginPath();
      ctx.roundRect(x + 2, liquidY, w - 4, liqColH, [0, 0, radius, radius]);
      ctx.clip();

      for (let i = 0; i < numBubbles; i++) {
        const t = ((i / numBubbles + frame * (0.013 + 0.024 * boilIntensity)) % 1);
        const bx = x + 5 + ((i * 7) % (w - 10)) + Math.sin(t * 6 + i * 1.7) * 2;
        const by = liqBottom - t * liqColH;
        const br = 1.2 + boilIntensity * 1.6 + Math.sin(t * Math.PI) * 0.5;
        const ba = 0.3 + 0.5 * Math.sin(t * Math.PI);
        ctx.fillStyle = `rgba(255, 255, 255, ${ba})`;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
        // Highlight dot on each bubble
        ctx.fillStyle = `rgba(255, 255, 255, ${ba * 0.4})`;
        ctx.beginPath();
        ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Agitated/choppy surface when fully boiling
      if (liquidTemperature >= 95) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let px = 0; px <= w - 6; px += 3) {
          const wx = x + 3 + px;
          const wy = liquidY + Math.sin(px * 0.5 + frame * 0.35) * 1.8;
          if (px === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }
    }

    // ── Steam wisps rising from the beaker opening ──
    if (liquidTemperature > 75) {
      const steamIntensity = Math.min((liquidTemperature - 75) / 25, 1);
      for (let wi = 0; wi < 5; wi++) {
        const riseAmt = ((frame * 0.38 + wi * 5.5) % 22);
        const baseY = y - 2 - riseAmt;
        const alpha = (1 - riseAmt / 22) * 0.24 * steamIntensity;
        if (alpha < 0.005) continue;
        ctx.strokeStyle = `rgba(210, 230, 255, ${alpha})`;
        ctx.lineWidth = 1.2 + (riseAmt / 22) * 1.8;
        ctx.beginPath();
        for (let px = 0; px <= w - 10; px += 3) {
          const wx = x + 5 + px;
          const wy = baseY + Math.sin(px / 9 + frame * 0.09 + wi * 1.9) * 2.5;
          if (px === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
        }
        ctx.stroke();
      }
    }

    // ── Stirring swirl ──
    if (isStirring) {
      const swirlCX = x + w / 2;
      const swirlCY = liquidY + (y + h - bottomPadding - liquidY) * 0.55;
      const maxSwR = w / 2 - 5;
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 2, liquidY, w - 4, y + h - radius - liquidY, [0, 0, radius, radius]);
      ctx.clip();
      for (let arc = 0; arc < 3; arc++) {
        const r = maxSwR * (1 - arc * 0.3);
        const startA = frame * 0.22 + arc * (Math.PI * 0.7);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 - arc * 0.13})`;
        ctx.lineWidth = 2.2 - arc * 0.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.arc(swirlCX, swirlCY, r, startA, startA + Math.PI * 1.4);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.beginPath();
      ctx.arc(swirlCX, swirlCY, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineCap = "butt";
      ctx.restore();
    }
  }

  // 2. Cream formation overlay
  if (emulsificationProgress > 0 && currentVol > 0) {
    const tE = Math.max(0, (emulsificationProgress - 20) / 80); // ease-in after 20%

    const fillH2 = usableHeight * Math.min(currentVol / maxVol, 1);
    const liqY2  = y + h - bottomPadding - fillH2;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, liqY2, w - 4, y + h - radius - liqY2, [0, 0, radius, radius]);
    ctx.clip();

    if (emulsificationProgress >= 100) {
      // ── FULLY FORMED — opaque cream fill ──
      const cGrad = ctx.createLinearGradient(x, liqY2, x, y + h - radius);
      cGrad.addColorStop(0, "rgba(255, 253, 250, 0.97)");
      cGrad.addColorStop(0.3, "rgba(252, 249, 244, 0.95)");
      cGrad.addColorStop(1, "rgba(245, 240, 232, 0.98)");
      ctx.fillStyle = cGrad;
      ctx.fillRect(x + 2, liqY2, w - 4, y + h - radius - liqY2);

      // Glossy surface sheen
      ctx.fillStyle = "rgba(255, 255, 255, 0.60)";
      ctx.beginPath();
      ctx.ellipse(x + w / 2, liqY2 + 4, (w - 10) / 2, 5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cream texture dots
      ctx.fillStyle = "rgba(240, 232, 218, 0.45)";
      for (let i = 0; i < 8; i++) {
        const cx2 = x + 5 + ((i * 17) % (w - 10));
        const cy2 = liqY2 + 8 + ((i * 11) % (fillH2 - 16));
        ctx.beginPath();
        ctx.ellipse(cx2, cy2, 3 + i % 3, 2, i * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (emulsificationProgress > 20) {
      // ── FORMING — cloudy/milky overlay ──
      ctx.fillStyle = `rgba(255, 252, 248, ${tE * 0.75})`;
      ctx.fillRect(x + 2, liqY2, w - 4, y + h - radius - liqY2);

      // Animated swirling white streaks
      ctx.strokeStyle = `rgba(255, 255, 255, ${tE * 0.55})`;
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      const midY = liqY2 + (y + h - radius - liqY2) / 2;
      ctx.beginPath();
      ctx.arc(x + w / 2, midY, (w - 12) / 3, frame * 0.14, frame * 0.14 + Math.PI * 1.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + w / 2, midY, (w - 12) / 5, -frame * 0.11, -frame * 0.11 + Math.PI);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    ctx.restore();
  }

  // 3. Glass Body
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
  // Layout: tick line starts from the left glass wall, number follows at the line end.
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1;
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "left";
  const step = 50;
  for (let i = 0; i <= maxVol / step; i++) {
    const markY = y + h - bottomPadding - i * (usableHeight / (maxVol / step));
    const vol   = i * step;

    // Tick: uniform length from left inner glass wall inward
    const tickLen = 12;
    ctx.beginPath();
    ctx.moveTo(x + 2, markY);
    ctx.lineTo(x + 2 + tickLen, markY);
    ctx.stroke();

    // Number: right after the tick end
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.fillText(`${vol}`, x + 2 + tickLen + 2, markY + 3);
  }

  ctx.restore();
};

const drawCylinder = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  maxVol: number,
  currentVol: number = 0,
  tiltAngle: number = 0,
  liquidColor: string = "rgba(56, 189, 248, 0.6)",
) => {
  const usableHeight = h * 0.8;
  const bottomPadding = h * 0.1;

  ctx.save();
  if (tiltAngle !== 0) {
    ctx.translate(x + w / 2, y);
    ctx.rotate(tiltAngle);
    ctx.translate(-(x + w / 2), -y);
  }

  // 1. Draw Liquid First (so glass is on top)
  if (currentVol > 0) {
    const fillPercentage = Math.min(currentVol / maxVol, 1);
    const liquidHeight = usableHeight * fillPercentage;
    const liquidY = y + h - bottomPadding - liquidHeight;
    const [lr, lg, lb, la] = parseRgba(liquidColor);

    // Depth gradient
    const liqGrad = ctx.createLinearGradient(x, liquidY, x, y + h - bottomPadding);
    liqGrad.addColorStop(0, `rgba(${Math.min(255,lr+30)},${Math.min(255,lg+30)},${Math.min(255,lb+30)},${la*0.72})`);
    liqGrad.addColorStop(0.25, liquidColor);
    liqGrad.addColorStop(1, `rgba(${Math.max(0,lr-12)},${Math.max(0,lg-12)},${Math.max(0,lb-12)},${Math.min(1,la*1.18)})`);
    ctx.fillStyle = liqGrad;
    ctx.fillRect(x, liquidY, w, y + h - bottomPadding - liquidY);

    // Meniscus
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 1, liquidY + 2);
    ctx.quadraticCurveTo(x + w / 2, liquidY - 3, x + w - 1, liquidY + 2);
    ctx.stroke();

    // Surface shimmer
    ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
    ctx.beginPath();
    ctx.ellipse(x + w / 2, liquidY, (w - 4) / 2, 3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Base of the cylinder
  ctx.fillStyle = "rgba(180, 210, 240, 0.6)";
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h, w, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  // 3. Glass Body
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, "rgba(220, 240, 255, 0.4)");
  grad.addColorStop(0.5, "rgba(255, 255, 255, 0.2)");
  grad.addColorStop(1, "rgba(200, 230, 255, 0.5)");

  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);

  // 4. Dynamic Markings and Numbers
  // Layout: tick line from left wall, number follows immediately after the line end.
  ctx.strokeStyle = "rgba(255,255,255,0.70)";
  ctx.lineWidth = 1;
  ctx.font = "7px Arial";
  ctx.textAlign = "left";

  const step = 10;
  const numberOfMarks = maxVol / step;

  for (let i = 0; i <= numberOfMarks; i++) {
    const markVol = i * step;
    const markY   = y + h - bottomPadding - i * (usableHeight / numberOfMarks);

    // Tick: uniform length for all marks
    const isLabelled = markVol % 20 === 0;
    const tickLen = w * 0.26;
    ctx.beginPath();
    ctx.moveTo(x + 2, markY);
    ctx.lineTo(x + 2 + tickLen, markY);
    ctx.stroke();

    // Number: right after tick end, only at labelled marks
    if (isLabelled) {
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(`${markVol}`, x + 2 + tickLen + 2, markY + 2);
    }
  }

  // 5. Label "mL"
  ctx.fillStyle = "rgba(255,255,255,0.60)";
  ctx.font = "bold 6px Arial";
  ctx.fillText("mL", x + 5, y + 12);

  ctx.restore();
};

const drawBottle = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  maxVol: number,
  name: string,
  hasLid: boolean,
  currentVol: number,
  tiltAngle: number = 0,
  liquidColor: string = "rgba(56, 189, 248, 0.5)",
  lidColor: string = "#0ea5e9",
  isSolid: boolean = false,
) => {
  ctx.save();
  if (tiltAngle !== 0) {
    ctx.translate(x + w / 2, y);
    ctx.rotate(tiltAngle);
    ctx.translate(-(x + w / 2), -y);
  }
  const neckHeight = h * 0.2;
  const bodyHeight = h - neckHeight;
  const bodyY = y + neckHeight;
  const isWater = name.toLowerCase().includes("water");

  // 1. Content (liquid or solid)
  if (currentVol > 0) {
    const fillLevel = currentVol / maxVol;
    const fillH = bodyHeight * fillLevel;
    const fillY = bodyY + (bodyHeight - fillH);

    if (isSolid) {
      // Wax-like solid: creamy white base
      ctx.fillStyle = "rgba(255, 250, 240, 0.97)";
      ctx.beginPath();
      ctx.roundRect(x + 2, fillY, w - 4, fillH, [0, 0, 6, 6]);
      ctx.fill();

      // Wavy chunky surface to show it's a solid
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(x + 2, fillY, w - 4, fillH, [0, 0, 6, 6]);
      ctx.clip();

      // Horizontal wax layering lines
      ctx.strokeStyle = "rgba(220, 210, 195, 0.6)";
      ctx.lineWidth = 1;
      for (let ly = fillY + 4; ly < bodyY + bodyHeight - 4; ly += 7) {
        ctx.beginPath();
        ctx.moveTo(x + 4, ly);
        ctx.lineTo(x + w - 4, ly);
        ctx.stroke();
      }

      // Irregular chunks on top surface
      ctx.fillStyle = "rgba(240, 232, 218, 0.85)";
      for (let ci = 0; ci < 5; ci++) {
        const cx2 = x + 4 + ci * ((w - 8) / 5);
        const ch = 5 + (ci % 3) * 3;
        ctx.beginPath();
        ctx.roundRect(cx2, fillY, (w - 8) / 5 - 1, ch, 2);
        ctx.fill();
      }

      // Waxy sheen
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.beginPath();
      ctx.roundRect(x + 4, fillY, w * 0.3, fillH * 0.6, 2);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = liquidColor;
      ctx.beginPath();
      ctx.roundRect(x, fillY, w, fillH, [0, 0, 8, 8]);
      ctx.fill();
    }
  }

  // 2. Bottle Body
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.5;
  ctx.fillStyle = isWater ? "rgba(255,255,255,0.1)" : "rgba(248,250,252,0.18)";
  ctx.beginPath();
  ctx.roundRect(x, bodyY, w, bodyHeight, [0, 0, 8, 8]);
  ctx.fill();
  ctx.stroke();

  // 3. Neck & Cap
  if (hasLid) {
    ctx.fillStyle = lidColor;
    ctx.fillRect(x + w * 0.3, y, w * 0.4, neckHeight);
  }

  // 4. Label
  ctx.fillStyle = "white";
  ctx.fillRect(x + 5, bodyY + 10, w - 10, 25);
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name.split(" ")[0], x + w / 2, bodyY + 25);
  if (isSolid) {
    ctx.fillStyle = "#7c4a00";
    ctx.font = "6px Arial";
    ctx.fillText("SOLID", x + w / 2, bodyY + 34);
  }
  ctx.restore();
};

// ── Ingredient density map (g/mL) ──
const DENSITY: Record<string, number> = {
  water: 1.0,
  stearicAcid: 0.847,
  liquidParaffin: 0.88,
  glycerin: 1.261,
  koh: 1.1,
};

const calcBeakerWeight = (a: { data?: { composition?: Record<string,number>; solidStearicGrams?: number } }): number => {
  const comp = (a.data?.composition ?? {}) as Record<string, number>;
  let w = 0;
  for (const [k, v] of Object.entries(comp)) w += v * (DENSITY[k] ?? 1.0);
  w += a.data?.solidStearicGrams ?? 0;
  return Math.round(w * 10) / 10;
};

const drawSpatula = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  load: number = 0,
  pressingIntoSolid: boolean = false,
) => {
  ctx.save();

  // Tilt entire spatula when pressing into solid (whole instrument inclines ~18°)
  if (pressingIntoSolid) {
    const pivotX = x + w / 2;
    const pivotY = y + h * 0.35;           // pivot near upper third of handle
    ctx.translate(pivotX, pivotY);
    ctx.rotate(0.32);                       // ~18° clockwise — leaning into solid
    ctx.translate(-pivotX, -pivotY);
  }

  const cx = x + w / 2;

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;

  // Handle — stainless steel rod
  const handleW = Math.max(w * 0.30, 3.5);
  const bladeH  = h * 0.22;
  const handleH = h - bladeH;
  const handleGrad = ctx.createLinearGradient(cx - handleW, 0, cx + handleW, 0);
  handleGrad.addColorStop(0,   "rgba(160, 175, 190, 0.70)");
  handleGrad.addColorStop(0.3, "rgba(230, 240, 248, 0.55)");
  handleGrad.addColorStop(0.7, "rgba(210, 225, 238, 0.30)");
  handleGrad.addColorStop(1,   "rgba(145, 165, 182, 0.72)");
  ctx.fillStyle = handleGrad;
  ctx.strokeStyle = "rgba(200, 215, 230, 0.88)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(cx - handleW / 2, y, handleW, handleH, 2);
  ctx.fill();
  ctx.stroke();

  // Inner reflection
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.beginPath();
  ctx.roundRect(cx - handleW / 2 + 1, y + 6, handleW * 0.28, handleH - 12, 1);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;

  // Blade — wider flat rectangle (drawn inside the bend transform below)
  const bladeW = w * 0.90;
  const bladeY = y + handleH - 2;
  const bladeGrad = ctx.createLinearGradient(cx - bladeW / 2, 0, cx + bladeW / 2, 0);
  bladeGrad.addColorStop(0,   "rgba(160, 175, 190, 0.80)");
  bladeGrad.addColorStop(0.5, "rgba(235, 245, 252, 0.60)");
  bladeGrad.addColorStop(1,   "rgba(150, 168, 185, 0.82)");

  // ── Blade always drawn flat (whole-body tilt handles scooping motion) ───
  ctx.save();

  // Blade body (drawn relative to pivot)
  ctx.fillStyle = bladeGrad;
  ctx.strokeStyle = "rgba(200, 215, 230, 0.88)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(cx - bladeW / 2, bladeY, bladeW, bladeH, [0, 0, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // Wax load on blade when carrying solid
  if (load > 0) {
    const loadAlpha = Math.min(load / 20, 1);
    // Mound of wax sitting on top of the blade
    ctx.fillStyle = `rgba(255, 250, 240, ${0.85 + loadAlpha * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(cx, bladeY + bladeH * 0.35, bladeW * 0.42 * loadAlpha + bladeW * 0.18,
      bladeH * 0.55 * loadAlpha + bladeH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Surface texture — small bumps to look like powdery wax
    ctx.fillStyle = "rgba(240, 228, 210, 0.72)";
    for (let i = 0; i < 4; i++) {
      const bx = cx + (i - 1.5) * (bladeW * 0.12);
      const by = bladeY + bladeH * 0.28;
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.2, 1.2, i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();   // end blade transform

  ctx.restore();   // end overall spatula transform
};

const drawWeightBalance = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  weightReading: number = 0,
  hasItem: boolean = false,
) => {
  ctx.save();

  const baseH    = h * 0.40;
  const platformH = 8;
  const platformY = y + h - baseH - platformH;
  const baseY    = y + h - baseH;

  // Body shadow
  ctx.shadowColor = "rgba(0,0,0,0.30)";
  ctx.shadowBlur  = 10;
  ctx.shadowOffsetY = 4;

  // Base body
  const baseGrad = ctx.createLinearGradient(x, baseY, x + w, baseY);
  baseGrad.addColorStop(0,   "#c8d4e0");
  baseGrad.addColorStop(0.5, "#e8f0f8");
  baseGrad.addColorStop(1,   "#b8c8d8");
  ctx.fillStyle = baseGrad;
  ctx.beginPath();
  ctx.roundRect(x, baseY, w, baseH, [0, 0, 6, 6]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // LCD display panel
  const dispM  = 6;
  const dispH  = baseH * 0.62;
  const dispW  = w - dispM * 2;
  const dispX  = x + dispM;
  const dispY2 = baseY + (baseH - dispH) / 2;
  ctx.fillStyle = "#060e14";
  ctx.beginPath();
  ctx.roundRect(dispX, dispY2, dispW, dispH, 4);
  ctx.fill();

  // Display content
  ctx.textAlign = "center";
  const dispCX = dispX + dispW / 2;

  // "g" unit top-right
  ctx.fillStyle = "rgba(0,230,118,0.55)";
  ctx.font = `${Math.floor(dispH * 0.20)}px monospace`;
  ctx.fillText("g", dispX + dispW * 0.88, dispY2 + dispH * 0.32);

  // Weight value
  const weightStr = weightReading.toFixed(2);
  ctx.fillStyle = hasItem ? "#00e676" : "#2d6a4f";
  ctx.font = `bold ${Math.floor(dispH * 0.42)}px monospace`;
  ctx.fillText(weightStr, dispCX - 4, dispY2 + dispH * 0.66);

  // "NET WT" label
  ctx.fillStyle = "rgba(0,230,118,0.40)";
  ctx.font = `${Math.floor(dispH * 0.16)}px Arial`;
  ctx.fillText("NET WT", dispCX, dispY2 + dispH * 0.88);

  // TARE button
  const btnW = 22; const btnH = 10;
  const btnX = x + w - btnW - 6; const btnY = baseY + baseH - btnH - 5;
  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 3);
  ctx.fill();
  ctx.fillStyle = "#9ca3af";
  ctx.font = "5px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TARE", btnX + btnW / 2, btnY + 7);

  // ON indicator dot
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  ctx.arc(x + 10, baseY + 10, 3.5, 0, Math.PI * 2);
  ctx.fill();

  // Weighing platform
  const platGrad = ctx.createLinearGradient(x, platformY, x, platformY + platformH);
  platGrad.addColorStop(0, "#e2ecf5");
  platGrad.addColorStop(1, "#c5d6e8");
  ctx.fillStyle = platGrad;
  ctx.strokeStyle = "rgba(180,200,220,0.7)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x + 8, platformY, w - 16, platformH, [3, 3, 0, 0]);
  ctx.fill();
  ctx.stroke();

  // Shimmer on platform
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.beginPath();
  ctx.roundRect(x + 10, platformY + 1, (w - 20) * 0.45, 3, 1);
  ctx.fill();

  ctx.restore();
};

const drawHotPlate = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isOn: boolean = false,
  temperature: number = 25,
  targetTemperature: number = 200,
  frame: number = 0,
) => {
  ctx.save();

  const topH = h * 0.42;
  const frontH = h - topH;
  const frontY = y + topH;

  // ── Heat shimmer waves above the plate when hot ──
  if (isOn && temperature > 50) {
    const intensity = Math.min((temperature - 50) / 150, 1);
    for (let wi = 0; wi < 3; wi++) {
      const baseY = y - 6 - wi * 7 - ((frame * 0.5 + wi * 8) % 16);
      ctx.strokeStyle = `rgba(255, 180, 80, ${(0.14 - wi * 0.04) * intensity})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let px = 0; px <= w - 16; px += 3) {
        const wx = x + 8 + px;
        const wy = baseY + Math.sin(px / 10 + frame * 0.12 + wi * 2.1) * 2.8;
        if (px === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
    }
  }

  // ── Body shadow ──
  ctx.shadowColor = "rgba(0,0,0,0.50)";
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;

  // Front panel — white lab-grade body
  const frontGrad = ctx.createLinearGradient(x, frontY, x + w, frontY);
  frontGrad.addColorStop(0, "#d8e1ed");
  frontGrad.addColorStop(0.5, "#f0f4f8");
  frontGrad.addColorStop(1, "#c4cfde");
  ctx.fillStyle = frontGrad;
  ctx.beginPath();
  ctx.roundRect(x, frontY, w, frontH, [0, 0, 7, 7]);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // ── Heating plate surface ──
  const plateGrad = ctx.createLinearGradient(x, y, x, frontY);
  if (isOn) {
    const heatRatio = Math.min((temperature - 25) / Math.max(targetTemperature - 25, 1), 1);
    const r = Math.floor(145 + 110 * heatRatio);
    const g = Math.floor(55 - 45 * heatRatio);
    const b = Math.floor(30 - 25 * heatRatio);
    plateGrad.addColorStop(0, `rgb(${r}, ${g + 40}, ${b + 30})`);
    plateGrad.addColorStop(0.6, `rgb(${r}, ${g}, ${b})`);
    plateGrad.addColorStop(1, `rgb(${Math.floor(r * 0.80)}, ${g}, ${b})`);
  } else {
    plateGrad.addColorStop(0, "#8898aa");
    plateGrad.addColorStop(0.5, "#5e7082");
    plateGrad.addColorStop(1, "#3d5060");
  }
  ctx.fillStyle = plateGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, topH, [7, 7, 0, 0]);
  ctx.fill();

  // Heating coil rings
  const plateCX = x + w / 2;
  const plateCY = y + topH / 2;
  const maxR = Math.min(w * 0.34, topH * 0.70);
  for (let i = 3; i >= 1; i--) {
    const r = maxR * (i / 3);
    ctx.strokeStyle = isOn
      ? `rgba(255, ${Math.floor(55 + 75 * (i / 3))}, 0, ${0.28 + 0.38 * (i / 3)})`
      : `rgba(48, 62, 78, ${0.16 + 0.14 * (i / 3)})`;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(plateCX, plateCY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Pulsing radial glow when on
  if (isOn) {
    const heatRatio = Math.min((temperature - 25) / Math.max(targetTemperature - 25, 1), 1);
    const glowR = maxR * 1.4;
    const pulse = 0.09 + 0.07 * Math.sin(frame * 0.18);
    const glow = ctx.createRadialGradient(plateCX, plateCY, 0, plateCX, plateCY, glowR);
    glow.addColorStop(0, `rgba(255, 110, 0, ${0.2 + 0.55 * heatRatio + pulse})`);
    glow.addColorStop(0.55, `rgba(255, 35, 0, ${(0.12 + 0.38 * heatRatio) * 0.55})`);
    glow.addColorStop(1, "rgba(180, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(plateCX, plateCY, glowR, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Front control panel ──

  // Power button — prominent circle with ⏻ symbol
  const btnR = Math.min(frontH * 0.34, 12);
  const btnCX = x + btnR + 5;
  const btnCY = frontY + frontH / 2;

  // Button housing
  ctx.fillStyle = isOn ? "#0f172a" : "#1e293b";
  ctx.strokeStyle = isOn ? "#22c55e" : "#6b7280";
  ctx.lineWidth = isOn ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(btnCX, btnCY, btnR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Pulsing halo when on
  if (isOn) {
    const halo = 0.22 + 0.16 * Math.sin(frame * 0.14);
    ctx.strokeStyle = `rgba(34, 197, 94, ${halo})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(btnCX, btnCY, btnR + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Power symbol: open arc + vertical stem
  const symR = btnR * 0.54;
  ctx.strokeStyle = isOn ? "#22c55e" : "#9ca3af";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  // Arc: clockwise from ~1-o'clock position all the way to ~11-o'clock (leaving gap at 12)
  ctx.beginPath();
  ctx.arc(btnCX, btnCY, symR, Math.PI * 1.72, Math.PI * 1.28, false);
  ctx.stroke();
  // Vertical stem through the gap
  ctx.beginPath();
  ctx.moveTo(btnCX, btnCY - symR * 0.28);
  ctx.lineTo(btnCX, btnCY - symR * 1.08);
  ctx.stroke();
  ctx.lineCap = "butt";

  // "ON" / "OFF" micro-label under button
  ctx.fillStyle = isOn ? "#22c55e" : "#6b7280";
  ctx.font = `bold 5px Arial`;
  ctx.textAlign = "center";
  ctx.fillText(isOn ? "ON" : "OFF", btnCX, frontY + frontH - 3);

  // ── LCD display (shows SET temperature) ──
  const dispX = btnCX + btnR + 5;
  const dispW = w - (dispX - x) - (w * 0.2) - 3;
  const dispH = frontH * 0.75;
  const dispY = frontY + (frontH - dispH) / 2;

  // Display bezel
  ctx.fillStyle = "#080c14";
  ctx.beginPath();
  ctx.roundRect(dispX, dispY, dispW, dispH, 4);
  ctx.fill();

  // Red border glow when on
  if (isOn) {
    ctx.strokeStyle = `rgba(255, 59, 48, ${0.45 + 0.2 * Math.sin(frame * 0.08)})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(dispX, dispY, dispW, dispH, 4);
    ctx.stroke();
  }

  // "SET" label — only shown when on
  ctx.font = `bold ${Math.floor(dispH * 0.22)}px Arial`;
  ctx.textAlign = "center";
  if (isOn) {
    ctx.fillStyle = "rgba(255, 80, 60, 0.7)";
    ctx.fillText("SET", dispX + dispW / 2, dispY + dispH * 0.24);
  }

  // ON  → show SET target temperature in bright red
  // OFF → show ambient 25 °C in gray (plate has returned to default)
  ctx.fillStyle = isOn ? "#ff2d20" : "#374151";
  ctx.font = `bold ${Math.floor(dispH * 0.52)}px monospace`;
  ctx.fillText(
    `${Math.round(isOn ? targetTemperature : temperature)}`,
    dispX + dispW * 0.46,
    dispY + dispH * 0.64,
  );

  // "°C" unit (smaller, top-right of number)
  ctx.font = `bold ${Math.floor(dispH * 0.26)}px monospace`;
  ctx.fillStyle = isOn ? "rgba(255, 90, 70, 0.85)" : "#4b5563";
  ctx.fillText("°C", dispX + dispW * 0.86, dispY + dispH * 0.48);

  // Actual temperature shown at bottom when heating
  if (isOn) {
    ctx.font = `${Math.floor(dispH * 0.20)}px monospace`;
    ctx.fillStyle = `rgba(255, 190, 80, ${0.7 + 0.2 * Math.sin(frame * 0.1)})`;
    ctx.fillText(`ACT: ${Math.round(temperature)}°C`, dispX + dispW / 2, dispY + dispH * 0.88);
  }

  // ── Temperature control knob (right) ──
  const knobCX = x + w - btnR - 5;
  const knobCY = frontY + frontH / 2;
  const knobR = frontH * 0.3;

  ctx.fillStyle = "#374151";
  ctx.beginPath();
  ctx.arc(knobCX, knobCY, knobR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isOn ? "#f97316" : "#6B7280";
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = "#4a5568";
  ctx.beginPath();
  ctx.arc(knobCX, knobCY, knobR * 0.68, 0, Math.PI * 2);
  ctx.fill();

  // Knob indicator line — rotates based on SET temperature
  const knobAngle = -Math.PI * 0.85 + ((targetTemperature - 25) / 475) * Math.PI * 1.7;
  ctx.strokeStyle = isOn ? "#fb923c" : "#d1d5db";
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(knobCX, knobCY);
  ctx.lineTo(
    knobCX + Math.cos(knobAngle) * knobR * 0.6,
    knobCY + Math.sin(knobAngle) * knobR * 0.6,
  );
  ctx.stroke();
  ctx.lineCap = "butt";

  // Knob label
  ctx.fillStyle = "#4a5568";
  ctx.font = "bold 5px Arial";
  ctx.textAlign = "center";
  ctx.fillText("TEMP", knobCX, frontY + frontH - 3);

  ctx.restore();
};

const drawThermometer = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  readingTemperature: number = 25,
  isMeasuring: boolean = false,
) => {
  ctx.save();

  const probeStartY = y;
  const probeH = h - 10;
  const probeW = Math.max(w * 0.32, 7);
  const probeCX = x + w / 2;
  const bulbR = probeW * 0.95;

  // Glass probe tube
  const probeGrad = ctx.createLinearGradient(probeCX - probeW / 2, 0, probeCX + probeW / 2, 0);
  probeGrad.addColorStop(0, "rgba(185, 218, 252, 0.58)");
  probeGrad.addColorStop(0.35, "rgba(245, 252, 255, 0.16)");
  probeGrad.addColorStop(1, "rgba(165, 205, 238, 0.65)");
  ctx.fillStyle = probeGrad;
  ctx.strokeStyle = "rgba(195, 222, 248, 0.88)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(probeCX - probeW / 2, probeStartY, probeW, probeH, 2);
  ctx.fill();
  ctx.stroke();

  // Fluid column — scale covers 0°C → 300°C; colour shifts blue→orange→red→bright red
  const tempFrac = Math.min(Math.max(readingTemperature, 0) / 300, 1);
  const colH = (probeH - 10) * tempFrac;
  const colY = probeStartY + probeH - 10 - colH;
  const fluidColor =
    readingTemperature > 120
      ? `rgba(255, 0, 0, 0.92)`
      : readingTemperature > 75
      ? `rgba(255, ${Math.floor(Math.max(0, 80 - 80 * Math.min((readingTemperature - 75) / 45, 1)))}, 0, 0.90)`
      : readingTemperature > 40
      ? `rgba(255, ${Math.floor(160 + 40 * Math.min((readingTemperature - 40) / 35, 1))}, 0, 0.84)`
      : "rgba(30, 120, 255, 0.78)";

  if (colH > 0) {
    ctx.fillStyle = fluidColor;
    ctx.beginPath();
    ctx.roundRect(probeCX - probeW / 2 + 2, colY, probeW - 4, colH + 5, 1);
    ctx.fill();
  }

  // Bulb at tip
  ctx.fillStyle = fluidColor;
  ctx.shadowColor = "rgba(0,0,0,0.20)";
  ctx.shadowBlur = 4;
  ctx.beginPath();
  ctx.arc(probeCX, probeStartY + probeH + bulbR * 0.45, bulbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(195, 222, 248, 0.88)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tick marks on probe
  ctx.strokeStyle = "rgba(195, 218, 245, 0.48)";
  ctx.lineWidth = 0.8;
  for (let i = 1; i <= 5; i++) {
    const tickY = probeStartY + 4 + i * ((probeH - 8) / 6);
    const tickLen = i % 2 === 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(probeCX + probeW / 2, tickY);
    ctx.lineTo(probeCX + probeW / 2 + tickLen, tickY);
    ctx.stroke();
  }

  ctx.restore();
};

const drawStirringRod = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  isStirring: boolean = false,
  frame: number = 0,
) => {
  ctx.save();

  const rodW = Math.max(w * 0.42, 5);
  const rodCX = x + w / 2;

  // Oscillate when stirring
  if (isStirring) {
    const tilt = Math.sin(frame * 0.24) * 0.13;
    ctx.translate(rodCX, y + h * 0.45);
    ctx.rotate(tilt);
    ctx.translate(-rodCX, -(y + h * 0.45));
  }

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetX = 1;

  // Glass rod body
  const rodGrad = ctx.createLinearGradient(rodCX - rodW, y, rodCX + rodW, y);
  rodGrad.addColorStop(0, "rgba(172, 208, 244, 0.62)");
  rodGrad.addColorStop(0.28, "rgba(245, 252, 255, 0.20)");
  rodGrad.addColorStop(0.72, "rgba(222, 240, 255, 0.16)");
  rodGrad.addColorStop(1, "rgba(152, 198, 235, 0.68)");
  ctx.fillStyle = rodGrad;
  ctx.strokeStyle = "rgba(198, 226, 252, 0.92)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(rodCX - rodW / 2, y, rodW, h, 3);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;

  // Inner light reflection stripe
  ctx.fillStyle = "rgba(255, 255, 255, 0.26)";
  ctx.beginPath();
  ctx.roundRect(rodCX - rodW / 2 + 1, y + 6, rodW * 0.28, h - 12, 1);
  ctx.fill();

  // Top cap
  ctx.fillStyle = "rgba(215, 236, 255, 0.72)";
  ctx.beginPath();
  ctx.ellipse(rodCX, y + 2, rodW * 0.62, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bottom rounded tip
  ctx.fillStyle = "rgba(198, 226, 252, 0.78)";
  ctx.beginPath();
  ctx.ellipse(rodCX, y + h - 2, rodW * 0.62, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

const drawPhMeter = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  phReading: number = 7.0,
) => {
  ctx.save();

  const probeStartY = y;
  const probeH = h - 12;
  const probeW = Math.max(w * 0.26, 6);
  const probeCX = x + w / 2;
  const bulbR = probeW * 1.0;

  // pH-based colour: red (acid) → yellow → green (neutral) → blue (alkaline)
  const phColor =
    phReading < 4
      ? `rgba(255, 40, 20, 0.92)`
      : phReading < 6
      ? `rgba(255, ${Math.floor(40 + ((phReading - 4) / 2) * 170)}, 0, 0.90)`
      : phReading < 8
      ? `rgba(0, 200, 80, 0.92)`
      : phReading < 11
      ? `rgba(30, ${Math.floor(160 - ((phReading - 8) / 3) * 60)}, 255, 0.90)`
      : `rgba(100, 0, 220, 0.92)`;

  // Glass probe tube
  const probeGrad = ctx.createLinearGradient(probeCX - probeW / 2, 0, probeCX + probeW / 2, 0);
  probeGrad.addColorStop(0, "rgba(185, 218, 252, 0.58)");
  probeGrad.addColorStop(0.4, "rgba(245, 252, 255, 0.14)");
  probeGrad.addColorStop(1, "rgba(165, 205, 238, 0.65)");
  ctx.fillStyle = probeGrad;
  ctx.strokeStyle = "rgba(195, 222, 248, 0.88)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(probeCX - probeW / 2, probeStartY, probeW, probeH, 2);
  ctx.fill();
  ctx.stroke();

  // Reference electrode band (mid-probe, slightly wider)
  ctx.fillStyle = "rgba(190, 190, 210, 0.38)";
  ctx.strokeStyle = "rgba(195, 222, 248, 0.5)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(probeCX - probeW * 0.72, probeStartY + probeH * 0.32, probeW * 1.44, probeH * 0.28, 2);
  ctx.fill();
  ctx.stroke();

  // Inner reflection stripe
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.beginPath();
  ctx.roundRect(probeCX - probeW / 2 + 1, probeStartY + 4, probeW * 0.30, probeH - 8, 1);
  ctx.fill();

  // Sensitive bulb at tip
  ctx.fillStyle = phColor;
  ctx.beginPath();
  ctx.arc(probeCX, probeStartY + probeH + bulbR * 0.5, bulbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(195, 222, 248, 0.88)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Tick marks
  ctx.strokeStyle = "rgba(195, 218, 245, 0.40)";
  ctx.lineWidth = 0.7;
  for (let i = 1; i <= 5; i++) {
    const tickY = probeStartY + 4 + i * ((probeH - 8) / 6);
    const tl = i % 2 === 0 ? 4 : 2.5;
    ctx.beginPath();
    ctx.moveTo(probeCX + probeW / 2, tickY);
    ctx.lineTo(probeCX + probeW / 2 + tl, tickY);
    ctx.stroke();
  }

  ctx.restore();
};

const drawViscosityGauge = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  viscosityReading: number = 0,
  isActive: boolean = false,
  frame: number = 0,
) => {
  ctx.save();

  const bodyH = h * 0.60;
  const probeH = h - bodyH;
  const probeCX = x + w / 2;
  const spindleW = 5;

  // Body shadow
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  bodyGrad.addColorStop(0, "#cdd8e8");
  bodyGrad.addColorStop(0.5, "#eaf0f8");
  bodyGrad.addColorStop(1, "#bac8d8");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, bodyH, 8);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // LCD panel
  const dm = 4;
  const lcdH = bodyH * 0.44;
  const lcdY = y + dm;
  ctx.fillStyle = "#060e14";
  ctx.beginPath();
  ctx.roundRect(x + dm, lcdY, w - dm * 2, lcdH, 3);
  ctx.fill();

  const accentColor = isActive ? "#00e676" : "#4caf50";

  // Numeric reading
  const visStr =
    viscosityReading < 10
      ? viscosityReading.toFixed(1)
      : Math.round(viscosityReading).toString();
  ctx.font = `bold ${Math.floor(lcdH * 0.40)}px monospace`;
  ctx.fillStyle = accentColor;
  ctx.fillText(visStr, probeCX - 4, lcdY + lcdH * 0.62);

  // "cP" unit
  ctx.font = `${Math.floor(lcdH * 0.20)}px monospace`;
  ctx.fillStyle = `rgba(0, 230, 118, 0.58)`;
  ctx.fillText("cP", x + w * 0.84, lcdY + lcdH * 0.40);


  // Circular dial gauge
  const dialY = lcdY + lcdH + 4;
  const dialAvail = bodyH - lcdH - dm * 2 - 4;
  const dialR = Math.min(dialAvail * 0.46, w * 0.30);
  const dialCX = probeCX;
  const dialCY = dialY + dialAvail / 2;
  const startAngle = Math.PI * 0.75;
  const endAngle   = Math.PI * 2.25;

  // Background arc
  ctx.strokeStyle = "rgba(180, 200, 220, 0.35)";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(dialCX, dialCY, dialR, startAngle, endAngle);
  ctx.stroke();

  // Filled arc — logarithmic scale (1–3000 cP)
  const logMax = Math.log10(3000);
  const logVal = Math.log10(Math.max(viscosityReading, 1));
  const fillEnd = startAngle + (logVal / logMax) * (endAngle - startAngle);
  const dialColor =
    viscosityReading > 1000 ? "#ff5722" :
    viscosityReading > 200  ? "#ff9800" : "#4caf50";
  ctx.strokeStyle = dialColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(dialCX, dialCY, dialR, startAngle, fillEnd);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Needle
  ctx.strokeStyle = "white";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(dialCX, dialCY);
  ctx.lineTo(
    dialCX + Math.cos(fillEnd) * dialR * 0.82,
    dialCY + Math.sin(fillEnd) * dialR * 0.82,
  );
  ctx.stroke();
  ctx.lineCap = "butt";
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.arc(dialCX, dialCY, 2.5, 0, Math.PI * 2);
  ctx.fill();


  // Spindle shaft
  const spindleY = y + bodyH;
  const spindleGrad = ctx.createLinearGradient(probeCX - spindleW, 0, probeCX + spindleW, 0);
  spindleGrad.addColorStop(0, "rgba(180, 210, 240, 0.7)");
  spindleGrad.addColorStop(0.5, "rgba(245, 252, 255, 0.28)");
  spindleGrad.addColorStop(1, "rgba(160, 200, 235, 0.75)");
  ctx.fillStyle = spindleGrad;
  ctx.strokeStyle = "rgba(195, 222, 248, 0.85)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(probeCX - spindleW / 2, spindleY, spindleW, probeH * 0.68, 1);
  ctx.fill();
  ctx.stroke();

  // Spindle disc — rotates when active
  const discR = spindleW * 2.8;
  const discCY = spindleY + probeH * 0.68;
  ctx.save();
  if (isActive) {
    ctx.translate(probeCX, discCY);
    ctx.rotate(frame * 0.18);
    ctx.translate(-probeCX, -discCY);
  }
  ctx.fillStyle = "rgba(180, 210, 245, 0.82)";
  ctx.strokeStyle = "rgba(195, 222, 248, 0.88)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(probeCX, discCY, discR, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Disc vanes
  ctx.strokeStyle = "rgba(225, 240, 255, 0.55)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + (isActive ? frame * 0.18 : 0);
    ctx.beginPath();
    ctx.moveTo(probeCX, discCY);
    ctx.lineTo(probeCX + Math.cos(a) * discR * 0.85, discCY + Math.sin(a) * 2.5);
    ctx.stroke();
  }
  ctx.restore();

  ctx.restore();
};

const drawIceBucket = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  iceLevel: number = 100,
) => {
  ctx.save();

  const topW    = w;
  const botW    = w * 0.74;
  const botX    = x + (w - botW) / 2;

  // Shadow
  ctx.shadowColor  = "rgba(0,0,0,0.35)";
  ctx.shadowBlur   = 14;
  ctx.shadowOffsetY = 6;

  // Bucket body (trapezoid)
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  bodyGrad.addColorStop(0,   "#b0c4d8");
  bodyGrad.addColorStop(0.45, "#dde9f5");
  bodyGrad.addColorStop(1,   "#8fa8be");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + topW, y);
  ctx.lineTo(botX + botW, y + h);
  ctx.lineTo(botX, y + h);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Ice and water contents
  if (iceLevel > 0) {
    const fillH  = (h - 18) * 0.85 * (iceLevel / 100);
    const fillY  = y + h - 10 - fillH;
    const prog   = (y + h - 10 - fillY) / (h - 18); // 0..1 fill ratio
    const lW     = topW - 2 * prog * (topW - botW) / 2;
    const lX     = x + (topW - lW) / 2;

    ctx.save();
    // Clip to inside the bucket
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + topW - 3, y + 3);
    ctx.lineTo(botX + botW - 3, y + h - 3);
    ctx.lineTo(botX + 3, y + h - 3);
    ctx.closePath();
    ctx.clip();

    // Cold water layer at bottom
    ctx.fillStyle = "rgba(186, 230, 253, 0.55)";
    ctx.fillRect(lX, fillY + fillH * 0.65, lW, fillH * 0.38);

    // Ice chunks
    const cols   = 4;
    const rows   = Math.max(1, Math.ceil(iceLevel / 30));
    const cW2    = lW / cols - 4;
    const cH2    = fillH / (rows + 1) * 0.55;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ix = lX + 2 + c * (lW / cols) + (r % 2 === 0 ? 3 : 0);
        const iy = fillY + 4 + r * (fillH / rows);
        ctx.fillStyle = `rgba(224, 242, 254, ${0.80 + (c % 2) * 0.12})`;
        ctx.beginPath();
        ctx.roundRect(ix, iy, cW2, cH2, 3);
        ctx.fill();
        // Shine on each cube
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.roundRect(ix + 2, iy + 2, cW2 * 0.38, cH2 * 0.32, 1);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // Rim (top edge)
  ctx.strokeStyle = "rgba(148, 163, 184, 0.95)";
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + topW, y);
  ctx.stroke();

  // Side outline
  ctx.strokeStyle = "rgba(148, 163, 184, 0.50)";
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(botX, y + h);
  ctx.moveTo(x + topW, y);
  ctx.lineTo(botX + botW, y + h);
  ctx.stroke();

  // Handle arcs
  ctx.strokeStyle = "rgba(148, 163, 184, 0.70)";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.arc(x + w * 0.22, y - 4, 8, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + w * 0.78, y - 4, 8, Math.PI, 0);
  ctx.stroke();

  // "ICE BUCKET" label
  ctx.fillStyle   = "#334155";
  ctx.font        = "bold 9px Arial";
  ctx.textAlign   = "center";
  ctx.fillText("ICE BUCKET", x + w / 2, y + 13);

  // 0°C badge
  ctx.fillStyle   = "#0ea5e9";
  ctx.font        = "bold 8px Arial";
  ctx.fillText("0 °C", x + w / 2, y + h - 5);

  ctx.restore();
};

// ── Step alert types ──────────────────────────────────────────────────────────
interface StepNotif {
  id: number;
  message: string;
  detail?: string;
  type: "success" | "warning" | "error" | "info";
}

const NOTIF_STYLE: Record<StepNotif["type"], { bg: string; border: string; icon: string; color: string }> = {
  success: { bg: "rgba(5,46,22,0.97)",  border: "#16a34a", icon: "✓", color: "#4ade80" },
  warning: { bg: "rgba(28,18,0,0.97)",  border: "#ca8a04", icon: "⚠", color: "#fbbf24" },
  error:   { bg: "rgba(45,10,10,0.97)", border: "#dc2626", icon: "✗", color: "#f87171" },
  info:    { bg: "rgba(7,20,40,0.97)",  border: "#3b82f6", icon: "ℹ", color: "#60a5fa" },
};

const StepAlerts: React.FC<{ items: StepNotif[] }> = ({ items }) => {
  if (!items.length) return null;
  return (
    <div style={{
      position: "absolute", top: 70, left: "50%", transform: "translateX(-50%)",
      zIndex: 150, display: "flex", flexDirection: "column", gap: 7,
      width: "min(500px, 92vw)", pointerEvents: "none",
    }}>
      {items.map((n) => {
        const s = NOTIF_STYLE[n.type];
        return (
          <div key={n.id} style={{
            background: s.bg, border: `1.5px solid ${s.border}`,
            borderRadius: 10, padding: "10px 14px",
            display: "flex", alignItems: "flex-start", gap: 10,
            boxShadow: `0 4px 20px rgba(0,0,0,0.55), 0 0 0 1px ${s.border}22`,
          }}>
            <span style={{
              flexShrink: 0, width: 24, height: 24, borderRadius: "50%",
              background: `${s.border}33`, border: `1.5px solid ${s.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: s.color, fontSize: 13, fontWeight: 800,
            }}>{s.icon}</span>
            <div>
              <div style={{ color: s.color, fontWeight: 700, fontSize: 13 }}>{n.message}</div>
              {n.detail && <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{n.detail}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface InteractiveLabCanvasProps {
  currentStep: SimulationStep;
  onApparatusClick?: (apparatus: Apparatus) => void;
  practicalId?: string;
  assignment?: Assignment | null;
  labExpired?: boolean;
}

const InteractiveLabCanvas: React.FC<InteractiveLabCanvasProps> = ({
  currentStep,
  onApparatusClick,
  practicalId = "vanishing-cream",
  assignment = null,
  labExpired = false,
}) => {
  const isColdCream = practicalId === "cold-cream";

  // Multiplier = 1 for self-practice (base recipe), or scaled for assignment mode
  const multiplier = assignment
    ? +(assignment.targetGrams / BASE_RECIPES[assignment.practicalId].totalGrams).toFixed(4)
    : 1;
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const holdStirRef   = useRef<{ rodId: string; targetId: string } | null>(null);
  const draggingRef   = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const prevAppRef    = useRef<Apparatus[]>([]);
  const notifIdRef    = useRef(0);
  const milestoneRef  = useRef<Set<string>>(new Set()); // prevents duplicate one-shot alerts

  // ── Undo history ──────────────────────────────────────────────────────────
  const historyRef  = useRef<Apparatus[][]>([]);  // snapshots stack, newest at end
  const MAX_HISTORY = 25;

  const [notifications, setNotifications] = useState<StepNotif[]>([]);

  const addNotif = useCallback((message: string, type: StepNotif["type"], detail?: string) => {
    const id = ++notifIdRef.current;
    setNotifications((prev) => [{ id, message, type, detail }, ...prev].slice(0, 4));
    setTimeout(() => setNotifications((prev) => prev.filter((n) => n.id !== id)), 5000);
  }, []);

  // Snapshot target beaker composition when a pour starts, so we can diff at pour-end
  const pourStartRef = useRef<Record<string, Record<string, number>>>({});
  const [selectedApparatus, setSelectedApparatus] = useState<Apparatus | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [moveMenu, setMoveMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showProtocolSidebar, setShowProtocolSidebar] = useState(false);
  const [dragging, setDragging] = useState<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  // High-resolution canvas dimensions to cover full screen
  const [canvasSize, setCanvasSize] = useState({ width: 1600, height: 800 });

  // PERSPECTIVE & LAYOUT CONSTANTS
  const NAV_BAR_HEIGHT = 60;
  const TABLE_Y = 550; // Table surface level
  const LIP_HEIGHT = 18;
  const CABINET_WIDTH = 260;
  const LEFT_GAP = 25; // Small space on left side
  const SIDE_DEPTH = 22; // Angle on the right side

  // Dynamic calculation for 3/4 width
  const tableTotalWidth = canvasSize.width * 0.75;
  const benchHeight = canvasSize.height - (TABLE_Y + LIP_HEIGHT); // Reaches bottom
  const shelfY = 220;

  const [apparatus, setApparatus] = useState<Apparatus[]>(() =>
    isColdCream
      ? getInitialApparatusColdCream(LEFT_GAP, shelfY, TABLE_Y)
      : getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y),
  );

  // latestApparatusRef mirrors apparatus without using setApparatus as a snapshot vehicle
  const latestApparatusRef = useRef<Apparatus[]>(apparatus);
  useEffect(() => { latestApparatusRef.current = apparatus; }, [apparatus]);

  // Snapshot before each action; undo pops back to the last snapshot
  const pushHistory = useCallback(() => {
    historyRef.current = [
      ...historyRef.current,
      latestApparatusRef.current.map(a => ({ ...a, data: a.data ? { ...a.data } : a.data })),
    ].slice(-MAX_HISTORY);
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setApparatus(prev);
  }, []);

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showEvaluationPanel, setShowEvaluationPanel] = useState(false);
  const [selectedPourAmount, setSelectedPourAmount] = useState(0);
  const [showPourModal, setShowPourModal] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [isAnimatingPour, setIsAnimatingPour] = useState(false);
  const [showLidModal, setShowLidModal] = useState<{ id: string } | null>(null);
  const [lidContextMenu, setLidContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showHotPlateModal, setShowHotPlateModal] = useState(false);
  const [hotPlateFrame, setHotPlateFrame] = useState(0);
  const [showScoopModal, setShowScoopModal] = useState<{ spatulaId: string; sourceId: string; maxGrams: number } | null>(null);
  const [selectedScoopGrams, setSelectedScoopGrams] = useState(5);

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

      // 3. STORAGE SHELF — extend to cover every item resting on it
      const shelfRightEdge = apparatus.reduce((maxX, a) => {
        const onShelf = Math.abs((a.y + a.height) - shelfY) < 30;
        return onShelf ? Math.max(maxX, a.x + a.width + 20) : maxX;
      }, tableTotalWidth + LEFT_GAP);
      const shelfDrawWidth = shelfRightEdge - LEFT_GAP;
      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      ctx.fillRect(LEFT_GAP, shelfY, shelfDrawWidth, 6);

      // 4. DRAW TABLE
      const drawCabinet = (x: number, isRight: boolean) => {
        ctx.fillStyle = TABLE_FRONT_COLOR;
        ctx.fillRect(x, TABLE_Y + LIP_HEIGHT, CABINET_WIDTH, benchHeight);

        if (isRight) {
          ctx.fillStyle = CABINET_SIDE_COLOR;
          ctx.fillRect(
            x + CABINET_WIDTH,
            TABLE_Y + LIP_HEIGHT,
            SIDE_DEPTH,
            benchHeight,
          );
        }

        // Drawers
        for (let i = 0; i < 2; i++) {
          const dY = TABLE_Y + LIP_HEIGHT + 30 + i * 90;
          if (dY + 70 < canvasSize.height) {
            // Only draw if room
            ctx.fillStyle = DRAWER_COLOR;
            ctx.fillRect(x + 10, dY, CABINET_WIDTH - 20, 65);
            ctx.fillStyle = "#334155";
            ctx.beginPath();
            ctx.roundRect(x + CABINET_WIDTH / 2 - 25, dY + 30, 50, 6, 2);
            ctx.fill();
            ctx.fillStyle = HIGHLIGHT_STRIP;
            ctx.fillRect(x, dY + 75, CABINET_WIDTH, 4);
          }
        }
      };

      // Middle segment
      ctx.fillStyle = TABLE_FRONT_COLOR;
      ctx.fillRect(
        LEFT_GAP + CABINET_WIDTH,
        TABLE_Y + LIP_HEIGHT,
        tableTotalWidth - CABINET_WIDTH * 2,
        benchHeight / 2.5,
      );

      drawCabinet(LEFT_GAP, false);
      drawCabinet(LEFT_GAP + tableTotalWidth - CABINET_WIDTH, true);

      // Table Top Surface
      ctx.fillStyle = TABLE_TOP_COLOR;
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, LIP_HEIGHT);
      ctx.fillStyle = HIGHLIGHT_STRIP;
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, 2);

      // ── Instrument holder stands on the shelf ──────────────────────────────
      // Draw a small bracket/dock for each instrument that lives on the shelf.
      // These show WHERE instruments belong when not in use.
      // Holders always fixed at original shelf positions
      const origHolderList = getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y);
      const HOLDER_IDS = ["thermometer-digital","glass-stirring-rod","spatula","ph-meter","viscosity-gauge"];
      origHolderList.forEach((item) => {
        if (!HOLDER_IDS.includes(item.id)) return;
        const cx  = item.x + item.width / 2;
        const bot = shelfY;
        // Base plate
        ctx.fillStyle = "rgba(100,130,160,0.22)";
        ctx.beginPath();
        ctx.roundRect(cx - item.width * 0.75, bot - 7, item.width * 1.5, 7, [0,0,3,3]);
        ctx.fill();
        ctx.strokeStyle = "rgba(148,163,184,0.28)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
        // Two small side clips
        [cx - item.width * 0.3, cx + item.width * 0.3].forEach(clipX => {
          ctx.fillStyle = "rgba(100,130,160,0.35)";
          ctx.beginPath();
          ctx.roundRect(clipX - 3, bot - 18, 6, 12, 2);
          ctx.fill();
        });
      });

      // 5. APPARATUS RENDERING logic
      apparatus.forEach((item) => {
        const { x: origX, y: origY, width, height, type, name, id } = item;

        // When pouring, the source container moves above the target container
        let drawX = origX;
        let drawY = origY;
        let tiltAngle = 0;
        let streamExitX = origX + width / 2;
        let streamExitY = origY;

        if (item.data?.isPouring && item.data?.pouringTargetId) {
          const pt = apparatus.find((a) => a.id === item.data?.pouringTargetId);
          if (pt) {
            const tgtCX = pt.x + pt.width / 2;
            const srcOrigCX = origX + width / 2;
            const pourRight = tgtCX >= srcOrigCX;

            // ~105° tilt: body swings almost inverted — opening faces downward, just
            // like the hand holding a bottle and pouring into a beaker below
            const theta = Math.PI * 7 / 12; // 105°
            tiltAngle = pourRight ? -theta : theta;

            // Pivot (top-centre of container) = the "hand grip" area
            // Placed above and slightly to the pour-side of the target
            const pivX = tgtCX + (pourRight ? width * 0.35 : -width * 0.35);
            const pivY = pt.y - 92;
            drawX = pivX - width / 2;
            drawY = pivY;

            // Opening edge after rotation — for a bottle use the inner neck edge,
            // for a cylinder use the rim edge.  The leading (lower) edge is on the
            // opposite side from the pour direction.
            const neckOff = type === "bottle" ? width * 0.22 : width * 0.46;
            const eOffX   = pourRight ? -neckOff : neckOff;
            // Rotate offset (eOffX, 0) around pivot by tiltAngle
            streamExitX = pivX + eOffX * Math.cos(tiltAngle);
            streamExitY = pivY + eOffX * Math.sin(tiltAngle);
          }
        }

        // x / y used by all code below — drawer position, not shelf position
        const x = drawX;
        const y = drawY;

        // -- Label Rendering (only show on hover) --
        if (hoveredId === id) {
          const labelX = x + width / 2;
          const labelY = y - 35;
          ctx.font = "bold 11px sans-serif";
          const tWidth = ctx.measureText(name).width;
          ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
          ctx.beginPath();
          ctx.roundRect(
            labelX - (tWidth / 2 + 8),
            labelY - 12,
            tWidth + 16,
            20,
            4,
          );
          ctx.fill();
          ctx.fillStyle = "#0f172a";
          ctx.textAlign = "center";
          ctx.fillText(name, labelX, labelY + 3);
        }

        // -- Elevation glow: show when an instrument is dragged over this beaker --
        if (type === "beaker" || type === "cylinder") {
          const draggedItem = draggingRef.current
            ? apparatus.find(a => a.id === draggingRef.current?.id) : null;
          const isInstrument = draggedItem &&
            ["thermometer","phmeter","viscositygauge","stirringrod"].includes(draggedItem.type);
          if (isInstrument && draggedItem) {
            const dCX = draggedItem.x + draggedItem.width / 2;
            const bCX = x + width / 2;
            const nearHoriz = Math.abs(dCX - bCX) < width * 0.9;
            const nearVert  = draggedItem.y + draggedItem.height > y && draggedItem.y < y + height;
            if (nearHoriz && nearVert) {
              ctx.save();
              ctx.strokeStyle = "rgba(59,130,246,0.7)";
              ctx.lineWidth = 2.5;
              ctx.shadowColor = "#3b82f6";
              ctx.shadowBlur = 12;
              ctx.beginPath();
              ctx.roundRect(x - 3, y - 3, width + 6, height + 6, 6);
              ctx.stroke();
              ctx.restore();
            }
          }
        }

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

        // Draw apparatus FIRST so the stream renders on top of the container
        if (type === "beaker") {
          const maxVol = item.data?.maxVolume || 250;
          const currentVol = item.data?.currentVolume || 0;
          const liquidColor =
            item.data?.liquidColor || "rgba(56, 189, 248, 0.6)";
          drawBeaker(ctx, x, y, width, height, maxVol, currentVol, liquidColor, item.data?.liquidTemperature ?? 25, hotPlateFrame, item.data?.isStirring ?? false, (item.data?.solidStearicGrams ?? 0) + (item.data?.solidBeeswaxGrams ?? 0), tiltAngle, item.data?.emulsificationProgress ?? 0);
        } else if (type === "cylinder") {
          const maxVol = item.data?.maxVolume || 100;
          const currentVol = item.data?.currentVolume || 0;
          const liquidColor =
            item.data?.liquidColor || "rgba(56, 189, 248, 0.6)";
          drawCylinder(ctx, x, y, width, height, maxVol, currentVol, tiltAngle, liquidColor);
        } else if (type === "bottle") {
          const maxVol = item.data?.maxVolume || 250;
          const currentVol = item.data?.currentVolume || 0;
          const liquidColor =
            item.data?.liquidColor || "rgba(56, 189, 248, 0.5)";
          const lidColor = item.data?.lidColor || "#0ea5e9";
          drawBottle(
            ctx, x, y, width, height, maxVol, name,
            item.data?.hasLid ?? false, currentVol, tiltAngle, liquidColor, lidColor,
            item.data?.isSolid ?? false,
          );
        } else if (type === "thermometer") {
          // Show display only when probe tip is inside a beaker
          const probeBottom = y + height;
          const probeCX     = x + width / 2;
          const thermoMeasuring = apparatus.some(
            (a) => (a.type === "beaker" || a.type === "cylinder") &&
                   probeCX    >= a.x && probeCX    <= a.x + a.width &&
                   probeBottom >= a.y && probeBottom <= a.y + a.height,
          );
          drawThermometer(ctx, x, y, width, height, item.data?.readingTemperature ?? 25, thermoMeasuring);
        } else if (type === "stirringrod") {
          drawStirringRod(ctx, x, y, width, height, item.data?.isStirring ?? false, hotPlateFrame);
        } else if (type === "phmeter") {
          drawPhMeter(ctx, x, y, width, height, item.data?.phReading ?? 7.0);
        } else if (type === "viscositygauge") {
          drawViscosityGauge(ctx, x, y, width, height, item.data?.viscosityReading ?? 0, item.data?.isViscosityActive ?? false, hotPlateFrame);
        } else if (type === "spatula") {
          // Deflect blade downward when pressing into a solid reagent bottle
          const bladeCX  = x + width / 2;
          const bladeBot = y + height;
          const pressingIntoSolid = dragging?.id === item.id && apparatus.some(
            (a) => a.data?.isSolid &&
                   bladeCX  >= a.x && bladeCX  <= a.x + a.width &&
                   bladeBot >= a.y && bladeBot <= a.y + a.height,
          );
          drawSpatula(ctx, x, y, width, height, item.data?.spatulaLoad ?? 0, pressingIntoSolid);
        } else if (type === "weightbalance") {
          // Platform top matches drawWeightBalance: y + h*0.60 - 8
          const platformTop = item.y + item.height * 0.60 - 8;
          const beakerOnPlate = apparatus.find(
            (a) =>
              (a.type === "beaker" || a.type === "cylinder") &&
              a.x + a.width / 2 >= item.x + 8 &&
              a.x + a.width / 2 <= item.x + item.width - 8 &&
              Math.abs((a.y + a.height) - platformTop) < 18,
          );
          const wt = beakerOnPlate ? calcBeakerWeight(beakerOnPlate) : 0;
          drawWeightBalance(ctx, x, y, width, height, wt, !!beakerOnPlate);
        } else if (type === "icebucket") {
          drawIceBucket(ctx, x, y, width, height, item.data?.iceLevel ?? 100);
        } else if (type === "hotplate") {
          drawHotPlate(
            ctx, x, y, width, height,
            item.data?.isOn ?? false,
            item.data?.temperature ?? 25,
            item.data?.targetTemperature ?? 200,
            hotPlateFrame,
          );
        } else {
          ctx.fillStyle = "white";
          ctx.fillRect(x, y, width, height);
        }

        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Draw the liquid stream ON TOP of the tilted source container
        // so the arc visibly connects source spout → target opening
        if (item.data?.isPouring && item.data.pouringTargetId) {
          const target = apparatus.find(
            (a) => a.id === item.data?.pouringTargetId,
          );
          if (target) {
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.shadowOffsetY = 0;

            const sourceColor = item.data?.liquidColor || "rgba(56, 189, 248, 0.8)";
            const [sr, sg, sb] = parseRgba(sourceColor);
            const sc = (a: number) => `rgba(${sr}, ${sg}, ${sb}, ${a.toFixed(3)})`;

            // startX/Y = rotated spout exit (already computed above)
            const startX = streamExitX;
            const startY = streamExitY;
            // endX/Y = top opening of the target container
            const endX = target.x + target.width / 2;
            const endY = target.y + 6;
            const progress = item.data?.pouringProgress || 0;

            // Control point: stream exits the spout roughly vertically then
            // curves smoothly to the target centre — creates the natural arc
            // seen when pouring a liquid from a tilted container.
            const sDy = endY - startY;
            const ctrlX = startX + (endX - startX) * 0.55;
            const ctrlY = startY + sDy * 0.22;

            const arc = () => {
              ctx.beginPath();
              ctx.moveTo(startX, startY);
              ctx.quadraticCurveTo(ctrlX, ctrlY, endX, endY);
              ctx.stroke();
            };

            // Layer 1 — wide soft glow
            ctx.strokeStyle = sc(0.25);
            ctx.lineWidth = 18;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            arc();

            // Layer 2 — mid translucent body
            ctx.strokeStyle = sc(0.62);
            ctx.lineWidth = 9;
            arc();

            // Layer 3 — opaque core
            ctx.strokeStyle = sc(0.95);
            ctx.lineWidth = 4;
            arc();

            // Layer 4 — specular gleam on one side
            ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(startX - 1, startY);
            ctx.quadraticCurveTo(ctrlX - 1, ctrlY, endX - 1, endY);
            ctx.stroke();

            // Animated blobs that travel from spout to target
            for (let i = 0; i < 14; i++) {
              const t = ((i / 14) + progress * 1.4) % 1;
              const bx = (1-t)*(1-t)*startX + 2*(1-t)*t*ctrlX + t*t*endX;
              const by = (1-t)*(1-t)*startY + 2*(1-t)*t*ctrlY + t*t*endY;

              // Perpendicular wobble
              const tx2 = 2*(1-t)*(ctrlX-startX) + 2*t*(endX-ctrlX);
              const ty2 = 2*(1-t)*(ctrlY-startY) + 2*t*(endY-ctrlY);
              const tl  = Math.sqrt(tx2*tx2 + ty2*ty2) || 1;
              const px  = -ty2 / tl;
              const py  =  tx2 / tl;
              const wob = Math.sin(t * 10 + progress * Math.PI * 6) * 1.8;

              const br = 2.5 + Math.sin(t * Math.PI) * 1.5;
              const ba = 0.5  + Math.sin(t * Math.PI) * 0.35;

              ctx.fillStyle = sc(ba);
              ctx.beginPath();
              ctx.arc(bx + px*wob, by + py*wob, br, 0, Math.PI * 2);
              ctx.fill();

              // Tiny specular dot per blob
              ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
              ctx.beginPath();
              ctx.arc(bx + px*wob - br*0.3, by + py*wob - br*0.3, br*0.38, 0, Math.PI * 2);
              ctx.fill();
            }

            // ── Impact / splash at target opening ──
            const splashP = Math.sin(progress * Math.PI);

            // Expanding ripple rings
            for (let ring = 0; ring < 3; ring++) {
              const rt = ((progress * 3.5 + ring * 0.33) % 1);
              ctx.strokeStyle = sc((1 - rt) * 0.45);
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.arc(endX, endY, rt * 22 + 2, 0, Math.PI * 2);
              ctx.stroke();
            }

            // Radial splash pool
            const poolR = splashP * 14 + 4;
            const pg = ctx.createRadialGradient(endX, endY, 0, endX, endY, poolR);
            pg.addColorStop(0, sc(0.9));
            pg.addColorStop(1, sc(0));
            ctx.fillStyle = pg;
            ctx.beginPath();
            ctx.arc(endX, endY, poolR, 0, Math.PI * 2);
            ctx.fill();

            // Scattered micro-droplets
            for (let d = 0; d < 8; d++) {
              const ang = (d / 8) * Math.PI * 2 + progress * 2.5;
              const dist = splashP * 16 + 2;
              ctx.fillStyle = sc(splashP * 0.65);
              ctx.beginPath();
              ctx.arc(
                endX + Math.cos(ang) * dist,
                endY + Math.sin(ang) * dist * 0.5,
                1.5, 0, Math.PI * 2,
              );
              ctx.fill();
            }

            // Bright glow dot at spout — confirms where the pour starts
            ctx.fillStyle = sc(0.92);
            ctx.beginPath();
            ctx.arc(startX, startY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
            ctx.beginPath();
            ctx.arc(startX - 1.5, startY - 1.5, 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      });
    },
    [canvasSize, apparatus, benchHeight, tableTotalWidth, hoveredId, hotPlateFrame],
  );

  useEffect(() => {
    const handleResize = () => {
      // Walk up to find the scrollable wrapper (.lab-canvas-wrap or similar)
      const container = canvasRef.current?.parentElement;
      if (container) {
        const w = Math.max(container.clientWidth,  1200);
        const h = Math.max(container.clientHeight, 680);
        setCanvasSize({ width: w, height: h });
      }
    };
    handleResize();
    const ro = new ResizeObserver(handleResize);
    if (canvasRef.current?.parentElement)
      ro.observe(canvasRef.current.parentElement);
    window.addEventListener("resize", handleResize);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const hotPlateIsOn = apparatus.find((a) => a.type === "hotplate")?.data?.isOn ?? false;
  const anyStirring       = apparatus.some((a) => a.data?.isStirring);
  const viscosityActive   = apparatus.some((a) => a.data?.isViscosityActive);
  const animating         = hotPlateIsOn || anyStirring || viscosityActive;

  // Hot plate self-heating + beaker heating when on
  useEffect(() => {
    if (!hotPlateIsOn) return;
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const hp = prev.find((a) => a.type === "hotplate");
        return prev.map((a) => {
          // Advance hot plate temperature toward its target
          if (a.type === "hotplate" && a.data?.isOn) {
            const current = a.data.temperature ?? 25;
            const target = a.data.targetTemperature ?? 200;
            if (Math.abs(current - target) < 1.5) return a;
            const next =
              current < target
                ? Math.min(current + 1.8, target)
                : Math.max(current - 1.8, target);
            return { ...a, data: { ...a.data, temperature: next } };
          }
          // Heat beakers / cylinders on the plate; cool those removed from it
          if (hp && (a.type === "beaker" || a.type === "cylinder")) {
            const centerX = a.x + a.width / 2;
            const onHP =
              Math.abs(a.y + a.height - hp.y) < 8 &&
              centerX >= hp.x &&
              centerX <= hp.x + hp.width;
            const curT = a.data?.liquidTemperature ?? 25;
            if (onHP) {
              const targetT = hp.data?.targetTemperature ?? 200;

              if (curT < targetT - 0.3) {
                // ── Heat up toward target ──────────────────────────────────
                const newTemp = Math.min(curT + 0.3, targetT);
                const newData: typeof a.data = {
                  ...a.data,
                  liquidTemperature: newTemp,
                  maxTemperatureReached: Math.max(a.data?.maxTemperatureReached ?? 25, newTemp),
                };
                // Melt solid stearic acid above 70°C
                if (curT >= 70 && (a.data?.solidStearicGrams ?? 0) > 0) {
                  const grams     = a.data!.solidStearicGrams!;
                  const meltedVol = grams / 0.847;
                  newData.solidStearicGrams = 0;
                  newData.currentVolume     = Math.min((a.data?.maxVolume ?? 500), (a.data?.currentVolume ?? 0) + meltedVol);
                  newData.liquidColor       = "rgba(255, 248, 220, 0.85)";
                  newData.composition       = { ...(a.data?.composition ?? {}), stearicAcid: ((a.data?.composition?.stearicAcid) ?? 0) + grams };
                  newData.pH        = a.data?.pH ?? 3.5;
                  newData.viscosity = a.data?.viscosity ?? 15;
                }
                // Melt solid beeswax above 62°C (lower melting point than stearic acid)
                if (curT >= 62 && (a.data?.solidBeeswaxGrams ?? 0) > 0) {
                  const grams     = a.data!.solidBeeswaxGrams!;
                  const meltedVol = grams / 0.96;
                  newData.solidBeeswaxGrams = 0;
                  newData.currentVolume     = Math.min((a.data?.maxVolume ?? 500), (newData.currentVolume ?? (a.data?.currentVolume ?? 0)) + meltedVol);
                  newData.liquidColor       = "rgba(255, 240, 180, 0.88)";
                  newData.composition       = { ...(newData.composition ?? a.data?.composition ?? {}), beeswax: ((a.data?.composition?.beeswax) ?? 0) + grams };
                  newData.pH        = a.data?.pH ?? 6.5;
                  newData.viscosity = a.data?.viscosity ?? 180;
                }
                return { ...a, data: newData };

              } else if (curT > targetT + 0.3) {
                // ── Cool down toward target (user lowered the set temperature) ──
                return {
                  ...a,
                  data: {
                    ...a.data,
                    liquidTemperature: Math.max(targetT, curT - 0.2),
                  },
                };
              }
              // Within ±0.3°C of target → hold steady
            // Temperature stays constant when not on hot plate — only ice bucket cools
            }
          }
          return a;
        });
      });
    }, 80);
    return () => clearInterval(interval);
  }, [hotPlateIsOn]);

  // Set pour slider to maximum every time the pour modal opens
  useEffect(() => {
    if (!showPourModal) return;
    const source = apparatus.find((a) => a.id === showPourModal.sourceId);
    const target = apparatus.find((a) => a.id === showPourModal.targetId);
    if (!source || !target) return;
    const available   = source.data?.currentVolume ?? 0;
    const targetSpace = (target.data?.maxVolume ?? 0) - (target.data?.currentVolume ?? 0);
    const max = Math.min(available, targetSpace);
    setSelectedPourAmount(max); // exact value — rounding causes residue on 100% pours
  }, [showPourModal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ice bucket cooling — slowly drops beaker temperature when placed inside the bucket
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const bucket = prev.find((a) => a.type === "icebucket");
        if (!bucket) return prev;

        let iceDepleted = false;
        const next = prev.map((a) => {
          if (a.type === "beaker" || a.type === "cylinder") {
            const cx  = a.x + a.width / 2;
            const bot = a.y + a.height;
            const inBucket =
              cx  >= bucket.x + 10 && cx  <= bucket.x + bucket.width - 10 &&
              bot >= bucket.y + 20  && bot <= bucket.y + bucket.height + 10;
            if (!inBucket) return a;

            const curT = a.data?.liquidTemperature ?? 25;
            if (curT <= 0) return a;
            iceDepleted = true;
            return {
              ...a,
              data: {
                ...a.data,
                liquidTemperature: Math.max(0, curT - 0.6),
                minCoolingTemp: Math.min(a.data?.minCoolingTemp ?? 100, curT),
              },
            };
          }
          return a;
        });

        // Melt ice a little each tick a beaker is inside
        if (iceDepleted) {
          return next.map((a) =>
            a.type === "icebucket"
              ? { ...a, data: { ...a.data, iceLevel: Math.max(0, (a.data?.iceLevel ?? 100) - 0.15) } }
              : a,
          );
        }
        return next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Stirring timer — count total seconds stirred in any beaker
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) =>
        prev.map((a) => {
          if ((a.type !== "beaker" && a.type !== "cylinder") || !a.data?.isStirring) return a;
          return { ...a, data: { ...a.data, stirringSeconds: (a.data?.stirringSeconds ?? 0) + 1 } };
        }),
      );
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Emulsification — advance progress while stirring with both phases present
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) =>
        prev.map((a) => {
          if ((a.type !== "beaker" && a.type !== "cylinder") || !a.data?.isStirring) return a;

          const comp    = (a.data?.composition ?? {}) as Record<string, number>;
          const hasOil  = (comp.stearicAcid ?? 0) > 2 || (comp.liquidParaffin ?? 0) > 2 || (comp.beeswax ?? 0) > 2;
          const hasAq   = (comp.water ?? 0) > 10 || (comp.borax ?? 0) > 0.5;
          if (!hasOil || !hasAq) return a;

          const progress = a.data?.emulsificationProgress ?? 0;
          if (progress >= 100) return a;

          const temp    = a.data?.liquidTemperature ?? 25;
          const rate    = temp >= 60 ? 3.5 : 1.5; // faster at correct temperature
          const newProg = Math.min(100, progress + rate);

          // Interpolate liquidColor from current toward cream white
          const tC = Math.max(0, (newProg - 20) / 80);
          const r  = Math.round(210 + 45 * tC);
          const g  = Math.round(195 + 57 * tC);
          const b  = Math.round(170 + 78 * tC);
          const al = (0.62 + 0.33 * tC).toFixed(2);
          const newColor = `rgba(${r},${g},${b},${al})`;

          return {
            ...a,
            data: {
              ...a.data,
              emulsificationProgress: newProg,
              liquidColor: newColor,
            },
          };
        }),
      );
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Thermometer thermal lag — slowly drift readingTemperature toward the liquid it's dipped into
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const thermo = prev.find((a) => a.type === "thermometer");
        if (!thermo) return prev;

        const probeBottom = thermo.y + thermo.height;
        const probeCX = thermo.x + thermo.width / 2;
        const beakerUnder = prev.find(
          (a) =>
            a.id !== thermo.id &&
            (a.type === "beaker" || a.type === "cylinder") &&
            probeCX >= a.x &&
            probeCX <= a.x + a.width &&
            probeBottom >= a.y &&
            probeBottom <= a.y + a.height,
        );

        // Probe in beaker → track liquid temperature quickly (max 2°C per tick)
        // Probe outside → drift back to ambient 25°C
        const targetTemp = beakerUnder?.data?.liquidTemperature ?? 25;
        const current    = thermo.data?.readingTemperature ?? 25;
        if (Math.abs(current - targetTemp) < 0.1) return prev;

        const rate = beakerUnder ? 2.0 : 0.8;   // fast when dipped, slow when removed
        const next =
          current < targetTemp
            ? Math.min(current + rate, targetTemp)
            : Math.max(current - rate, targetTemp);

        return prev.map((a) =>
          a.id === thermo.id
            ? { ...a, data: { ...a.data, readingTemperature: next } }
            : a,
        );
      });
    }, 80);   // check every 80 ms
    return () => clearInterval(interval);
  }, []);

  // pH meter — slowly drift phReading toward the beaker's actual pH
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const meter = prev.find((a) => a.type === "phmeter");
        if (!meter) return prev;

        const probeBottom = meter.y + meter.height;
        const probeCX = meter.x + meter.width / 2;
        const beakerUnder = prev.find(
          (a) =>
            a.id !== meter.id &&
            (a.type === "beaker" || a.type === "cylinder") &&
            probeCX >= a.x && probeCX <= a.x + a.width &&
            probeBottom >= a.y && probeBottom <= a.y + a.height,
        );

        // Compute pH from composition (same formula as evaluation engine)
        // so the meter reading matches the final evaluation result
        let targetPH = 7.0;
        if (beakerUnder) {
          const comp = (beakerUnder.data?.composition ?? {}) as Record<string, number>;
          const total = Object.values(comp).reduce((s, v) => s + (v || 0), 0);
          if (total > 5) {
            const kohPct = ((comp.koh ?? 0) / total) * 100;
            targetPH = Math.max(4, Math.min(12, 5 + kohPct * 0.8));
          } else {
            targetPH = beakerUnder.data?.pH ?? 7.0;
          }
        }

        const current = meter.data?.phReading ?? 7.0;
        if (Math.abs(current - targetPH) < 0.005) return prev;

        const rate = 0.12;
        const next =
          current < targetPH
            ? Math.min(current + rate, targetPH)
            : Math.max(current - rate, targetPH);

        return prev.map((a) =>
          a.id === meter.id ? { ...a, data: { ...a.data, phReading: next } } : a,
        );
      });
    }, 120);
    return () => clearInterval(interval);
  }, []);

  // Viscosity gauge — when active, exponentially approach target viscosity over ~3 s
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const gauge = prev.find((a) => a.type === "viscositygauge");
        if (!gauge || !gauge.data?.isViscosityActive) return prev;

        const probeBottom = gauge.y + gauge.height;
        const probeCX = gauge.x + gauge.width / 2;
        const beakerUnder = prev.find(
          (a) =>
            a.id !== gauge.id &&
            (a.type === "beaker" || a.type === "cylinder") &&
            probeCX >= a.x && probeCX <= a.x + a.width &&
            probeBottom >= a.y && probeBottom <= a.y + a.height,
        );

        // Compute viscosity from composition (same formula as evaluation engine)
        let targetVisc = 0;
        if (beakerUnder) {
          const comp = (beakerUnder.data?.composition ?? {}) as Record<string, number>;
          const total = Object.values(comp).reduce((s, v) => s + (v || 0), 0);
          if (total > 5) {
            const stearicPct  = ((comp.stearicAcid  ?? 0) / total) * 100;
            const paraffinPct = ((comp.liquidParaffin ?? 0) / total) * 100;
            const waterPct    = ((comp.water ?? 0) / total) * 100;
            targetVisc = Math.max(1, stearicPct * 70 + paraffinPct * 45 - waterPct * 5);
          } else {
            targetVisc = beakerUnder.data?.viscosity ?? 0;
          }
        }
        const current = gauge.data?.viscosityReading ?? 0;
        if (Math.abs(current - targetVisc) < 0.5) return prev;

        // Approach 18% of remaining gap per tick → reaches target in ~2 s
        const next = current + (targetVisc - current) * 0.18;

        return prev.map((a) =>
          a.id === gauge.id ? { ...a, data: { ...a.data, viscosityReading: next } } : a,
        );
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

  // ── Step-alert monitor ───────────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevAppRef.current;
    if (!prev.length) { prevAppRef.current = apparatus; return; }
    const ms = milestoneRef.current;
    const hit = (key: string) => { if (ms.has(key)) return false; ms.add(key); return true; };

    apparatus.forEach((curr) => {
      const p = prev.find((a) => a.id === curr.id);
      if (!p) return;

      // ── Hot plate ──────────────────────────────────────────────────────────
      if (curr.type === "hotplate") {
        if (!p.data?.isOn && curr.data?.isOn) {
          const tgt = curr.data.targetTemperature ?? 200;
          if (tgt >= 70 && tgt <= 80)
            addNotif("Hot plate ON — target temperature correct", "success", `Set to ${tgt}°C (ideal 70–80°C)`);
          else
            addNotif("Hot plate ON — check target temperature", "warning", `Set to ${tgt}°C — ideal range is 70–80°C`);
        }
        if (p.data?.isOn && !curr.data?.isOn)
          addNotif("Hot plate switched OFF", "info", "Temperature holds in beakers — only ice bucket will cool them");
      }

      // ── Pour lifecycle — snapshot on start, alert on end ──────────────────
      if (curr.type === "bottle" || curr.type === "cylinder" || curr.type === "beaker") {
        // Pour started → snapshot the target beaker's current composition
        if (!p.data?.isPouring && curr.data?.isPouring && curr.data?.pouringTargetId) {
          const tid = curr.data.pouringTargetId;
          const tgt = apparatus.find((a) => a.id === tid);
          pourStartRef.current[tid] = { ...(tgt?.data?.composition ?? {}) } as Record<string, number>;
        }

        // Pour ended → only check ingredient amounts when source is a BOTTLE
        // Beaker-to-beaker mixing is a process step — never warn on ingredient amounts
        if (p.data?.isPouring && !curr.data?.isPouring && curr.type === "bottle") {
          const tid = p.data?.pouringTargetId;
          if (tid && pourStartRef.current[tid] !== undefined) {
            const tgt       = apparatus.find((a) => a.id === tid);
            const endComp   = (tgt?.data?.composition ?? {}) as Record<string, number>;
            const startComp = pourStartRef.current[tid];
            delete pourStartRef.current[tid];

            const checkPour = (
              key: string, label: string, baseMin: number, baseMax: number, unit: string,
            ) => {
              const added = +((endComp[key] ?? 0) - (startComp[key] ?? 0)).toFixed(1);
              if (added < 0.02) return;
              const min = +(baseMin * multiplier).toFixed(2);
              const max = +(baseMax * multiplier).toFixed(2);
              if (added >= min && added <= max) {
                addNotif(`✓ ${label}: ${added} ${unit}`, "success",
                  `Correct amount — target ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} poured: ${added} ${unit} ✓`);
              } else if (added < min) {
                addNotif(`⚠ ${label}: ${added} ${unit} — too little`, "warning",
                  `Target is ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} poured: ${added} ${unit} ⚠ too little`);
              } else {
                addNotif(`⚠ ${label}: ${added} ${unit} — too much`, "warning",
                  `Target is ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} poured: ${added} ${unit} ⚠ too much`);
              }
            };

            if (isColdCream) {
              checkPour("water",         "Distilled water",   35, 50, "mL");
              checkPour("liquidParaffin","Liquid paraffin",   30, 40, "mL");
              checkPour("borax",         "Borax solution",     2,  5, "mL");
            } else {
              checkPour("water",         "Distilled water",   65, 75, "mL");
              checkPour("liquidParaffin","Liquid paraffin",    5, 10, "mL");
              checkPour("glycerin",      "Glycerin",           2,  5, "mL");
              checkPour("koh",           "KOH & Triethanolamine", 0.5, 2, "mL");
            }
          }
        } else if (p.data?.isPouring && !curr.data?.isPouring &&
                   (curr.type === "beaker" || curr.type === "cylinder")) {
          // Beaker/cylinder-to-beaker mix completed — give a positive mixing confirmation
          if (curr.type === "beaker")
            addNotif("Phases combined ✓", "success", "Continue stirring to complete emulsification");
          logLabMilestone(practicalId, "Oil and aqueous phases combined in mixing beaker");
          // Always clean up the snapshot to prevent orphan entries
          delete pourStartRef.current[p.data?.pouringTargetId ?? ""];
        }
      }

      // ── Beaker / cylinder — temperature milestones & solid deposit ─────────
      if (curr.type === "beaker" || curr.type === "cylinder") {
        const prevT = p.data?.liquidTemperature ?? 25;
        const currT = curr.data?.liquidTemperature ?? 25;
        const name  = curr.name;

        if (prevT < 70 && currT >= 70 && hit(`melt-${curr.id}`)) {
          addNotif(`${name} — stearic acid melting`, "info", "Solid turning to liquid at 70°C ✓");
          logLabMilestone(practicalId, `${name} reached 70°C — stearic acid melting`);
        }

        if (prevT < 75 && currT >= 75 && hit(`target75-${curr.id}`)) {
          addNotif(`✓ ${name} reached 75°C`, "success", "Correct temperature for emulsification");
          logLabMilestone(practicalId, `${name} reached target temperature 75°C ✓`);
        }

        if (prevT < 80 && currT >= 80 && hit(`over80-${curr.id}`)) {
          addNotif(`⚠ ${name} exceeded 80°C`, "warning", `Now ${Math.round(currT)}°C — ideal max is 80°C`);
          logLabMilestone(practicalId, `⚠ ${name} exceeded 80°C — overheating`);
        }

        if (prevT > 40 && currT <= 40 && hit(`cooled-${curr.id}`)) {
          addNotif(`✓ ${name} cooled to ≤40°C`, "success", "Cooling step completed correctly");
          logLabMilestone(practicalId, `${name} cooled to ≤40°C — cooling step complete ✓`);
        }

        // Solid stearic acid deposited by spatula (instant, not a pour animation)
        const prevSolid = p.data?.solidStearicGrams ?? 0;
        const currSolid = curr.data?.solidStearicGrams ?? 0;
        if (currSolid > prevSolid) {
          const added  = +(currSolid - prevSolid).toFixed(1);
          const sMin   = +(15 * multiplier).toFixed(1);
          const sMax   = +(20 * multiplier).toFixed(1);
          const sWarnL = +(12 * multiplier).toFixed(1);
          const sWarnH = +(23 * multiplier).toFixed(1);
          const hint   = `Target is ${sMin}–${sMax} g`;
          if (added >= sMin && added <= sMax) {
            addNotif(`✓ Stearic acid: ${added} g`, "success", `Correct amount (${hint})`);
            logLabMilestone(practicalId, `Stearic acid weighed: ${added} g ✓ (target ${sMin}–${sMax} g)`);
          } else if (added >= sWarnL && added <= sWarnH) {
            addNotif(`⚠ Stearic acid: ${added} g — marginal`, "warning", `${hint} — borderline amount`);
            logLabMilestone(practicalId, `Stearic acid weighed: ${added} g ⚠ borderline (target ${sMin}–${sMax} g)`);
          } else if (added < sWarnL) {
            addNotif(`✗ Stearic acid: ${added} g — too little`, "error", hint);
            logLabMilestone(practicalId, `Stearic acid weighed: ${added} g ✗ too little (target ${sMin}–${sMax} g)`);
          } else {
            addNotif(`✗ Stearic acid: ${added} g — too much`, "error", hint);
            logLabMilestone(practicalId, `Stearic acid weighed: ${added} g ✗ too much (target ${sMin}–${sMax} g)`);
          }
        }

        // Solid beeswax deposited by spatula (cold cream)
        const prevWax = p.data?.solidBeeswaxGrams ?? 0;
        const currWax = curr.data?.solidBeeswaxGrams ?? 0;
        if (currWax > prevWax) {
          const added  = +(currWax - prevWax).toFixed(1);
          const wMin   = +(10 * multiplier).toFixed(1);
          const wMax   = +(16 * multiplier).toFixed(1);
          const wWarnL = +(8  * multiplier).toFixed(1);
          const wWarnH = +(18 * multiplier).toFixed(1);
          const hint   = `Target is ${wMin}–${wMax} g`;
          if (added >= wMin && added <= wMax) {
            addNotif(`✓ Beeswax: ${added} g`, "success", `Correct amount (${hint})`);
            logLabMilestone(practicalId, `Beeswax weighed: ${added} g ✓ (target ${wMin}–${wMax} g)`);
          } else if (added >= wWarnL && added <= wWarnH) {
            addNotif(`⚠ Beeswax: ${added} g — marginal`, "warning", `${hint} — borderline amount`);
            logLabMilestone(practicalId, `Beeswax weighed: ${added} g ⚠ borderline (target ${wMin}–${wMax} g)`);
          } else if (added < wWarnL) {
            addNotif(`✗ Beeswax: ${added} g — too little`, "error", hint);
            logLabMilestone(practicalId, `Beeswax weighed: ${added} g ✗ too little (target ${wMin}–${wMax} g)`);
          } else {
            addNotif(`✗ Beeswax: ${added} g — too much`, "error", hint);
            logLabMilestone(practicalId, `Beeswax weighed: ${added} g ✗ too much (target ${wMin}–${wMax} g)`);
          }
        }
      }

      // ── Stirring rod ───────────────────────────────────────────────────────
      if (curr.type === "stirringrod" && !p.data?.isStirring && curr.data?.isStirring) {
        addNotif("Stirring in progress", "info", "Hold for at least 30 seconds for full emulsification");
        logLabMilestone(practicalId, "Stirring started — mixing phases");
      }
    });

    prevAppRef.current = apparatus;
  }, [apparatus, addNotif, multiplier, isColdCream, practicalId]);

  // Animation frame — runs whenever hot plate is on OR stirring is active
  useEffect(() => {
    if (!animating) return;
    let rafId: number;
    const tick = () => {
      setHotPlateFrame((f) => (f + 1) % 720);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [animating]);

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
    const clicked = apparatus.find(
      (a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
    );
    if (clicked) {
      // Stirring rod — live-detect whether tip is inside a beaker with liquid
      if (clicked.type === "stirringrod") {
        const probeBottom = clicked.y + clicked.height;
        const probeCX     = clicked.x + clicked.width / 2;
        const beakerUnder = apparatus.find(
          (a) =>
            (a.type === "beaker" || a.type === "cylinder") &&
            probeCX     >= a.x && probeCX     <= a.x + a.width &&
            probeBottom >= a.y && probeBottom <= a.y + a.height &&
            (a.data?.currentVolume ?? 0) > 0,
        );
        if (beakerUnder) {
          // Tip is inside liquid → hold to stir, rod stays fixed
          holdStirRef.current = { rodId: clicked.id, targetId: beakerUnder.id };
          setApparatus((prev) =>
            prev.map((a) =>
              a.id === clicked.id || a.id === beakerUnder.id
                ? { ...a, data: { ...a.data, isStirring: true, stirringTargetId: beakerUnder.id } }
                : a,
            ),
          );
          e.preventDefault();
          window.addEventListener("mouseup", handleMouseUp);
          return; // locked — no drag
        }
        // Tip is outside any beaker → fall through to drag so user can reposition rod
      }

      // If lid is present, show lid modal
      if (clicked.data?.hasLid) {
        setShowLidModal({ id: clicked.id });
        return;
      }
      const dragState = { id: clicked.id, offsetX: x - clicked.x, offsetY: y - clicked.y };
      draggingRef.current = dragState;
      setDragging(dragState);
      e.preventDefault();
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const drag = draggingRef.current;   // always fresh — no stale closure
      if (!drag) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const snapDistance = 50;
      setApparatus((prev) => {
        const hotPlate = prev.find((a) => a.type === "hotplate");
        const balance   = prev.find((a) => a.type === "weightbalance");
        const iceBucket = prev.find((a) => a.type === "icebucket");
        const balancePlatformY = balance
          ? balance.y + balance.height * 0.60 - 8
          : null;
        return prev.map((app) => {
          if (app.id === drag.id) {
            let newY = y - drag.offsetY;
            let snapped = false;

            if (app.type === "beaker" || app.type === "cylinder") {
              const newX    = x - drag.offsetX;
              const centerX = newX + app.width / 2;

              // 1. Snap into ice bucket (highest priority)
              if (
                !snapped && iceBucket &&
                centerX >= iceBucket.x + 15 && centerX <= iceBucket.x + iceBucket.width - 15 &&
                Math.abs(newY + app.height - (iceBucket.y + iceBucket.height - 8)) < snapDistance
              ) {
                newY    = iceBucket.y + iceBucket.height - 8 - app.height;
                snapped = true;
              }

              // 2. Snap onto weight balance platform
              if (
                !snapped && balance && balancePlatformY !== null &&
                centerX >= balance.x + 8 && centerX <= balance.x + balance.width - 8 &&
                Math.abs(newY + app.height - balancePlatformY) < snapDistance
              ) {
                newY    = balancePlatformY - app.height;
                snapped = true;
              }

              // 3. Snap onto hot plate surface
              if (
                !snapped && hotPlate &&
                centerX >= hotPlate.x && centerX <= hotPlate.x + hotPlate.width &&
                Math.abs(newY + app.height - hotPlate.y) < snapDistance
              ) {
                newY    = hotPlate.y - app.height;
                snapped = true;
              }
            }

            // 3. Snap to table surface (lowest priority — only if nothing else matched)
            if (!snapped && Math.abs(newY + app.height - TABLE_Y) < snapDistance)
              newY = TABLE_Y - app.height;

            // 4. Snap to shelf
            if (Math.abs(newY + app.height - shelfY) < snapDistance)
              newY = shelfY - app.height;

            const boundedX = Math.max(0, Math.min(x - drag.offsetX, canvasSize.width - app.width));
            const boundedY = Math.max(NAV_BAR_HEIGHT, Math.min(newY, canvasSize.height - app.height));
            return { ...app, x: boundedX, y: boundedY };
          }
          return app;
        });
      });
    },
    [TABLE_Y, shelfY, canvasSize, NAV_BAR_HEIGHT],   // dragging removed — we read from ref instead
  );

  const handleMouseUp = useCallback(() => {
    // Release hold-to-stir
    if (holdStirRef.current) {
      const { rodId, targetId } = holdStirRef.current;
      holdStirRef.current = null;
      setApparatus((prev) =>
        prev.map((a) =>
          a.id === rodId || a.id === targetId
            ? { ...a, data: { ...a.data, isStirring: false } }
            : a,
        ),
      );
      window.removeEventListener("mouseup", handleMouseUp);
      return;
    }

    if (dragging) {
      pushHistory(); // ← snapshot the position before the drag is finalised
      // Check if dropped over a valid target (beaker or cylinder, lid off)
      const dragged = apparatus.find((a) => a.id === dragging.id);
      if (
        dragged &&
        !dragged.data?.hasLid &&
        (dragged.data?.currentVolume ?? 0) > 0 &&
        !dragged.data?.isSolid &&          // solids must be transferred by spatula only
        (dragged.type === "bottle" ||
          dragged.type === "container" ||
          dragged.type === "cylinder" ||
          dragged.type === "beaker")
      ) {
        const srcCX = dragged.x + dragged.width / 2;
        const srcBottom = dragged.y + dragged.height;
        const target = apparatus.find(
          (a) =>
            (a.type === "beaker" || a.type === "cylinder") &&
            !a.data?.hasLid &&
            a.id !== dragged.id &&
            (a.data?.currentVolume ?? 0) < (a.data?.maxVolume ?? 500) &&
            // centres within 120 px horizontally
            Math.abs(srcCX - (a.x + a.width / 2)) < 120 &&
            // bottoms within 60 px vertically (same surface)
            Math.abs(srcBottom - (a.y + a.height)) < 60,
        );
        if (target) {
          setShowPourModal({ sourceId: dragged.id, targetId: target.id });
        }
      }

      // Stirring rod dropped onto / off a beaker
      if (dragged && dragged.type === "stirringrod") {
        const beakerUnder = apparatus.find(
          (a) =>
            (a.type === "beaker" || a.type === "cylinder") &&
            dragged.x + dragged.width / 2 >= a.x &&
            dragged.x + dragged.width / 2 <= a.x + a.width &&
            dragged.y + dragged.height >= a.y &&
            dragged.y <= a.y + a.height,
        );
        setApparatus((prev) =>
          prev.map((a) =>
            a.id === dragged.id
              ? { ...a, data: { ...a.data, stirringTargetId: beakerUnder?.id ?? null } }
              : a,
          ),
        );
      }

      // Spatula drop — auto-scoop from bottle OR auto-deposit into beaker
      if (dragged && dragged.type === "spatula") {
        const bladeCX = dragged.x + dragged.width / 2;
        const bladeY  = dragged.y + dragged.height;
        const currentLoad = dragged.data?.spatulaLoad ?? 0;

        if (currentLoad > 0) {
          // Loaded — deposit into beaker if blade is inside one
          const beakerTarget = apparatus.find(
            (a) =>
              (a.type === "beaker" || a.type === "cylinder") &&
              bladeCX >= a.x && bladeCX <= a.x + a.width &&
              bladeY  >= a.y && bladeY  <= a.y + a.height,
          );
          if (beakerTarget) {
            const grams = currentLoad;
            const sourceId = dragged.data?.spatulaLoadSourceId ?? "";
            const isBeeswax = sourceId === "container-beeswax";
            setApparatus((prev) =>
              prev.map((a) => {
                if (a.id === dragged.id)
                  return { ...a, data: { ...a.data, spatulaLoad: 0, spatulaLoadSourceId: null } };
                if (a.id === beakerTarget.id) {
                  if (isBeeswax)
                    return { ...a, data: { ...a.data, solidBeeswaxGrams: (a.data?.solidBeeswaxGrams ?? 0) + grams } };
                  else
                    return { ...a, data: { ...a.data, solidStearicGrams: (a.data?.solidStearicGrams ?? 0) + grams } };
                }
                return a;
              }),
            );
          }
        } else {
          // Empty spatula — check if blade overlaps a solid container (stearic acid or beeswax)
          const solidContainer = apparatus.find(
            (a) =>
              (a.id === "container-stearic-acid" || a.id === "container-beeswax") &&
              a.data?.isSolid &&
              (a.data?.currentVolume ?? 0) > 0 &&
              bladeCX >= a.x && bladeCX <= a.x + a.width &&
              bladeY  >= a.y && bladeY  <= a.y + a.height,
          );
          if (solidContainer) {
            const density   = solidContainer.data?.density ?? 0.847;
            const available = Math.floor((solidContainer.data?.currentVolume ?? 0) * density);
            if (available > 0) {
              // Scaled default: 18g stearic or 12g beeswax, multiplied by assignment multiplier
              const baseGrams    = solidContainer.id === "container-beeswax" ? 12 : 18;
              const defaultGrams = Math.max(1, Math.round(baseGrams * multiplier));
              const maxScoop     = Math.min(available, 50);
              setSelectedScoopGrams(Math.min(defaultGrams, maxScoop));
              setShowScoopModal({ spatulaId: dragged.id, sourceId: solidContainer.id, maxGrams: maxScoop });
            }
          }
        }
      }
    }
    draggingRef.current = null;
    setDragging(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [dragging, apparatus, handleMouseMove]);

  return (
    <div className="lab-canvas-container">
      <StepAlerts items={notifications} />
      <div className="canvas-wrapper custom-scrollbar">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="lab-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => handleMouseUp()}
          onMouseLeave={() => setHoveredId(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setMoveMenu(null);
            setLidContextMenu(null);
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const clicked = apparatus.find(
              (a) => cx >= a.x && cx <= a.x + a.width && cy >= a.y && cy <= a.y + a.height,
            );
            if (!clicked) return;
            // Lid menu for bottles/containers; move menu for everything else
            if (clicked.type === "bottle" || clicked.type === "container") {
              setLidContextMenu({ id: clicked.id, x: e.clientX, y: e.clientY });
            } else {
              setMoveMenu({ id: clicked.id, x: e.clientX, y: e.clientY });
            }
          }}
          onMouseMoveCapture={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hovered = apparatus.find(
              (a) =>
                x >= a.x &&
                x <= a.x + a.width &&
                y >= a.y &&
                y <= a.y + a.height,
            );
            setHoveredId(hovered?.id || null);
          }}
          onClick={(e) => {
            if (lidContextMenu) { setLidContextMenu(null); return; }
            if (moveMenu) { setMoveMenu(null); return; }
            if (dragging) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            // Spatula click is handled by drag-drop in mouseUp — skip here

            // Viscosity gauge click — activate spindle measurement
            const viscGauge = apparatus.find(
              (a) =>
                a.type === "viscositygauge" &&
                x >= a.x && x <= a.x + a.width &&
                y >= a.y && y <= a.y + a.height,
            );
            if (viscGauge) {
              const probeBottom = viscGauge.y + viscGauge.height;
              const probeCX = viscGauge.x + viscGauge.width / 2;
              const beakerUnder = apparatus.find(
                (a) =>
                  a.id !== viscGauge.id &&
                  (a.type === "beaker" || a.type === "cylinder") &&
                  probeCX >= a.x && probeCX <= a.x + a.width &&
                  probeBottom >= a.y && probeBottom <= a.y + a.height,
              );
              if (beakerUnder && !viscGauge.data?.isViscosityActive) {
                // Start measurement — spin spindle for 3 s
                setApparatus((prev) =>
                  prev.map((a) =>
                    a.id === viscGauge.id
                      ? { ...a, data: { ...a.data, isViscosityActive: true, viscosityReading: 0 } }
                      : a,
                  ),
                );
                setTimeout(() => {
                  setApparatus((prev) =>
                    prev.map((a) =>
                      a.id === viscGauge.id
                        ? { ...a, data: { ...a.data, isViscosityActive: false } }
                        : a,
                    ),
                  );
                }, 3000);
                return;
              }
            }

            // Stirring rod click is handled by hold-to-stir in mouseDown — skip here

            const clicked = apparatus.find(
              (a) =>
                x >= a.x &&
                x <= a.x + a.width &&
                y >= a.y &&
                y <= a.y + a.height,
            );
            if (clicked) {
              if (clicked.type === "hotplate") {
                // Check if click landed on the power button
                const topH = clicked.height * 0.42;
                const frontH = clicked.height - topH;
                const btnR = Math.min(frontH * 0.34, 12);
                const btnCX = clicked.x + btnR + 5;
                const btnCY = clicked.y + topH + frontH / 2;
                const dx = x - btnCX;
                const dy = y - btnCY;
                if (Math.sqrt(dx * dx + dy * dy) <= btnR + 4) {
                  // Toggle power on/off
                  setApparatus((prev) =>
                    prev.map((a) =>
                      a.type === "hotplate"
                        ? {
                            ...a,
                            data: {
                              ...a.data,
                              isOn: !a.data?.isOn,
                              temperature: a.data?.isOn ? 25 : (a.data?.temperature ?? 25),
                            },
                          }
                        : a,
                    ),
                  );
                  return;
                }
                // Clicked elsewhere on the hot plate — open settings modal
                setSelectedApparatus(clicked);
                setShowHotPlateModal(true);
                return;
              }
              setSelectedApparatus(clicked);
            }
          }}
          onDoubleClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const clicked = apparatus.find(
              (a) =>
                x >= a.x &&
                x <= a.x + a.width &&
                y >= a.y &&
                y <= a.y + a.height,
            );
            if (clicked) {
              if (clicked.type === "bottle" || clicked.type === "container") {
                setShowLidModal({ id: clicked.id });
              }
              // Info modal removed — protocol workbook covers apparatus information
            }
          }}
        />
      </div>
      {/* ── Pour Modal ─────────────────────────────────────────────────────── */}
      {showPourModal &&
        (() => {
          const source = apparatus.find((a) => a.id === showPourModal.sourceId);
          const target = apparatus.find((a) => a.id === showPourModal.targetId);
          if (!source || !target) return null;
          const available    = source.data?.currentVolume || 0;
          const targetMax    = target.data?.maxVolume || 0;
          const targetCurrent = target.data?.currentVolume || 0;
          const maxPour      = Math.min(available, targetMax - targetCurrent);
          const currentAmount = selectedPourAmount > 0 && selectedPourAmount <= maxPour
            ? selectedPourAmount : maxPour;
          const pct = maxPour > 0 ? (currentAmount / maxPour) * 100 : 100;
          const liquidColor = source.data?.liquidColor || "rgba(56,189,248,0.7)";

          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
              zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#0f172a", borderRadius:20,
                width:"min(440px, 95vw)", boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
                border:"1px solid #1e293b", overflow:"hidden" }}>

                {/* ── Header ── */}
                <div style={{ background:"linear-gradient(135deg,#0d1b2e,#162032)",
                  padding:"20px 24px 16px", borderBottom:"1px solid #1e293b" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:42, height:42, borderRadius:12,
                      background: liquidColor, border:"2px solid rgba(255,255,255,0.15)",
                      flexShrink:0 }} />
                    <div>
                      <div style={{ color:"white", fontWeight:800, fontSize:17 }}>Pour Liquid</div>
                      <div style={{ color:"#64748b", fontSize:12, marginTop:2 }}>
                        Select how much to pour
                      </div>
                    </div>
                  </div>

                </div>

                {/* ── Slider body ── */}
                <div style={{ padding:"22px 24px" }}>

                  {/* Big volume display */}
                  <div style={{ textAlign:"center", marginBottom:20 }}>
                    <div style={{ fontSize:48, fontWeight:900, fontFamily:"monospace", lineHeight:1,
                      background:"linear-gradient(135deg,#60a5fa,#a78bfa)",
                      WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                      {Math.round(currentAmount)}
                    </div>
                    <div style={{ color:"#475569", fontSize:14, fontWeight:600, marginTop:2 }}>
                      mL selected
                    </div>
                  </div>

                  {/* Custom slider */}
                  <div style={{ position:"relative", marginBottom:8 }}>
                    {/* Track background */}
                    <div style={{ height:8, borderRadius:4, background:"#1e293b",
                      position:"relative", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:4, width:`${pct}%`,
                        background:"linear-gradient(90deg,#3b82f6,#7c3aed)",
                        transition: isAnimatingPour ? "none" : "width 0.1s" }} />
                    </div>
                    <input type="range" min={1} max={maxPour} step={0.5}
                      value={currentAmount}
                      disabled={isAnimatingPour}
                      onChange={e => setSelectedPourAmount(Number(e.target.value))}
                      style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
                        opacity:0, cursor: isAnimatingPour ? "not-allowed" : "pointer",
                        margin:0, padding:0 }} />
                    {/* Thumb indicator */}
                    <div style={{ position:"absolute", top:"50%", transform:"translate(-50%,-50%)",
                      left:`calc(${pct}% - ${pct * 0.16}px)`,
                      width:20, height:20, borderRadius:"50%",
                      background:"linear-gradient(135deg,#3b82f6,#7c3aed)",
                      border:"3px solid #0f172a",
                      boxShadow:"0 0 0 2px #3b82f6",
                      pointerEvents:"none",
                      transition: isAnimatingPour ? "none" : "left 0.1s" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    fontSize:11, color:"#334155", marginBottom:18 }}>
                    <span>1 mL</span>
                    <span>{Math.round(maxPour)} mL (max)</span>
                  </div>

                  {/* Quick preset buttons */}
                  <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                    {[25, 50, 75, 100].map(p => {
                      // 100% uses exact available volume so nothing is left behind
                      const val = p === 100 ? maxPour : Math.max(1, Math.round(maxPour * p / 100));
                      const active = Math.round(currentAmount) === val;
                      return (
                        <button key={p}
                          disabled={isAnimatingPour}
                          onClick={() => setSelectedPourAmount(val)}
                          style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                            cursor: isAnimatingPour ? "not-allowed" : "pointer",
                            background: active
                              ? "linear-gradient(135deg,#1d4ed8,#7c3aed)"
                              : "#1e293b",
                            color: active ? "white" : "#64748b",
                            fontWeight:700, fontSize:12,
                            boxShadow: active ? "0 2px 10px rgba(59,130,246,0.4)" : "none",
                            transition:"all 0.15s" }}>
                          {p}%
                        </button>
                      );
                    })}
                  </div>

                  {/* Pour progress bar (visible during animation) */}
                  {isAnimatingPour && (
                    <div style={{ marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between",
                        fontSize:11, color:"#64748b", marginBottom:4 }}>
                        <span>Pouring…</span>
                        <span style={{ color:"#60a5fa" }}>Please wait</span>
                      </div>
                      <div style={{ height:4, borderRadius:2, background:"#1e293b", overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:2,
                          background:"linear-gradient(90deg,#3b82f6,#7c3aed)",
                          animation:"pour-progress 1.2s ease-in-out infinite" }} />
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:10 }}>
                    <button
                      disabled={isAnimatingPour}
                      style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none",
                        cursor: isAnimatingPour ? "not-allowed" : "pointer",
                        background: isAnimatingPour
                          ? "#1e293b"
                          : "linear-gradient(135deg,#1d4ed8,#7c3aed)",
                        color: isAnimatingPour ? "#475569" : "white",
                        fontWeight:800, fontSize:15, letterSpacing:0.5,
                        boxShadow: isAnimatingPour ? "none" : "0 4px 18px rgba(37,99,235,0.45)",
                        transition:"all 0.15s" }}
                      onClick={() => {
                    pushHistory(); // ← snapshot before pour
                    const amount    = currentAmount;
                    // Snapshot source state at pour-start so fractions are stable
                    const srcStartVol  = source.data?.currentVolume ?? amount;
                    const srcOrigComp  = { ...(source.data?.composition ?? {}) } as Record<string, number>;
                    const ingredientKey = BOTTLE_INGREDIENT[source.id];

                    setIsAnimatingPour(true);
                    let progress = 0;
                    const steps  = 60;
                    const addVol = amount / steps;

                    const animate = () => {
                      progress += 1 / steps;
                      setApparatus((prev) =>
                        prev.map((a) => {
                          // ── Source: drain volume only (composition handled at end) ──
                          if (a.id === source.id) {
                            return {
                              ...a,
                              data: {
                                ...a.data,
                                isPouring: true,
                                pouringTargetId: target.id,
                                pouringProgress: progress,
                                currentVolume: Math.max(0, (a.data?.currentVolume || 0) - addVol),
                              },
                            };
                          }

                          // ── Target: accumulate composition step by step ──
                          if (a.id === target.id) {
                            const prevVol = a.data?.currentVolume || 0;
                            const newVol  = Math.min(a.data?.maxVolume || 1000, prevVol + addVol);

                            // Temperature: volume-weighted blend using source snapshot temp
                            const srcTemp = source.data?.liquidTemperature ?? 25;
                            const tgtTemp = a.data?.liquidTemperature ?? 25;
                            const blendedTemp = prevVol > 0
                              ? (prevVol * tgtTemp + addVol * srcTemp) / newVol
                              : srcTemp;

                            // Composition: use CONSTANT fraction (addVol / srcStartVol) so
                            // the 60 steps sum to exactly (amount/srcStartVol) of srcOrigComp.
                            // This prevents the exploding-denominator bug.
                            const prevComp = (a.data?.composition ?? {}) as Record<string, number>;
                            let newComp: Record<string, number>;
                            if (ingredientKey) {
                              // Bottle → one known ingredient
                              newComp = { ...prevComp, [ingredientKey]: (prevComp[ingredientKey] ?? 0) + addVol };
                            } else {
                              // Beaker/cylinder → distribute by stable fraction
                              const frac = srcStartVol > 0 ? addVol / srcStartVol : 0;
                              newComp = { ...prevComp };
                              for (const [k, v] of Object.entries(srcOrigComp)) {
                                newComp[k] = (newComp[k] ?? 0) + v * frac;
                              }
                            }

                            // pH & viscosity: volume-weighted blend
                            const srcPH   = source.data?.pH   ?? 7.0;
                            const srcVisc = source.data?.viscosity ?? 1;
                            const tgtPH   = a.data?.pH   ?? srcPH;
                            const tgtVisc = a.data?.viscosity ?? srcVisc;
                            const blendedPH   = prevVol > 0 ? (prevVol * tgtPH   + addVol * srcPH)   / newVol : srcPH;
                            const blendedVisc = prevVol > 0 ? (prevVol * tgtVisc + addVol * srcVisc) / newVol : srcVisc;

                            return {
                              ...a,
                              data: {
                                ...a.data,
                                currentVolume:     newVol,
                                liquidColor:       source.data?.liquidColor || "rgba(56, 189, 248, 0.6)",
                                liquidTemperature: blendedTemp,
                                pH:                blendedPH,
                                viscosity:         blendedVisc,
                                composition:       newComp,
                              },
                            };
                          }
                          return a;
                        }),
                      );

                      if (progress < 1) {
                        setTimeout(animate, 18);
                      } else {
                        // Animation done — finalise source and target
                        const keepFrac = srcStartVol > 0
                          ? Math.max(0, 1 - amount / srcStartVol)
                          : 0;
                        setApparatus((prev) =>
                          prev.map((a) => {
                            if (a.id === source.id) {
                              // Reduce source composition by the poured fraction
                              const srcComp = (a.data?.composition ?? {}) as Record<string, number>;
                              const reducedComp: Record<string, number> = {};
                              for (const [k, v] of Object.entries(srcComp)) {
                                const rem = v * keepFrac;
                                if (rem > 0.001) reducedComp[k] = rem;
                              }
                              // If virtually all liquid was poured, snap to exactly empty.
                              // Floating-point residue from 60 animation steps can leave
                              // a tiny non-zero currentVolume that shows as "available" liquid.
                              const finalVol = keepFrac < 0.01 ? 0 : a.data?.currentVolume;
                              return {
                                ...a,
                                data: {
                                  ...a.data,
                                  currentVolume:    finalVol,
                                  isPouring:        false,
                                  pouringTargetId:  null,
                                  pouringProgress:  0,
                                  composition:      reducedComp,
                                },
                              };
                            }
                            if (a.id === target.id) {
                              const hist = [...(a.data?.pouringSourceHistory ?? [])];
                              if (!hist.includes(source.id)) hist.push(source.id);
                              return { ...a, data: { ...a.data, pouringSourceHistory: hist } };
                            }
                            return a;
                          }),
                        );
                        setIsAnimatingPour(false);
                        setShowPourModal(null);
                        setSelectedPourAmount(0);
                      }
                    };
                    animate();
                  }}
                    >
                      {isAnimatingPour ? "Pouring…" : `⬇ Pour ${Math.round(currentAmount)} mL`}
                    </button>
                    <button
                      disabled={isAnimatingPour}
                      style={{ padding:"13px 18px", borderRadius:12, border:"none",
                        cursor: isAnimatingPour ? "not-allowed" : "pointer",
                        background:"#1e293b", color:"#64748b",
                        fontWeight:700, fontSize:14 }}
                      onClick={() => setShowPourModal(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      {showHotPlateModal &&
        (() => {
          const hp = apparatus.find((a) => a.type === "hotplate");
          if (!hp) return null;
          const currentTemp = Math.round(hp.data?.temperature ?? 25);
          const targetTemp  = hp.data?.targetTemperature ?? 200;
          const isOn        = hp.data?.isOn ?? false;
          const pct = ((targetTemp - 25) / (500 - 25)) * 100;

          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
              zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#0f172a", borderRadius:20,
                width:"min(440px,95vw)", boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
                border:"1px solid #1e293b", overflow:"hidden" }}>

                {/* Header */}
                <div style={{ background:"linear-gradient(135deg,#0d1b2e,#162032)",
                  padding:"20px 24px 16px", borderBottom:"1px solid #1e293b" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:42, height:42, borderRadius:12, flexShrink:0,
                      background: isOn
                        ? "linear-gradient(135deg,#ea580c,#dc2626)"
                        : "linear-gradient(135deg,#374151,#1f2937)",
                      border:"2px solid rgba(255,255,255,0.15)",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:22 }}>🔥</div>
                    <div>
                      <div style={{ color:"white", fontWeight:800, fontSize:17 }}>Hot Plate Control</div>
                      <div style={{ display:"flex", alignItems:"center", gap:6, marginTop:4 }}>
                        <span style={{ width:8, height:8, borderRadius:"50%", flexShrink:0,
                          background: isOn ? "#22c55e" : "#6b7280",
                          boxShadow: isOn ? "0 0 6px #22c55e" : "none" }} />
                        <span style={{ color:"#64748b", fontSize:12, fontFamily:"monospace" }}>
                          {isOn ? "HEATING" : "OFF"} — {currentTemp}°C actual
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div style={{ padding:"22px 24px" }}>

                  {/* Big temperature display */}
                  <div style={{ textAlign:"center", marginBottom:20 }}>
                    <div style={{ fontSize:48, fontWeight:900, fontFamily:"monospace", lineHeight:1,
                      background: isOn
                        ? "linear-gradient(135deg,#f97316,#ef4444)"
                        : "linear-gradient(135deg,#60a5fa,#a78bfa)",
                      WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                      {targetTemp}°C
                    </div>
                    <div style={{ color:"#475569", fontSize:14, fontWeight:600, marginTop:2 }}>
                      target temperature
                    </div>
                  </div>

                  {/* Slider */}
                  <div style={{ position:"relative", marginBottom:8 }}>
                    <div style={{ height:8, borderRadius:4, background:"#1e293b",
                      position:"relative", overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:4, width:`${pct}%`,
                        background: isOn
                          ? "linear-gradient(90deg,#f97316,#ef4444)"
                          : "linear-gradient(90deg,#3b82f6,#7c3aed)" }} />
                    </div>
                    <input type="range" min={25} max={500} step={5} value={targetTemp}
                      style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
                        opacity:0, cursor:"pointer", margin:0, padding:0 }}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setApparatus(prev => prev.map(a =>
                          a.type === "hotplate"
                            ? { ...a, data: { ...a.data, targetTemperature: val } }
                            : a
                        ));
                      }} />
                    <div style={{ position:"absolute", top:"50%", transform:"translate(-50%,-50%)",
                      left:`calc(${pct}% - ${pct * 0.16}px)`,
                      width:20, height:20, borderRadius:"50%",
                      background: isOn
                        ? "linear-gradient(135deg,#f97316,#ef4444)"
                        : "linear-gradient(135deg,#3b82f6,#7c3aed)",
                      border:"3px solid #0f172a",
                      boxShadow: isOn ? "0 0 0 2px #f97316" : "0 0 0 2px #3b82f6",
                      pointerEvents:"none" }} />
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between",
                    fontSize:11, color:"#334155", marginBottom:18 }}>
                    <span>25°C (ambient)</span>
                    <span>500°C (max)</span>
                  </div>

                  {/* Preset buttons */}
                  <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                    {[60, 75, 100, 200].map(t => {
                      const active = targetTemp === t;
                      return (
                        <button key={t}
                          onClick={() => setApparatus(prev => prev.map(a =>
                            a.type === "hotplate" ? { ...a, data: { ...a.data, targetTemperature: t } } : a
                          ))}
                          style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none",
                            cursor:"pointer", fontSize:12, fontWeight:700,
                            background: active
                              ? (isOn ? "linear-gradient(135deg,#ea580c,#dc2626)" : "linear-gradient(135deg,#1d4ed8,#7c3aed)")
                              : "#1e293b",
                            color: active ? "white" : "#475569" }}>
                          {t}°C
                        </button>
                      );
                    })}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display:"flex", gap:10 }}>
                    <button
                      onClick={() => {
                        pushHistory();
                        setApparatus(prev => prev.map(a =>
                          a.type === "hotplate"
                            ? { ...a, data: { ...a.data, isOn: !isOn,
                                temperature: isOn ? 25 : (a.data?.temperature ?? 25) } }
                            : a
                        ));
                        setShowHotPlateModal(false);
                      }}
                      style={{ flex:1, padding:"13px 0", borderRadius:11, border:"none",
                        fontWeight:800, fontSize:14, cursor:"pointer",
                        background: isOn
                          ? "linear-gradient(135deg,#dc2626,#991b1b)"
                          : "linear-gradient(135deg,#ea580c,#dc2626)",
                        color:"white",
                        boxShadow: isOn
                          ? "0 4px 18px rgba(220,38,38,0.45)"
                          : "0 4px 18px rgba(234,88,12,0.45)" }}>
                      {isOn ? "⏹ Turn OFF" : "▶ Turn ON"}
                    </button>
                    <button
                      onClick={() => setShowHotPlateModal(false)}
                      style={{ padding:"13px 20px", borderRadius:11, border:"1px solid #334155",
                        fontWeight:700, fontSize:14, cursor:"pointer",
                        background:"transparent", color:"#64748b" }}>
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

      {showLidModal &&
        (() => {
          const item = apparatus.find((a) => a.id === showLidModal.id);
          if (!item) return null;
          const isOpen = !item.data?.hasLid;  // true = currently open (no lid on)
          const lidColor = item.data?.lidColor || "#3b82f6";
          const liquidColor = item.data?.liquidColor || "rgba(56,189,248,0.5)";

          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)",
              zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#0f172a", border:`1px solid ${isOpen ? "#334155" : "#1e3a5f"}`,
                borderRadius:18, width:"min(380px,94vw)",
                boxShadow:"0 24px 80px rgba(0,0,0,0.8)", overflow:"hidden" }}>

                {/* ── Coloured header strip ── */}
                <div style={{ padding:"20px 22px 16px",
                  background: isOpen
                    ? "linear-gradient(135deg,#1c2535,#0f172a)"
                    : "linear-gradient(135deg,#0d1b2e,#162032)",
                  borderBottom:"1px solid #1e293b" }}>

                  {/* Bottle + lid icon row */}
                  <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
                    {/* Mini bottle visual */}
                    <div style={{ position:"relative", width:36, height:52, flexShrink:0 }}>
                      <div style={{ position:"absolute", bottom:0, left:4, right:4, height:36,
                        borderRadius:4, background:liquidColor, border:"1.5px solid rgba(255,255,255,0.18)" }} />
                      <div style={{ position:"absolute", bottom:34, left:9, right:9, height:12,
                        borderRadius:"2px 2px 0 0",
                        background: isOpen ? "rgba(255,255,255,0.05)" : lidColor,
                        border: isOpen ? "1.5px dashed #475569" : `1.5px solid ${lidColor}` }} />
                      {/* Lid sitting to the side if open */}
                      {isOpen && (
                        <div style={{ position:"absolute", top:0, right:-12, width:18, height:10,
                          borderRadius:3, background:lidColor, border:`1px solid ${lidColor}`,
                          opacity:0.8, transform:"rotate(-15deg)" }} />
                      )}
                    </div>

                    <div>
                      <div style={{ color:"white", fontWeight:800, fontSize:16 }}>{item.name}</div>
                      <div style={{ marginTop:4, display:"inline-flex", alignItems:"center", gap:6,
                        background: isOpen ? "rgba(71,85,105,0.3)" : "rgba(59,130,246,0.15)",
                        border: `1px solid ${isOpen ? "#475569" : "#3b82f6"}`,
                        borderRadius:20, padding:"3px 10px" }}>
                        <span style={{ fontSize:13 }}>{isOpen ? "🔓" : "🔒"}</span>
                        <span style={{ color: isOpen ? "#94a3b8" : "#7dd3fc",
                          fontSize:11, fontWeight:700 }}>
                          {isOpen ? "Lid removed" : "Lid on — sealed"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ color:"#94a3b8", fontSize:13, lineHeight:1.6 }}>
                    {isOpen
                      ? "The container is open. Put the lid back to seal it, or leave it open to pour."
                      : "The container is sealed. Remove the lid before you can pour from it."}
                  </div>
                </div>

                {/* ── Action buttons ── */}
                <div style={{ padding:"16px 22px", display:"flex", flexDirection:"column", gap:10 }}>
                  {/* Primary action */}
                  <button
                    onClick={() => {
                      setApparatus(prev =>
                        prev.map(a => a.id === item.id
                          ? { ...a, data: { ...a.data, hasLid: isOpen } } : a)
                      );
                      setShowLidModal(null);
                    }}
                    style={{ width:"100%", padding:"12px 0", borderRadius:12, border:"none",
                      cursor:"pointer", fontWeight:800, fontSize:15, letterSpacing:0.3,
                      background: isOpen
                        ? `linear-gradient(135deg,${lidColor},${lidColor}cc)`
                        : "linear-gradient(135deg,#1d4ed8,#2563eb)",
                      color:"white",
                      boxShadow: isOpen
                        ? `0 4px 16px ${lidColor}55`
                        : "0 4px 16px rgba(37,99,235,0.45)" }}
                  >
                    {isOpen ? "🔒  Replace Lid" : "🔓  Remove Lid"}
                  </button>

                  {/* Cancel */}
                  <button
                    onClick={() => setShowLidModal(null)}
                    style={{ width:"100%", padding:"10px 0", borderRadius:12, border:"none",
                      cursor:"pointer", fontWeight:600, fontSize:14,
                      background:"#1e293b", color:"#64748b" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Right-click context menu for bottles ─────────────────────────────── */}
      {lidContextMenu &&
        (() => {
          const item = apparatus.find((a) => a.id === lidContextMenu.id);
          if (!item) return null;
          const isOpen = !item.data?.hasLid;
          return (
            <>
              {/* Invisible backdrop to catch outside clicks */}
              <div style={{ position:"fixed", inset:0, zIndex:149 }}
                onClick={() => setLidContextMenu(null)} />
              <div style={{ position:"fixed", left: lidContextMenu.x, top: lidContextMenu.y,
                zIndex:150, background:"#0f172a", border:"1px solid #334155",
                borderRadius:10, boxShadow:"0 8px 30px rgba(0,0,0,0.7)",
                minWidth:200, overflow:"hidden" }}>
                {/* Header */}
                <div style={{ padding:"10px 14px", borderBottom:"1px solid #1e293b",
                  color:"#64748b", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:0.8 }}>
                  {item.name}
                </div>
                {/* Close / Open lid option */}
                <button
                  style={{ width:"100%", padding:"10px 14px", background:"transparent", border:"none",
                    cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10,
                    color:"#e2e8f0", fontSize:13, fontWeight:600 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => {
                    setApparatus((prev) =>
                      prev.map((a) => a.id === item.id
                        ? { ...a, data: { ...a.data, hasLid: isOpen } } : a)
                    );
                    setLidContextMenu(null);
                  }}
                >
                  <span style={{ fontSize:16 }}>{isOpen ? "🔒" : "🔓"}</span>
                  {isOpen ? "Close Lid" : "Open Lid"}
                </button>
                {/* Cancel */}
                <button
                  style={{ width:"100%", padding:"10px 14px", background:"transparent", border:"none",
                    cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10,
                    color:"#64748b", fontSize:13, borderTop:"1px solid #1e293b" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                  onClick={() => setLidContextMenu(null)}
                >
                  <span style={{ fontSize:16 }}>✕</span>
                  Cancel
                </button>
              </div>
            </>
          );
        })()}

      {/* ── Move-to context menu (shelf → destination) ───────────────────── */}
      {moveMenu && (() => {
        const item = apparatus.find(a => a.id === moveMenu.id);
        if (!item) return null;

        // Only show move menu for items currently on the shelf
        const onShelf = Math.abs((item.y + item.height) - shelfY) < 25;
        if (!onShelf) return null;

        // Fixed apparatus cannot be moved
        const FIXED = new Set(["hot-plate-1","ice-bucket","weight-balance"]);
        if (FIXED.has(item.id)) return null;

        // Original positions from initial state
        const origList = getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y);
        const orig = origList.find(a => a.id === item.id);
        const shelfPos = orig ? { x: orig.x, y: orig.y } : { x: item.x, y: shelfY - item.height };

        // Table position: centre the item on the right half of the table
        const tablePos = { x: item.x, y: TABLE_Y - item.height };

        const hotPlate   = apparatus.find(a => a.type === "hotplate");
        const iceBucket  = apparatus.find(a => a.type === "icebucket");
        const balance    = apparatus.find(a => a.type === "weightbalance");
        const mainBeaker = apparatus.find(a => a.id === "beaker-500-main");
        const oilBeaker  = apparatus.find(a => a.id === "beaker-250-oil");
        const aqBeaker   = apparatus.find(a => a.id === "beaker-250-aqueous");

        const snapOnto = (tgt: typeof hotPlate, surfaceFrac = 0) => {
          if (!tgt) return null;
          return { x: tgt.x + (tgt.width - item.width) / 2, y: tgt.y + tgt.height * surfaceFrac - item.height };
        };
        // dockInto: places probe instruments INSIDE the beaker.
        // The rod/probe tip floats in the liquid — well above the base (15% padding zone)
        // and below the typical liquid surface so it's visibly submerged.
        // 72% of beaker height from top = ~13% above the usable floor (85%).
        const dockInto = (tgt: typeof mainBeaker, slotOffset = 0) => {
          if (!tgt) return null;
          const beakerInnerBot = tgt.y + tgt.height * 0.72;
          const iy = beakerInnerBot - item.height;
          // Horizontal: centre ± slot offset to avoid exact overlap
          const ix = tgt.x + (tgt.width - item.width) / 2 + slotOffset;
          return { x: ix, y: iy };
        };

        // Compute slot offsets so multiple probes don't land on same pixel
        const usedSlots = (tgt: typeof mainBeaker) => {
          if (!tgt) return 0;
          return apparatus.filter(a =>
            a.id !== item.id &&
            ["thermometer","phmeter","viscositygauge","stirringrod"].includes(a.type) &&
            Math.abs(a.x + a.width/2 - (tgt.x + tgt.width/2)) < tgt.width
          ).length;
        };
        const slotW = 8; // horizontal gap between co-docked instruments

        type Dest = { label: string; icon: string; pos: { x:number; y:number } | null };

        const DESTS: Record<string, Dest[]> = {
          beaker: [
            { label:"Table",          icon:"🪑", pos: tablePos },
            { label:"Hot Plate",      icon:"🔥", pos: snapOnto(hotPlate) },
            { label:"Ice Bucket",     icon:"🧊", pos: snapOnto(iceBucket, 0.08) },
            { label:"Weight Balance", icon:"⚖️", pos: snapOnto(balance, 0.60) },
          ],
          cylinder: [
            { label:"Table", icon:"🪑", pos: tablePos },
          ],
          thermometer: [
            { label:"Oil Beaker",   icon:"🧪", pos: dockInto(oilBeaker,  usedSlots(oilBeaker)  * slotW) },
            { label:"Aqueous Beaker", icon:"🧪", pos: dockInto(aqBeaker, usedSlots(aqBeaker)   * slotW) },
            { label:"Mixing Beaker",  icon:"🧪", pos: dockInto(mainBeaker, usedSlots(mainBeaker) * slotW) },
          ],
          stirringrod: [
            { label:"Oil Beaker",    icon:"🧪", pos: dockInto(oilBeaker,  usedSlots(oilBeaker)  * slotW) },
            { label:"Aqueous Beaker",icon:"🧪", pos: dockInto(aqBeaker,   usedSlots(aqBeaker)   * slotW) },
            { label:"Mixing Beaker", icon:"🧪", pos: dockInto(mainBeaker, usedSlots(mainBeaker) * slotW) },
          ],
          phmeter:       [{ label:"Mixing Beaker", icon:"🧪", pos: dockInto(mainBeaker, usedSlots(mainBeaker) * slotW) }],
          viscositygauge:[{ label:"Mixing Beaker", icon:"🧪", pos: dockInto(mainBeaker, usedSlots(mainBeaker) * slotW) }],
          spatula:       [{ label:"Stearic Acid",  icon:"🧂", pos: (() => { const b = apparatus.find(a => a.id==="container-stearic-acid"); return b ? { x: b.x + (b.width-item.width)/2, y: b.y } : null; })() }],
        };

        const dests: Dest[] = (DESTS[item.type] ?? []).filter(d => d.pos !== null);

        return (
          <>
            <div style={{ position:"fixed", inset:0, zIndex:149 }}
              onClick={() => setMoveMenu(null)} />
            <div style={{ position:"fixed", left: moveMenu.x, top: moveMenu.y,
              zIndex:150, background:"#0f172a", border:"1px solid #334155",
              borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
              minWidth:220, overflow:"hidden" }}>

              <div style={{ padding:"10px 14px", borderBottom:"1px solid #1e293b", background:"#080f1e" }}>
                <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700,
                  textTransform:"uppercase", letterSpacing:0.8 }}>Move to…</div>
                <div style={{ color:"white", fontWeight:700, fontSize:13, marginTop:2 }}>{item.name}</div>
              </div>

              {dests.map(d => (
                <button key={d.label}
                  style={{ width:"100%", padding:"11px 14px", background:"transparent",
                    border:"none", cursor:"pointer", textAlign:"left",
                    display:"flex", alignItems:"center", gap:10,
                    color:"#e2e8f0", fontSize:13, fontWeight:600,
                    borderBottom:"1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => (e.currentTarget.style.background="#1e293b")}
                  onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                  onClick={() => {
                    if (!d.pos) return;
                    setApparatus(prev => prev.map(a =>
                      a.id === item.id ? { ...a, x: d.pos!.x, y: d.pos!.y } : a
                    ));
                    setMoveMenu(null);
                  }}>
                  <span style={{ fontSize:18 }}>{d.icon}</span>
                  <span>{d.label}</span>
                </button>
              ))}

              <button style={{ width:"100%", padding:"10px 14px", background:"transparent",
                border:"none", cursor:"pointer", textAlign:"left",
                display:"flex", alignItems:"center", gap:10,
                color:"#64748b", fontSize:13, borderTop:"1px solid #1e293b" }}
                onMouseEnter={e => (e.currentTarget.style.background="#1e293b")}
                onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                onClick={() => setMoveMenu(null)}>
                <span style={{ fontSize:18 }}>✕</span><span>Cancel</span>
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Move-to context menu (table/hotplate/icebucket → shelf) ──────── */}
      {moveMenu && (() => {
        const item = apparatus.find(a => a.id === moveMenu.id);
        if (!item) return null;
        const onShelf = Math.abs((item.y + item.height) - shelfY) < 25;
        if (onShelf) return null; // handled by the shelf menu above
        const FIXED = new Set(["hot-plate-1","ice-bucket","weight-balance"]);
        if (FIXED.has(item.id)) return null;
        // Only movable types
        const MOVABLE = new Set(["beaker","cylinder","thermometer","stirringrod","phmeter","viscositygauge","spatula"]);
        if (!MOVABLE.has(item.type)) return null;

        const origList = getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y);
        const orig = origList.find(a => a.id === item.id);
        const shelfPos = orig ? { x: orig.x, y: orig.y } : { x: item.x, y: shelfY - item.height };

        return (
          <>
            <div style={{ position:"fixed", inset:0, zIndex:149 }}
              onClick={() => setMoveMenu(null)} />
            <div style={{ position:"fixed", left: moveMenu.x, top: moveMenu.y,
              zIndex:150, background:"#0f172a", border:"1px solid #334155",
              borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.7)",
              minWidth:220, overflow:"hidden" }}>

              <div style={{ padding:"10px 14px", borderBottom:"1px solid #1e293b", background:"#080f1e" }}>
                <div style={{ color:"#94a3b8", fontSize:10, fontWeight:700,
                  textTransform:"uppercase", letterSpacing:0.8 }}>Return…</div>
                <div style={{ color:"white", fontWeight:700, fontSize:13, marginTop:2 }}>{item.name}</div>
              </div>

              <button
                style={{ width:"100%", padding:"11px 14px", background:"transparent",
                  border:"none", cursor:"pointer", textAlign:"left",
                  display:"flex", alignItems:"center", gap:10,
                  color:"#e2e8f0", fontSize:13, fontWeight:600 }}
                onMouseEnter={e => (e.currentTarget.style.background="#1e293b")}
                onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                onClick={() => {
                  setApparatus(prev => prev.map(a =>
                    a.id === item.id ? { ...a, x: shelfPos.x, y: shelfPos.y } : a
                  ));
                  setMoveMenu(null);
                }}>
                <span style={{ fontSize:18 }}>📦</span>
                <span>Return to Shelf</span>
              </button>

              <button style={{ width:"100%", padding:"10px 14px", background:"transparent",
                border:"none", cursor:"pointer", textAlign:"left",
                display:"flex", alignItems:"center", gap:10,
                color:"#64748b", fontSize:13, borderTop:"1px solid #1e293b" }}
                onMouseEnter={e => (e.currentTarget.style.background="#1e293b")}
                onMouseLeave={e => (e.currentTarget.style.background="transparent")}
                onClick={() => setMoveMenu(null)}>
                <span style={{ fontSize:18 }}>✕</span><span>Cancel</span>
              </button>
            </div>
          </>
        );
      })()}

      <ProtocolSidebar
        isOpen={showProtocolSidebar}
        onClose={() => setShowProtocolSidebar(false)}
        apparatus={apparatus}
        practicalId={practicalId}
      />

      {/* Lab Workbook Toggle Button */}
      <button
        onClick={() => setShowProtocolSidebar(!showProtocolSidebar)}
        style={{
          position: "absolute", top: 14, right: 24, zIndex: 50,
          background: showProtocolSidebar ? "#1e293b" : "linear-gradient(135deg,#1d4ed8,#7c3aed)",
          color: "white", border: "none", borderRadius: 10,
          padding: "9px 18px", fontWeight: 700, fontSize: 13,
          cursor: "pointer", boxShadow: "0 2px 12px rgba(0,0,0,0.4)", letterSpacing: 0.3,
        }}
      >
        📋 {showProtocolSidebar ? "Close Workbook" : "Lab Workbook"}
      </button>

      {/* Spatula Scoop Modal */}
      {showScoopModal && (() => {
        const src        = apparatus.find((a) => a.id === showScoopModal.sourceId);
        if (!src) return null;
        const isBeeswaxScoop = showScoopModal.sourceId === "container-beeswax";
        const solidName      = isBeeswaxScoop ? "Beeswax" : "Stearic Acid";
        const baseAmount     = isBeeswaxScoop ? 12 : 18;
        const targetGrams    = +(baseAmount * multiplier).toFixed(1);
        const density        = src.data?.density ?? (isBeeswaxScoop ? 0.96 : 0.847);
        return (
          <div style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",zIndex:200,display:"flex",alignItems:"center",justifyContent:"center" }}>
            <div style={{ background:"white",borderRadius:14,padding:32,minWidth:340,boxShadow:"0 8px 40px #0003" }}>
              <h2 style={{ fontWeight:700,fontSize:18,marginBottom:8 }}>Scoop {solidName}</h2>
              <p style={{ color:"#475569",fontSize:14,marginBottom:4 }}>
                Measure <b>solid {solidName.toLowerCase()}</b> into the beaker.
              </p>
              {/* Assignment target hint */}
              {assignment && (
                <div style={{ background:"#eff6ff", border:"1px solid #bfdbfe", borderRadius:8,
                  padding:"8px 12px", marginBottom:12, fontSize:13, color:"#1d4ed8" }}>
                  🎯 Assignment target: <strong>{targetGrams} g</strong>
                  <span style={{ color:"#6b7280", fontWeight:400 }}> ({assignment.targetGrams} g cream × {multiplier})</span>
                </div>
              )}
              <p style={{ color:"#64748b",fontSize:13,marginBottom:20 }}>
                Available: <b>{Math.round((src.data?.currentVolume ?? 0) * density)} g</b>
              </p>
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex",alignItems:"center",gap:14,marginBottom:8 }}>
                  <input type="range" min={1} max={showScoopModal.maxGrams} value={selectedScoopGrams}
                    style={{ flex:1 }}
                    onChange={(e) => setSelectedScoopGrams(+e.target.value)} />
                  <span style={{ minWidth:64,background:"#1e3a5f",color:"#7dd3fc",fontFamily:"monospace",fontWeight:700,fontSize:16,borderRadius:8,padding:"4px 10px",textAlign:"center" }}>
                    {selectedScoopGrams} g
                  </span>
                </div>
                <div style={{ display:"flex",justifyContent:"space-between",fontSize:11,color:"#94a3b8" }}>
                  <span>1 g</span><span>{showScoopModal.maxGrams} g</span>
                </div>
              </div>
              <div style={{ display:"flex",gap:12 }}>
                <button
                  style={{ flex:1,background:"#92400e",color:"white",border:"none",borderRadius:8,padding:"10px 0",fontWeight:700,fontSize:14,cursor:"pointer" }}
                  onClick={() => {
                    pushHistory(); // ← snapshot before scoop
                    const grams = selectedScoopGrams;
                    const volRemoved = grams / (src.data?.density ?? 0.847);
                    setApparatus((prev) => prev.map((a) => {
                      if (a.id === showScoopModal.sourceId)
                        return { ...a, data: { ...a.data, currentVolume: Math.max(0, (a.data?.currentVolume ?? 0) - volRemoved) } };
                      if (a.id === showScoopModal.spatulaId)
                        return { ...a, data: { ...a.data, spatulaLoad: grams, spatulaLoadSourceId: showScoopModal.sourceId } };
                      return a;
                    }));
                    setShowScoopModal(null);
                  }}
                >
                  Scoop {selectedScoopGrams} g
                </button>
                <button
                  style={{ padding:"10px 20px",background:"#e2e8f0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600 }}
                  onClick={() => setShowScoopModal(null)}
                >Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Evaluate Formulation Button — top bar, left of Lab Workbook button */}
      <button
        onClick={() => setShowEvaluationPanel(true)}
        style={{
          position: "absolute",
          top: 14,
          right: 210,
          background: "linear-gradient(135deg, #1d4ed8, #7c3aed)",
          color: "white",
          border: "none",
          borderRadius: 10,
          padding: "9px 18px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          boxShadow: "0 2px 12px rgba(109,40,217,0.45)",
          letterSpacing: 0.3,
          zIndex: 50,
        }}
      >
        ⚗ Evaluate
      </button>

      {/* ── Undo button ─── */}
      <button
        onClick={undo}
        disabled={historyRef.current.length === 0}
        title={historyRef.current.length === 0
          ? "Nothing to undo"
          : `Undo last action (${historyRef.current.length} step${historyRef.current.length > 1 ? "s" : ""} in history)`}
        style={{
          position: "absolute",
          top: 14,
          right: 420,
          background: historyRef.current.length === 0 ? "#1e293b" : "#334155",
          color: historyRef.current.length === 0 ? "#475569" : "#e2e8f0",
          border: "none",
          borderRadius: 10,
          padding: "9px 16px",
          fontWeight: 700,
          fontSize: 13,
          cursor: historyRef.current.length === 0 ? "not-allowed" : "pointer",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "background .15s, color .15s",
        }}
      >
        ↩ Undo
      </button>

      <EvaluationPanel
        isOpen={showEvaluationPanel}
        onClose={() => setShowEvaluationPanel(false)}
        apparatus={apparatus}
        practicalId={practicalId}
        assignment={assignment}
        sessionStartAt={assignment ? (
          (() => { try { const k = "vlab_timer_" + assignment.token; const v = localStorage.getItem(k); return v ? parseInt(v,10) : null; } catch { return null; } })()
        ) : null}
      />

      {/* ── Large floating thermometer display ─────────────────────────────
           Appears beside the thermometer only when its probe is in a beaker. */}
      {(() => {
        const thermo = apparatus.find(a => a.type === "thermometer");
        if (!thermo) return null;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return null;
        const probeBottom = thermo.y + thermo.height;
        const probeCX     = thermo.x + thermo.width / 2;
        const isMeasuring = apparatus.some(
          a => (a.type === "beaker" || a.type === "cylinder") &&
               probeCX    >= a.x && probeCX    <= a.x + a.width &&
               probeBottom >= a.y && probeBottom <= a.y + a.height,
        );
        if (!isMeasuring) return null;

        const temp = thermo.data?.readingTemperature ?? 25;
        const tempStr = temp < 100 ? temp.toFixed(1) : `${Math.round(temp)}`;
        const fluidColor =
          temp > 120 ? "#ef4444"
          : temp > 75 ? "#f97316"
          : temp > 40 ? "#fbbf24"
          : "#60a5fa";

        // Position display to the right of the thermometer
        const dispX = canvasRect.left + thermo.x + thermo.width + 8;
        const dispY = canvasRect.top  + thermo.y;

        return (
          <div style={{
            position: "fixed",
            left: dispX,
            top: dispY,
            zIndex: 55,
            background: "#020b12",
            border: `2px solid ${fluidColor}`,
            borderRadius: 12,
            padding: "8px 14px",
            minWidth: 90,
            boxShadow: `0 4px 20px rgba(0,0,0,0.7), 0 0 12px ${fluidColor}44`,
            pointerEvents: "none",
          }}>
            {/* °C unit */}
            <div style={{ color: `${fluidColor}99`, fontSize: 10, fontWeight: 700,
              textAlign: "right", letterSpacing: 0.5, marginBottom: 2 }}>°C</div>
            {/* Main reading */}
            <div style={{
              color: fluidColor,
              fontSize: 32,
              fontWeight: 900,
              fontFamily: "monospace",
              lineHeight: 1,
              textAlign: "center",
              textShadow: `0 0 12px ${fluidColor}88`,
            }}>
              {tempStr}
            </div>
            {/* Status bar */}
            <div style={{ marginTop: 6, height: 4, borderRadius: 2,
              background: "#1e293b", overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 2,
                width: `${Math.min(temp / 100 * 100, 100)}%`,
                background: `linear-gradient(90deg, #3b82f6, ${fluidColor})`,
                transition: "width 0.3s" }} />
            </div>
            <div style={{ color: "#334155", fontSize: 9, textAlign: "center",
              marginTop: 4, fontWeight: 600, letterSpacing: 0.5 }}>MEASURING</div>
          </div>
        );
      })()}

      {/* ── Large floating pH meter display ── */}
      {(() => {
        const meter = apparatus.find(a => a.type === "phmeter");
        if (!meter) return null;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return null;
        const probeBottom = meter.y + meter.height;
        const probeCX     = meter.x + meter.width / 2;
        const isMeasuring = apparatus.some(
          a => (a.type === "beaker" || a.type === "cylinder") &&
               probeCX >= a.x && probeCX <= a.x + a.width &&
               probeBottom >= a.y && probeBottom <= a.y + a.height,
        );
        if (!isMeasuring) return null;

        const ph = meter.data?.phReading ?? 7.0;
        const phColor =
          ph < 4  ? "#ef4444"
          : ph < 6  ? "#f97316"
          : ph < 7  ? "#eab308"
          : ph < 8  ? "#22c55e"
          : ph < 10 ? "#3b82f6"
          : "#8b5cf6";

        const dispX = canvasRect.left + meter.x + meter.width + 8;
        const dispY = canvasRect.top  + meter.y;

        return (
          <div style={{
            position:"fixed", left:dispX, top:dispY, zIndex:55,
            background:"#020b12", border:`2px solid ${phColor}`,
            borderRadius:12, padding:"8px 14px", minWidth:90,
            boxShadow:`0 4px 20px rgba(0,0,0,0.7), 0 0 12px ${phColor}44`,
            pointerEvents:"none",
          }}>
            <div style={{ color:`${phColor}99`, fontSize:10, fontWeight:700,
              textAlign:"right", letterSpacing:0.5, marginBottom:2 }}>pH</div>
            <div style={{ color:phColor, fontSize:32, fontWeight:900,
              fontFamily:"monospace", lineHeight:1, textAlign:"center",
              textShadow:`0 0 12px ${phColor}88` }}>
              {ph.toFixed(2)}
            </div>
            {/* pH scale strip */}
            <div style={{ marginTop:6, height:5, borderRadius:3, overflow:"hidden",
              background:"linear-gradient(90deg,#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6)" }}>
              <div style={{ position:"relative", height:"100%" }}>
                <div style={{ position:"absolute", top:0, bottom:0, width:3, borderRadius:2,
                  background:"white", left:`${(ph / 14) * 100}%`,
                  transform:"translateX(-50%)" }} />
              </div>
            </div>
            <div style={{ color:"#334155", fontSize:9, textAlign:"center",
              marginTop:4, fontWeight:600, letterSpacing:0.5 }}>MEASURING</div>
          </div>
        );
      })()}

      {/* ── Close-lid hover badge ───────────────────────────────────────────
           Shows a small floating 🔒 button above any open bottle the user
           is hovering over, so they always know how to close the lid.      */}
      {(() => {
        if (!hoveredId || dragging) return null;
        const hovered = apparatus.find(
          (a) => a.id === hoveredId &&
                 (a.type === "bottle" || a.type === "container") &&
                 !a.data?.hasLid &&
                 a.data?.lidColor,   // only bottles that originally had a lid
        );
        if (!hovered) return null;
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return null;
        // Position badge centred above the bottle
        const badgeX = canvasRect.left + hovered.x + hovered.width / 2;
        const badgeY = canvasRect.top  + hovered.y - 10;
        return (
          <button
            onMouseDown={e => e.stopPropagation()}
            onClick={e => {
              e.stopPropagation();
              setApparatus(prev =>
                prev.map(a => a.id === hovered.id
                  ? { ...a, data: { ...a.data, hasLid: true } } : a)
              );
            }}
            style={{
              position: "fixed",
              left: badgeX,
              top:  badgeY,
              transform: "translate(-50%, -100%)",
              zIndex: 60,
              background: "linear-gradient(135deg,#1e3a5f,#0d1b2e)",
              border: "1.5px solid #3b82f6",
              borderRadius: 20,
              padding: "4px 10px",
              color: "#7dd3fc",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 2px 10px rgba(59,130,246,0.4)",
              pointerEvents: "auto",
              whiteSpace: "nowrap",
            }}
          >
            🔒 Close Lid
          </button>
        );
      })()}

      {/* ── Time-expired overlay — blocks all interactions ───────────────── */}
      {labExpired && (
        <div style={{
          position:     "absolute",
          inset:        0,
          zIndex:       500,
          background:   "rgba(0,0,0,0.78)",
          backdropFilter: "blur(6px)",
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          flexDirection: "column",
          gap:          0,
          pointerEvents: "all",
        }}>
          <div style={{
            background:    "#0f172a",
            border:        "1.5px solid #ef4444",
            borderRadius:  20,
            padding:       "44px 52px",
            textAlign:     "center",
            maxWidth:      440,
            boxShadow:     "0 24px 60px rgba(239,68,68,0.25)",
          }}>
            {/* Animated clock icon */}
            <div style={{
              width: 72, height: 72, borderRadius: "50%",
              background: "rgba(239,68,68,0.12)",
              border: "2px solid rgba(239,68,68,0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px",
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
                stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <div style={{ color: "#ef4444", fontWeight: 900, fontSize: 26,
              letterSpacing: -0.5, marginBottom: 10 }}>
              Time's Up!
            </div>
            <div style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, marginBottom: 20 }}>
              The time limit set by your teacher has expired.<br />
              Your lab session has been locked.
            </div>
            <div style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.25)",
              borderRadius: 10, padding: "10px 16px",
              color: "#fca5a5", fontSize: 13,
            }}>
              Please contact your teacher to review your results.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractiveLabCanvas;
