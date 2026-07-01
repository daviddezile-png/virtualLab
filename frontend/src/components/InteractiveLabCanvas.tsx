import React, { useRef, useEffect, useState, useCallback } from "react";
import { SimulationStep } from "../simulation/model";
import ProtocolSidebar from "./ProtocolSidebar";
import EvaluationPanel from "./EvaluationPanel";
import { getInitialApparatus, getInitialApparatusColdCream, Apparatus } from "./apparatusData";
import { Assignment, BASE_RECIPES } from "../utils/assignmentStore";
import { logLabMilestone } from "../utils/auditStore";
import { fetchAmbientWeather, DEFAULT_AMBIENT, AmbientWeather } from "../simulation/weather";
import { soundManager } from "../utils/soundManager";

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

// Lighten / darken a "#rrggbb" colour by `amt` (−255..255); returns rgb() string.
const shadeColor = (col: string, amt: number): string => {
  const m = col.match(/^#([0-9a-fA-F]{6})$/);
  if (!m) return col;
  const n = parseInt(m[1], 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp((n >> 16) + amt);
  const g = clamp(((n >> 8) & 255) + amt);
  const b = clamp((n & 255) + amt);
  return `rgb(${r}, ${g}, ${b})`;
};

// ── Containment model ─────────────────────────────────────────────────────────
// Instruments that can be lowered INTO a container.  When contained they rest on
// the inner floor of the container, render in front of (i.e. inside) the glass,
// and travel with the container when it is dragged.  The spatula additionally
// dips into wide-mouth solid reagent jars.
const CONTAINABLE_TYPES = ["stirringrod", "thermometer", "phmeter", "viscositygauge", "spatula"];
const CONTAINER_TYPES   = ["beaker", "cylinder"];
// Glassware that produces a "clink" at the moment it touches a beaker — both the
// glass containers carried into one another AND the slim glass instruments (rod,
// thermometer, pH/viscosity probes) as their glass meets the beaker on the way in.
const COLLISION_SOUND_TYPES = ["beaker", "cylinder", "container", "stirringrod", "thermometer", "phmeter", "viscositygauge"];
// Items whose base "knocks"/slides on the bench when set down. Kept for the
// glassware containers plus the hot-plate, ice-bath and measuring cylinder.
const DROP_SOUND_TYPES  = ["beaker", "container", "bottle", "cylinder", "hotplate", "icebucket"];
// Apparatus that still plays the tactile "click" pick-up sound when grabbed.
// Only the beaker, measuring cylinder and containers click; everything else
// (hot-plate, ice-bath, instruments, …) is picked up silently.
const GRAB_SOUND_TYPES  = ["beaker", "cylinder", "container"];
// Apparatus that produces a small friction "scrape" while slid along the bench
// (only on the table surface, never in the air): glassware, reagent containers,
// the hot-plate and the digital balance.
const SLIDE_SOUND_TYPES = ["beaker", "cylinder", "container", "bottle", "hotplate", "weightbalance"];

// Maximum solid (grams) a spatula blade can hold in a single scoop.
const MAX_SPATULA_LOAD = 30;

// Angle the loaded spatula is tilted up while carried through the air, so the
// solid is cradled against the blade rather than spilled. Shared by the drawing
// code and the pour-detection so the two always agree.
const CARRY_TILT = (80 * Math.PI) / 180;

// Where a spatula's blade tip actually sits on screen. While carried, the blade
// is tilted up about the grip (see drawSpatula), which swings it left and up
// from the upright bounding box. Pour detection MUST use this point, or the user
// aims the visible blade at the beaker mouth while the test runs against the
// box centre — far to the lower-right — and nothing is ever deposited.
const spatulaBladeTip = (
  x: number,
  y: number,
  w: number,
  h: number,
  carried: boolean,
): { cx: number; bot: number } => {
  const cx = x + w / 2;
  const bottom = y + h;
  if (!carried) return { cx, bot: bottom };
  const pivotY = y + h * 0.16;        // grip pivot used by drawSpatula's rotate
  const dy = bottom - pivotY;
  return { cx: cx - dy * Math.sin(CARRY_TILT), bot: pivotY + dy * Math.cos(CARRY_TILT) };
};

// True when a spatula's blade tip (the "chopping head") is aimed into a
// container's mouth — i.e. over the top opening and near the rim, the only spot
// where a real scoop tips its contents out. The blade resting lower against the
// side of the glass must NOT deposit anything.
const bladeOverMouth = (
  bladeCX: number,
  bladeBot: number,
  c: { x: number; y: number; width: number; height: number },
): boolean => {
  // Horizontal: blade is over the mouth opening. Allow a little overhang past
  // each rim so just clipping the lip from the side still counts as a pour.
  const overhang = c.width * 0.15;
  const overOpening = bladeCX >= c.x - overhang && bladeCX <= c.x + c.width + overhang;
  // Vertical: pour as soon as the blade touches the mouth-top. The band reaches
  // a full ~50% of the beaker height ABOVE the rim (so contact with the mouth/lip
  // releases the solid) down through the entire beaker body — lowering a loaded
  // blade into the beaker deposits wherever it is released. A blade resting
  // beside the glass is excluded by the horizontal `overOpening` check above.
  const atMouth = bladeBot >= c.y - c.height * 0.5 && bladeBot <= c.y + c.height;
  return overOpening && atMouth;
};

// Thickness of the container's glass floor — the contained item's tip rests this
// many px above the outer bottom so it never pokes through onto the table.
const containerInnerOffset = (type: string): number => (type === "cylinder" ? 7 : 5);

// Can `item` be lowered into container `c`?  Glassware holds any probe; a solid
// wide-mouth jar additionally accepts the spatula.
const isContainerFor = (item: Apparatus, c: Apparatus): boolean =>
  CONTAINER_TYPES.includes(c.type) ||
  (item.type === "spatula" && c.type === "bottle" && !!c.data?.isSolid);

// Y position so that `item`'s tip rests inside `container` — on the glass floor
// for beakers/cylinders, or just inside the mouth for a wide solid jar.
const restYInside = (item: Apparatus, container: Apparatus): number => {
  if (container.type === "bottle")
    return container.y + container.height * 0.34 - item.height;
  return container.y + container.height - containerInnerOffset(container.type) - item.height;
};

// Find the container whose mouth the item's tip is currently inside, if any.
const findContainerFor = (item: Apparatus, list: Apparatus[]): Apparatus | null => {
  if (!CONTAINABLE_TYPES.includes(item.type)) return null;
  const cx   = item.x + item.width / 2;
  const tipY = item.y + item.height;
  return (
    list.find(
      (c) =>
        isContainerFor(item, c) &&
        c.id !== item.id &&
        cx   >= c.x && cx   <= c.x + c.width &&
        tipY >= c.y + 4 && tipY <= c.y + c.height + 26,
    ) ?? null
  );
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
  // Side the pouring spout/lip is drawn on. While pouring we move it to the
  // leading (low) edge so the liquid is seen leaving through the spout tip.
  spoutSide: "left" | "right" = "right",
  // 0..1 quality of the finished emulsion — 1 = clean white cream, lower = dull.
  creamQuality: number = 1,
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

  // ── Combined apparent fill level ──
  // Any solid stearic acid sitting in the beaker displaces/adds to the visible
  // level, so the surface rises above the solid when liquid is present. Without
  // this, adding water to solid stearic acid showed no level change because the
  // thin liquid layer was drawn behind the taller (opaque) solid chunk.
  const solidVolMl     = solidStearicGrams > 0 ? solidStearicGrams / 0.85 : 0; // ≈ mL of solid
  const hasLiquid      = currentVol > 0;
  const effVol         = Math.min(maxVol, currentVol + (hasLiquid ? solidVolMl : 0));
  const fillPercentage = hasLiquid ? Math.min(effVol / maxVol, 1) : 0;
  const liquidHeight   = usableHeight * fillPercentage;
  const liquidY        = solidFloorY - liquidHeight;

  // 0. Draw solid stearic acid chunks (before liquid so liquid renders on top)
  if (solidStearicGrams > 0) {
    let chunkH = Math.min(h * 0.28, 4 + solidStearicGrams * 0.6);
    // Keep the solid below the liquid surface when liquid is present, so the
    // water level visibly rises above it (the solid shows through, submerged).
    if (hasLiquid) chunkH = Math.min(chunkH, Math.max(2, liquidHeight - 3));
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
  if (hasLiquid) {
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
  if (emulsificationProgress > 0 && hasLiquid) {
    const tE = Math.max(0, (emulsificationProgress - 20) / 80); // ease-in after 20%

    const fillH2 = liquidHeight;
    const liqY2  = liquidY;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, liqY2, w - 4, y + h - radius - liqY2, [0, 0, radius, radius]);
    ctx.clip();

    if (emulsificationProgress >= 100) {
      // ── FULLY FORMED — cream fill, tinted by quality ──
      // Good batch → clean glossy white; poor batch → dull greyish-tan and
      // less opaque, so the colour honestly reflects a badly-made cream.
      const q = Math.max(0, Math.min(1, creamQuality));
      const mix = (good: number, poor: number) => Math.round(poor + (good - poor) * q);
      const op  = (good: number, poor: number) => (poor + (good - poor) * q).toFixed(2);
      const cGrad = ctx.createLinearGradient(x, liqY2, x, y + h - radius);
      cGrad.addColorStop(0,   `rgba(${mix(255,198)}, ${mix(253,188)}, ${mix(250,168)}, ${op(0.97,0.80)})`);
      cGrad.addColorStop(0.3, `rgba(${mix(252,192)}, ${mix(249,182)}, ${mix(244,160)}, ${op(0.95,0.78)})`);
      cGrad.addColorStop(1,   `rgba(${mix(245,184)}, ${mix(240,174)}, ${mix(232,150)}, ${op(0.98,0.82)})`);
      ctx.fillStyle = cGrad;
      ctx.fillRect(x + 2, liqY2, w - 4, y + h - radius - liqY2);

      // Glossy surface sheen — only a well-made cream is glossy
      ctx.fillStyle = `rgba(255, 255, 255, ${(0.18 + 0.42 * q).toFixed(2)})`;
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

  // Vertical glass highlight streak (left of centre) — real glass catches light
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath();
  ctx.roundRect(x + w * 0.18, y + 6, w * 0.07, h - 16, 2);
  ctx.fill();

  // Rolled rim across the open top (real beakers have a reinforced lip)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 1, y);
  ctx.lineTo(x + w - 1, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(120, 170, 210, 0.55)";
  ctx.beginPath();
  ctx.moveTo(x + 1, y + 2.5);
  ctx.lineTo(x + w - 1, y + 2.5);
  ctx.stroke();

  // Pouring spout — small curved lip, drawn on `spoutSide`. A real beaker pours
  // from this tip, so during a pour it sits on the leading (low) edge.
  ctx.fillStyle = glassGradient;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (spoutSide === "left") {
    ctx.moveTo(x + 2, y + 1);
    ctx.quadraticCurveTo(x - 7, y - 3, x - 8, y + 4);
    ctx.quadraticCurveTo(x - 4, y + 4, x + 2, y + 7);
  } else {
    ctx.moveTo(x + w - 2, y + 1);
    ctx.quadraticCurveTo(x + w + 7, y - 3, x + w + 8, y + 4);
    ctx.quadraticCurveTo(x + w + 4, y + 4, x + w - 2, y + 7);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = "butt";

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

  // 2. Hexagonal / round foot base of the cylinder (wider, weighted stand)
  const footCX = x + w / 2;
  const footCY = y + h + 4;
  const footRx = w * 0.92;
  const footGrad = ctx.createLinearGradient(footCX - footRx, 0, footCX + footRx, 0);
  footGrad.addColorStop(0, "rgba(150, 185, 220, 0.75)");
  footGrad.addColorStop(0.5, "rgba(210, 235, 255, 0.55)");
  footGrad.addColorStop(1, "rgba(150, 185, 220, 0.75)");
  ctx.fillStyle = footGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.ellipse(footCX, footCY, footRx, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Short neck linking body to foot
  ctx.fillStyle = "rgba(190, 220, 250, 0.6)";
  ctx.beginPath();
  ctx.moveTo(x + w * 0.30, y + h - 2);
  ctx.lineTo(x + w * 0.70, y + h - 2);
  ctx.lineTo(footCX + footRx * 0.45, footCY - 2);
  ctx.lineTo(footCX - footRx * 0.45, footCY - 2);
  ctx.closePath();
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

  // Vertical glass highlight streak
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.fillRect(x + w * 0.20, y + 5, w * 0.10, h - 12);

  // Flared rim + pouring spout at the top (real graduated cylinders flare out)
  ctx.fillStyle = "rgba(225, 242, 255, 0.55)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.6;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(x - 2, y + 5);
  ctx.quadraticCurveTo(x - 3, y - 1, x + w * 0.30, y - 1);   // left flare
  ctx.lineTo(x + w * 0.62, y - 1);
  ctx.quadraticCurveTo(x + w + 6, y - 2, x + w + 7, y + 4);  // spout lip
  ctx.quadraticCurveTo(x + w + 1, y + 4, x + w + 2, y + 5);
  ctx.lineTo(x + w + 2, y + 6);
  ctx.lineTo(x - 2, y + 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.lineJoin = "miter";

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
  isPouring: boolean = false,
  frame: number = 0,
) => {
  ctx.save();
  if (tiltAngle !== 0) {
    ctx.translate(x + w / 2, y);
    ctx.rotate(tiltAngle);
    ctx.translate(-(x + w / 2), -y);
  }
  // ── Container geometry ────────────────────────────────────────────────────
  // Liquid reagents use a wide body with sloping shoulders and a NARROW screw
  // neck.  SOLID reagents (stearic acid / beeswax) use a wide-mouth jar so a
  // spatula can be dipped in to chop and lift out the solid.
  const r          = 6;
  const capH       = isSolid ? Math.max(h * 0.13, 10) : Math.max(h * 0.09, 7);
  const neckH      = isSolid ? Math.max(h * 0.04, 3)  : Math.max(h * 0.07, 5);
  const shoulderH  = isSolid ? h * 0.05 : h * 0.13;
  const neckTopY   = y + capH;
  const neckBotY   = neckTopY + neckH;
  const bodyTopY   = neckBotY + shoulderH;
  const bodyBotY   = y + h;
  const cx         = x + w / 2;
  const neckW      = isSolid ? Math.max(w * 0.74, 30) : Math.max(w * 0.34, 11);   // wide mouth for solids
  const capW       = isSolid ? Math.min(w * 0.94, neckW + 12) : neckW + 6;
  const isWater    = name.toLowerCase().includes("water");

  // Bottle silhouette: narrow neck → sloping shoulders → full-width rounded body
  const silhouette = () => {
    ctx.beginPath();
    ctx.moveTo(cx - neckW / 2, neckTopY);
    ctx.lineTo(cx - neckW / 2, neckBotY);
    ctx.quadraticCurveTo(x, neckBotY + shoulderH * 0.25, x, bodyTopY);   // left shoulder
    ctx.lineTo(x, bodyBotY - r);
    ctx.quadraticCurveTo(x, bodyBotY, x + r, bodyBotY);
    ctx.lineTo(x + w - r, bodyBotY);
    ctx.quadraticCurveTo(x + w, bodyBotY, x + w, bodyBotY - r);
    ctx.lineTo(x + w, bodyTopY);
    ctx.quadraticCurveTo(x + w, neckBotY + shoulderH * 0.25, cx + neckW / 2, neckBotY); // right shoulder
    ctx.lineTo(cx + neckW / 2, neckTopY);
    ctx.closePath();
  };

  // 1. Content (liquid or solid) — clipped to the bottle silhouette
  if (currentVol > 0) {
    const fillLevel = Math.min(currentVol / maxVol, 1);
    const fillH = (bodyBotY - bodyTopY) * fillLevel;
    const fillY = bodyBotY - fillH;

    ctx.save();
    silhouette();
    ctx.clip();

    if (isSolid) {
      // Wax-like solid: creamy white base
      ctx.fillStyle = "rgba(255, 250, 240, 0.97)";
      ctx.fillRect(x, fillY, w, fillH);

      // Horizontal wax layering lines
      ctx.strokeStyle = "rgba(220, 210, 195, 0.6)";
      ctx.lineWidth = 1;
      for (let ly = fillY + 4; ly < bodyBotY - 3; ly += 7) {
        ctx.beginPath();
        ctx.moveTo(x + 3, ly);
        ctx.lineTo(x + w - 3, ly);
        ctx.stroke();
      }

      // Irregular chunks on the top surface
      ctx.fillStyle = "rgba(240, 232, 218, 0.85)";
      for (let ci = 0; ci < 5; ci++) {
        const cx2 = x + 3 + ci * ((w - 6) / 5);
        const ch = 5 + (ci % 3) * 3;
        ctx.beginPath();
        ctx.roundRect(cx2, fillY, (w - 6) / 5 - 1, ch, 2);
        ctx.fill();
      }

      // Waxy sheen
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(x + 4, fillY, w * 0.28, fillH * 0.6);
    } else {
      const [lr, lg, lb, la] = parseRgba(liquidColor);
      const liqGrad = ctx.createLinearGradient(x, fillY, x, bodyBotY);
      liqGrad.addColorStop(0, `rgba(${Math.min(255,lr+25)},${Math.min(255,lg+25)},${Math.min(255,lb+25)},${la})`);
      liqGrad.addColorStop(1, `rgba(${Math.max(0,lr-15)},${Math.max(0,lg-15)},${Math.max(0,lb-15)},${Math.min(1,la*1.15)})`);
      ctx.fillStyle = liqGrad;
      ctx.fillRect(x, fillY, w, fillH);
      // Surface line
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + 2, fillY);
      ctx.lineTo(x + w - 2, fillY);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 1b. Internal flow while pouring — liquid is seen rising from the bottom of
  // the body, funnelling up through the shoulders & neck, and out the mouth
  // (drawn in the bottle's own frame so it follows the tilt toward the target).
  if (isPouring && !isSolid && currentVol > 0) {
    ctx.save();
    silhouette();
    ctx.clip();
    const [lr, lg, lb, la] = parseRgba(liquidColor);
    const fc = (al: number) => `rgba(${lr},${lg},${lb},${al.toFixed(3)})`;

    // Funnel-shaped flow channel: wide at the body bottom → narrow at the mouth
    const chanTop = neckTopY;            // mouth
    const chanBot = bodyBotY;            // bottom of the body
    const botHalf = w * 0.34;
    const topHalf = neckW * 0.45;
    const chGrad = ctx.createLinearGradient(0, chanBot, 0, chanTop);
    chGrad.addColorStop(0, fc(Math.min(1, la * 0.7)));
    chGrad.addColorStop(1, fc(la * 0.38));
    ctx.fillStyle = chGrad;
    ctx.beginPath();
    ctx.moveTo(cx - botHalf, chanBot);
    ctx.lineTo(cx - topHalf, chanTop);
    ctx.lineTo(cx + topHalf, chanTop);
    ctx.lineTo(cx + botHalf, chanBot);
    ctx.closePath();
    ctx.fill();

    // Rising blobs travelling bottom → mouth to show the direction of flow
    const nBlobs = 8;
    for (let i = 0; i < nBlobs; i++) {
      const t   = (((i / nBlobs) + frame * 0.03) % 1);   // 0 bottom → 1 mouth
      const by  = chanBot - t * (chanBot - chanTop);
      const half = botHalf + (topHalf - botHalf) * t;     // channel narrows upward
      const bx  = cx + Math.sin(t * 6.5 + i * 1.4) * half * 0.55;
      const br  = 1.5 + Math.sin(t * Math.PI) * 1.3;
      const ba  = 0.30 + 0.45 * Math.sin(t * Math.PI);
      ctx.fillStyle = fc(ba);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // 2. Glass body
  const glassGrad = ctx.createLinearGradient(x, y, x + w, y);
  glassGrad.addColorStop(0,   isWater ? "rgba(220,238,252,0.30)" : "rgba(248,250,252,0.22)");
  glassGrad.addColorStop(0.5, "rgba(255,255,255,0.12)");
  glassGrad.addColorStop(1,   "rgba(200,222,242,0.34)");
  ctx.fillStyle = glassGrad;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
  ctx.lineWidth = 1.5;
  silhouette();
  ctx.fill();
  ctx.stroke();

  // Vertical glass highlight streak
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  ctx.fillRect(x + w * 0.18, bodyTopY + 4, w * 0.08, (bodyBotY - bodyTopY) - 12);

  // 3. Neck closure — SOLID jars get a coloured screw COVER, LIQUID bottles get
  //    a translucent ground-GLASS lid/stopper. (lid off → open glass rim)
  if (hasLid) {
    if (isSolid) {
      // ── Coloured screw cover — solid reagent jars ──
      const capGrad = ctx.createLinearGradient(cx - capW / 2, 0, cx + capW / 2, 0);
      capGrad.addColorStop(0,   shadeColor(lidColor, -28));
      capGrad.addColorStop(0.5, lidColor);
      capGrad.addColorStop(1,   shadeColor(lidColor, -40));
      ctx.fillStyle = capGrad;
      ctx.strokeStyle = "rgba(0,0,0,0.22)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(cx - capW / 2, y, capW, capH + 3, 3);
      ctx.fill();
      ctx.stroke();
      // Knurled ribs on the cap (screw-cap grip)
      ctx.strokeStyle = "rgba(0,0,0,0.18)";
      ctx.lineWidth = 0.7;
      for (let rx = cx - capW / 2 + 2.5; rx < cx + capW / 2 - 1; rx += 2.6) {
        ctx.beginPath();
        ctx.moveTo(rx, y + 2);
        ctx.lineTo(rx, y + capH + 1.5);
        ctx.stroke();
      }
      // Cap top highlight
      ctx.fillStyle = "rgba(255,255,255,0.28)";
      ctx.beginPath();
      ctx.roundRect(cx - capW / 2 + 2, y + 1, capW * 0.4, 2.5, 1);
      ctx.fill();
    } else {
      // ── Glass lid / ground-glass stopper — liquid reagent bottles ──
      const lx = cx - capW / 2;
      const glassCap = ctx.createLinearGradient(lx, 0, lx + capW, 0);
      glassCap.addColorStop(0,   "rgba(200,224,244,0.58)");
      glassCap.addColorStop(0.5, "rgba(238,247,255,0.42)");
      glassCap.addColorStop(1,   "rgba(188,214,238,0.62)");
      ctx.fillStyle = glassCap;
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(lx, y, capW, capH + 3, 3);
      ctx.fill();
      ctx.stroke();
      // Bright vertical glass highlight streak
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.roundRect(lx + capW * 0.2, y + 1.5, capW * 0.15, capH, 1.5);
      ctx.fill();
      // Soft top sheen
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.roundRect(lx + 2, y + 1, capW * 0.45, 2.5, 1);
      ctx.fill();
    }
  } else {
    // Open ground-glass neck rim
    ctx.fillStyle = "rgba(210,232,250,0.5)";
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(cx, neckTopY, neckW / 2, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 4. Label
  const labelY = bodyTopY + (bodyBotY - bodyTopY) * 0.30;
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.roundRect(x + 4, labelY, w - 8, 26, 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 0.8;
  ctx.stroke();
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name.split(" ")[0], cx, labelY + 13);
  if (isSolid) {
    ctx.fillStyle = "#7c4a00";
    ctx.font = "6px Arial";
    ctx.fillText("SOLID", cx, labelY + 22);
  }
  ctx.restore();
};

// A removed screw cap lying on the surface (table or shelf) beside its bottle,
// so opening a container leaves the lid visibly set down rather than vanishing.
// `lx` is the cap's left edge, `surfaceY` the surface it rests on, `w` its width.
const drawDetachedLid = (
  ctx: CanvasRenderingContext2D,
  lx: number,
  surfaceY: number,
  w: number,
  color: string,
  isSolid: boolean = false,
) => {
  const h    = Math.max(w * 0.5, 9);
  const topY = surfaceY - h;
  ctx.save();

  // Contact shadow on the surface
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.ellipse(lx + w / 2, surfaceY + 1, w * 0.55, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (isSolid) {
    // ── Coloured screw cover (solid jar) — same colour as the jar's lid ──
    const grad = ctx.createLinearGradient(lx, 0, lx + w, 0);
    grad.addColorStop(0,   shadeColor(color, -34));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1,   shadeColor(color, -44));
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.roundRect(lx, topY, w, h, 3);
    ctx.fill();
    ctx.stroke();

    // Knurled grip ribs
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 0.7;
    for (let rx = lx + 2.5; rx < lx + w - 1; rx += 2.6) {
      ctx.beginPath();
      ctx.moveTo(rx, topY + 2);
      ctx.lineTo(rx, topY + h - 2);
      ctx.stroke();
    }

    // Top highlight
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    ctx.beginPath();
    ctx.roundRect(lx + 2, topY + 1, w * 0.4, 2.5, 1);
    ctx.fill();
  } else {
    // ── Translucent glass lid / stopper (liquid bottle) ──
    const grad = ctx.createLinearGradient(lx, 0, lx + w, 0);
    grad.addColorStop(0,   "rgba(200,224,244,0.58)");
    grad.addColorStop(0.5, "rgba(238,247,255,0.42)");
    grad.addColorStop(1,   "rgba(188,214,238,0.62)");
    ctx.fillStyle = grad;
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(lx, topY, w, h, 3);
    ctx.fill();
    ctx.stroke();

    // Bright vertical glass highlight
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.roundRect(lx + w * 0.2, topY + 1.5, w * 0.15, h - 3, 1.5);
    ctx.fill();
    // Soft top sheen
    ctx.fillStyle = "rgba(255,255,255,0.32)";
    ctx.beginPath();
    ctx.roundRect(lx + 2, topY + 1, w * 0.4, 2.5, 1);
    ctx.fill();
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

const calcBeakerWeight = (a: { data?: { composition?: Record<string,number>; solidStearicGrams?: number; solidBeeswaxGrams?: number; emptyWeight?: number } }): number => {
  const comp = (a.data?.composition ?? {}) as Record<string, number>;
  // Start from the tare — the empty glass vessel itself — so the balance reports
  // the REAL weight the student would read on a physical scale (beaker + contents).
  let w = a.data?.emptyWeight ?? 0;
  for (const [k, v] of Object.entries(comp)) w += v * (DENSITY[k] ?? 1.0);
  w += a.data?.solidStearicGrams ?? 0;
  w += a.data?.solidBeeswaxGrams ?? 0;
  return Math.round(w * 10) / 10;
};

// The spatula is drawn upright while inside a container (like the glass rod) so
// it stays within the boundary.  When carrying chopped chemical through the air
// it is held at a slight inclination (`tiltAngle`) for realism.  `action` adds a
// freshly-cut chip on the blade while chopping.  No bouncing, no falling chunks.
const drawSpatula = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  load: number = 0,
  action: "idle" | "chop" | "tip" = "idle",
  tiltAngle: number = 0,
) => {
  ctx.save();

  const cx = x + w / 2;
  const handleW = Math.max(w * 0.30, 3.5);
  const bladeH  = h * 0.22;
  const handleH = h - bladeH;
  const bladeW  = w * 0.90;
  const bladeY  = y + handleH - 2;

  // Incline the whole spatula when carrying its load (pivot near the grip)
  if (tiltAngle !== 0) {
    const pivotX = cx, pivotY = y + h * 0.16;
    ctx.translate(pivotX, pivotY);
    ctx.rotate(tiltAngle);
    ctx.translate(-pivotX, -pivotY);
  }

  // Shadow
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 1;

  // Handle — stainless steel rod
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

  // Blade — wide flat scoop
  const bladeGrad = ctx.createLinearGradient(cx - bladeW / 2, 0, cx + bladeW / 2, 0);
  bladeGrad.addColorStop(0,   "rgba(160, 175, 190, 0.80)");
  bladeGrad.addColorStop(0.5, "rgba(235, 245, 252, 0.60)");
  bladeGrad.addColorStop(1,   "rgba(150, 168, 185, 0.82)");
  ctx.fillStyle = bladeGrad;
  ctx.strokeStyle = "rgba(200, 215, 230, 0.88)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.roundRect(cx - bladeW / 2, bladeY, bladeW, bladeH, [0, 0, 3, 3]);
  ctx.fill();
  ctx.stroke();

  // ── Solid load resting on the blade ──
  if (load > 0) {
    const loadAlpha = Math.min(load / MAX_SPATULA_LOAD, 1);
    const moundCY = bladeY + bladeH * 0.35;
    ctx.fillStyle = `rgba(255, 250, 240, ${0.85 + loadAlpha * 0.12})`;
    ctx.beginPath();
    ctx.ellipse(cx, moundCY, bladeW * 0.40 * loadAlpha + bladeW * 0.16,
      bladeH * 0.55 * loadAlpha + bladeH * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    // Powdery texture bumps
    ctx.fillStyle = "rgba(240, 228, 210, 0.72)";
    for (let i = 0; i < 4; i++) {
      const bx = cx + (i - 1.5) * (bladeW * 0.12);
      const by = moundCY - bladeH * 0.07;
      ctx.beginPath();
      ctx.ellipse(bx, by, 2.2, 1.2, i * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── A freshly-cut chip on the blade while chopping ──
  if (action === "chop") {
    ctx.fillStyle = "rgba(252, 246, 234, 0.9)";
    ctx.beginPath();
    ctx.ellipse(cx, bladeY + bladeH * 0.5, bladeW * 0.24, bladeH * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
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

  // ── Flat solid metal plate (no coil rings) ───────────────────────────────
  // Brushed-metal grain when cool
  if (!isOn || temperature < 45) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, topH - 3, [6, 6, 0, 0]);
    ctx.clip();
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let lx = x + 3; lx < x + w - 2; lx += 4) {
      ctx.beginPath();
      ctx.moveTo(lx, y + 2);
      ctx.lineTo(lx, y + topH - 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Uniform heat colour across the WHOLE plate — the metal itself glows hotter
  // as the temperature rises (no circular element).
  if (isOn) {
    const heatRatio = Math.min((temperature - 25) / Math.max(targetTemperature - 25, 1), 1);
    const pulse = 0.05 * Math.sin(frame * 0.16);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x + 2, y + 2, w - 4, topH - 3, [6, 6, 0, 0]);
    ctx.clip();
    const hg = ctx.createLinearGradient(x, y, x, frontY);
    hg.addColorStop(0,   `rgba(255, 170, 60, ${0.10 + 0.30 * heatRatio + pulse})`);
    hg.addColorStop(0.5, `rgba(255, 85, 15, ${0.12 + 0.50 * heatRatio + pulse})`);
    hg.addColorStop(1,   `rgba(205, 30, 0, ${0.10 + 0.34 * heatRatio})`);
    ctx.fillStyle = hg;
    ctx.fillRect(x + 2, y + 2, w - 4, topH - 3);
    // Brighter soft centre band so the metal looks incandescent when very hot
    if (heatRatio > 0.5) {
      const cg = ctx.createLinearGradient(x, y, x + w, y);
      cg.addColorStop(0, "rgba(255,210,120,0)");
      cg.addColorStop(0.5, `rgba(255,225,150,${(heatRatio - 0.5) * 0.5})`);
      cg.addColorStop(1, "rgba(255,210,120,0)");
      ctx.fillStyle = cg;
      ctx.fillRect(x + 2, y + 2, w - 4, topH - 3);
    }
    ctx.restore();
  }

  // Recessed plate edge — defines the metal heating surface
  ctx.strokeStyle = isOn ? "rgba(120,30,0,0.55)" : "rgba(40,55,70,0.5)";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, topH - 3, [6, 6, 0, 0]);
  ctx.stroke();

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
  _isMeasuring: boolean = false,
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

  // Oscillate when stirring. The 0.40 rad/frame factor (~3.8 Hz at 60 fps) is
  // kept in lock-step with STIR_HZ in soundManager.buildStirring so the rod and
  // the swish/knock sound move at the same speed — bump both together.
  if (isStirring) {
    const tilt = Math.sin(frame * 0.40) * 0.13;
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

  // Inner light reflection stripe (soft, broad)
  ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
  ctx.beginPath();
  ctx.roundRect(rodCX - rodW / 2 + 1, y + 6, rodW * 0.30, h - 12, 1);
  ctx.fill();

  // Sharp specular highlight line — gives solid-glass shine
  ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
  ctx.beginPath();
  ctx.roundRect(rodCX - rodW * 0.30, y + 8, rodW * 0.10, h - 16, 1);
  ctx.fill();

  // Fire-polished rounded top end
  ctx.fillStyle = "rgba(222, 240, 255, 0.85)";
  ctx.beginPath();
  ctx.ellipse(rodCX, y + 3, rodW * 0.5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.beginPath();
  ctx.ellipse(rodCX - rodW * 0.12, y + 2.5, rodW * 0.16, 1.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rounded, slightly bulbous bottom tip (as on a real stirring rod)
  const tipCY = y + h - rodW * 0.42;
  ctx.fillStyle = rodGrad;
  ctx.strokeStyle = "rgba(198, 226, 252, 0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(rodCX, tipCY, rodW * 0.56, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Highlight on the bottom bulb
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath();
  ctx.arc(rodCX - rodW * 0.14, tipCY - rodW * 0.14, rodW * 0.18, 0, Math.PI * 2);
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

  // ── Rectangular plastic container (ice bath) ──────────────────────────────
  const botW = w * 0.92;                 // very slight taper, mostly rectangular
  const botX = x + (w - botW) / 2;
  const rimY = y + 6;                     // inner rim line where ice sits

  // Shadow
  ctx.shadowColor  = "rgba(0,0,0,0.30)";
  ctx.shadowBlur   = 12;
  ctx.shadowOffsetY = 5;

  // Plastic body — translucent white/blue, rounded bottom corners
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  bodyGrad.addColorStop(0,    "rgba(206, 224, 240, 0.88)");
  bodyGrad.addColorStop(0.45, "rgba(240, 248, 253, 0.82)");
  bodyGrad.addColorStop(1,    "rgba(192, 212, 230, 0.88)");
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.moveTo(x, rimY);
  ctx.lineTo(x + w, rimY);
  ctx.lineTo(botX + botW, y + h - 9);
  ctx.quadraticCurveTo(botX + botW, y + h, botX + botW - 9, y + h);
  ctx.lineTo(botX + 9, y + h);
  ctx.quadraticCurveTo(botX, y + h, botX, y + h - 9);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

  // Inner cavity shading (depth)
  ctx.fillStyle = "rgba(120, 150, 175, 0.20)";
  ctx.beginPath();
  ctx.moveTo(x + 4, rimY + 4);
  ctx.lineTo(x + w - 4, rimY + 4);
  ctx.lineTo(botX + botW - 5, y + h - 6);
  ctx.lineTo(botX + 5, y + h - 6);
  ctx.closePath();
  ctx.fill();

  // Cold water pooled at the bottom
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + 4, rimY + 4);
  ctx.lineTo(x + w - 4, rimY + 4);
  ctx.lineTo(botX + botW - 5, y + h - 6);
  ctx.lineTo(botX + 5, y + h - 6);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "rgba(170, 215, 245, 0.40)";
  ctx.fillRect(x, y + h * 0.55, w, h);
  ctx.restore();

  // Plastic side highlight
  ctx.fillStyle = "rgba(255,255,255,0.30)";
  ctx.fillRect(x + w * 0.10, rimY + 4, w * 0.05, h - 14);

  // ── Ice cubes mounded at the top (some peeking above the rim) ──────────────
  if (iceLevel > 0) {
    const drawCube = (ccx: number, ccy: number, s: number, rot: number) => {
      ctx.save();
      ctx.translate(ccx, ccy);
      ctx.rotate(rot);
      const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
      g.addColorStop(0,   "rgba(255,255,255,0.96)");
      g.addColorStop(0.5, "rgba(226,243,254,0.92)");
      g.addColorStop(1,   "rgba(188,224,248,0.88)");
      ctx.fillStyle = g;
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(-s / 2, -s / 2, s, s * 0.86, 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.roundRect(-s / 2 + 1.5, -s / 2 + 1.5, s * 0.32, s * 0.26, 1);
      ctx.fill();
      ctx.restore();
    };

    const s    = w * 0.15;
    const n    = Math.max(3, Math.floor((w - 8) / (s * 0.95)));
    const span = w - 10 - s;
    const fillFrac = Math.min(iceLevel / 100, 1);
    // Back row — sits on the rim
    for (let i = 0; i < n; i++) {
      const ccx = x + 6 + s / 2 + (n > 1 ? (i / (n - 1)) * span : 0);
      const jit = (((i * 37) % 7) - 3) * 0.5;
      drawCube(ccx, rimY + 3 + jit, s, (((i * 53) % 10) - 5) * 0.04);
    }
    // Front row — overlapping, peeking just above the rim
    if (fillFrac > 0.35) {
      for (let i = 0; i < n - 1; i++) {
        const ccx = x + 6 + s + (n > 1 ? (i / (n - 1)) * span : 0);
        const jit = (((i * 53) % 5) - 2) * 0.6;
        drawCube(ccx, rimY - 3 + jit, s * 0.95, (((i * 29) % 10) - 5) * 0.05);
      }
    }
  }

  // Plastic rim lip across the top
  ctx.strokeStyle = "rgba(150, 175, 198, 0.95)";
  ctx.lineWidth   = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x + 1, rimY);
  ctx.lineTo(x + w - 1, rimY);
  ctx.stroke();
  ctx.lineCap = "butt";

  // Side outlines
  ctx.strokeStyle = "rgba(150, 175, 198, 0.45)";
  ctx.lineWidth   = 1.3;
  ctx.beginPath();
  ctx.moveTo(x, rimY);
  ctx.lineTo(botX, y + h - 6);
  ctx.moveTo(x + w, rimY);
  ctx.lineTo(botX + botW, y + h - 6);
  ctx.stroke();

  // "ICE BATH" label + 0 °C badge on the lower front of the container
  ctx.fillStyle = "#475569";
  ctx.font      = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText("ICE BATH", x + w / 2, y + h - 14);
  ctx.fillStyle = "#0ea5e9";
  ctx.font      = "bold 8px Arial";
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
  /** Self-practice: student-chosen batch size (g). null → base recipe (multiplier 1). */
  practiceTargetGrams?: number | null;
  labExpired?: boolean;
}

const InteractiveLabCanvas: React.FC<InteractiveLabCanvasProps> = ({
  practicalId = "vanishing-cream",
  assignment = null,
  practiceTargetGrams = null,
  labExpired = false,
}) => {
  const isColdCream = practicalId === "cold-cream";

  // Multiplier scales the target reagent amounts. Assignment mode uses the
  // teacher's targetGrams; self-practice uses the student's chosen batch size
  // (2nd visit onward), otherwise 1 (base recipe).
  const baseGrams  = BASE_RECIPES[isColdCream ? "cold-cream" : "vanishing-cream"].totalGrams;
  const multiplier = assignment
    ? +(assignment.targetGrams / BASE_RECIPES[assignment.practicalId].totalGrams).toFixed(4)
    : practiceTargetGrams != null
    ? +(practiceTargetGrams / baseGrams).toFixed(4)
    : 1;
  // Whether a target batch size is in effect (assignment OR chosen in self-practice).
  const hasTarget = !!assignment || practiceTargetGrams != null;
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const holdStirRef   = useRef<{ rodId: string; targetId: string } | null>(null);
  const draggingRef   = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const dragStartRef  = useRef<{ x: number; y: number } | null>(null); // mousedown client coords
  const dragMovedRef  = useRef(false);                                  // true once a real drag occurs
  const dragOnTableRef = useRef(false);                                 // true while the dragged item rests on the table surface
  const dragLiftedRef  = useRef(false);                                 // true once the dragged item has been off the table (in the air)
  const lastMovePosRef = useRef<{ x: number; y: number } | null>(null); // previous move client coords → drag speed
  const dragTypeRef    = useRef<string | null>(null);                   // type of the currently dragged apparatus (for sound gating)
  const collidingRef   = useRef<Set<string>>(new Set());                // beaker ids the airborne dragged item currently overlaps (rising-edge clink)
  // ── Touch interaction state ───────────────────────────────────────────────
  const touchStartRef     = useRef<{ clientX: number; clientY: number; x: number; y: number; time: number } | null>(null);
  const longPressTimerRef = useRef<number | null>(null);  // pending long-press → context menu
  const longPressFiredRef = useRef(false);                // a long-press already opened a menu
  const lastTapRef        = useRef<{ time: number; x: number; y: number } | null>(null); // for double-tap
  const panningRef        = useRef<{ startX: number; scrollLeft: number } | null>(null); // empty-area pan
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
  const [, setSelectedApparatus] = useState<Apparatus | null>(
    null,
  );
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

  // Minimum scene width. The shelf apparatus extend to ~1205px, so the table
  // (which is 92% of the canvas) must never be allowed to shrink narrower than
  // that — otherwise the shelf overhangs past the table edge on small/medium
  // screens. Keeping this floor high enough means the table + shelf stay a
  // constant size and smaller viewports scroll horizontally instead of breaking.
  const MIN_SCENE_WIDTH = 1500;

  // Bench spans almost the full canvas so there is a vast countertop for placing
  // beakers — on small/medium screens too (the canvas never drops below
  // MIN_SCENE_WIDTH, so the layout stays consistent and just scrolls).
  const tableTotalWidth = canvasSize.width * 0.92;
  const benchHeight = canvasSize.height - (TABLE_Y + LIP_HEIGHT); // Reaches bottom
  const shelfY = 220;

  // Initial layout for the active practical — used both for the apparatus state
  // and for holder / reset-to-shelf positions so they always match.
  const initialApparatusFor = useCallback(
    () => (isColdCream ? getInitialApparatusColdCream : getInitialApparatus)(LEFT_GAP, shelfY, TABLE_Y),
    [isColdCream, LEFT_GAP, shelfY, TABLE_Y],
  );

  const [apparatus, setApparatus] = useState<Apparatus[]>(() => initialApparatusFor());

  // Toggle a container's lid. When the lid comes OFF we park it on whichever
  // surface the container is resting on (shelf if it's up on the shelf, else the
  // table), beside the container, so the cap stays visible — like physically
  // setting it down. Replacing the lid clears that parked cap.
  const toggleLid = useCallback(
    (a: Apparatus, putLidOn: boolean): Apparatus => {
      if (putLidOn) return { ...a, data: { ...a.data, hasLid: true, lidOff: null } };
      const onShelf  = Math.abs((a.y + a.height) - shelfY) < 25;
      const surfaceY = onShelf ? shelfY : TABLE_Y;
      const lidW     = Math.max(a.width * 0.5, 16);
      // Park the cap just to the right of the container; flip to the left if that
      // would run off the edge of the canvas.
      let lidX = a.x + a.width + 6;
      if (lidX + lidW > canvasSize.width) lidX = a.x - lidW - 6;
      return { ...a, data: { ...a.data, hasLid: false, lidOff: { x: lidX, y: surfaceY, w: lidW } } };
    },
    [shelfY, TABLE_Y, canvasSize.width],
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
  // Frozen scale (available volume + selected amount) captured when a pour
  // starts, so the measuring-cylinder graduations stay put instead of
  // re-scaling on every animation frame as the source drains.
  const pourScaleFreezeRef = useRef<{ available: number; maxPour: number; amount: number } | null>(null);
  const [showLidModal, setShowLidModal] = useState<{ id: string } | null>(null);
  const [lidContextMenu, setLidContextMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [showHotPlateModal, setShowHotPlateModal] = useState(false);
  const [hotPlateFrame, setHotPlateFrame] = useState(0);
  const [showScoopModal, setShowScoopModal] = useState<{ spatulaId: string; sourceId: string; maxGrams: number } | null>(null);
  const [selectedScoopGrams, setSelectedScoopGrams] = useState(5);

  // ── Ambient (room) temperature, sourced from real-world weather ─────────────
  // Drives realistic Newton's-law cooling: a hot beaker taken off the plate
  // cools towards this value, and the size of the (T − roomTemp) gap sets how
  // fast it falls.  Fetched once on mount; falls back to 25 °C if offline.
  const [ambient, setAmbient] = useState<AmbientWeather>(DEFAULT_AMBIENT);
  const roomTemp = ambient.roomTemp;

  useEffect(() => {
    let cancelled = false;
    fetchAmbientWeather().then((w) => {
      if (!cancelled) setAmbient(w);
    });
    return () => { cancelled = true; };
  }, []);

  const drawApparatus = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      const benchTopY = TABLE_Y + LIP_HEIGHT;

      // 1. WALL BACKGROUND — vertical gradient gives the room depth
      const wallGrad = ctx.createLinearGradient(0, NAV_BAR_HEIGHT, 0, TABLE_Y);
      wallGrad.addColorStop(0, "#00314e");
      wallGrad.addColorStop(1, "#00557f");
      ctx.fillStyle = wallGrad;
      ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

      // Faint vertical wall-panel seams
      ctx.strokeStyle = "rgba(255,255,255,0.035)";
      ctx.lineWidth = 1;
      for (let px = LEFT_GAP + 80; px < canvasSize.width; px += 165) {
        ctx.beginPath();
        ctx.moveTo(px, NAV_BAR_HEIGHT);
        ctx.lineTo(px, TABLE_Y);
        ctx.stroke();
      }

      // 2. NAVIGATION BAR — with sheen and a recessed bottom edge
      ctx.fillStyle = "#002335";
      ctx.fillRect(0, 0, canvasSize.width, NAV_BAR_HEIGHT);
      const navGrad = ctx.createLinearGradient(0, 0, 0, NAV_BAR_HEIGHT);
      navGrad.addColorStop(0, "rgba(255,255,255,0.06)");
      navGrad.addColorStop(1, "rgba(0,0,0,0.12)");
      ctx.fillStyle = navGrad;
      ctx.fillRect(0, 0, canvasSize.width, NAV_BAR_HEIGHT);
      ctx.fillStyle = "rgba(0,0,0,0.30)";
      ctx.fillRect(0, NAV_BAR_HEIGHT - 2, canvasSize.width, 2);
      ctx.fillStyle = "rgba(120,160,190,0.25)";
      ctx.fillRect(0, NAV_BAR_HEIGHT, canvasSize.width, 1);

      // 3. STORAGE SHELF — a solid board with thickness, brackets and a cast shadow
      const shelfRightEdge = apparatus.reduce((maxX, a) => {
        const onShelf = Math.abs((a.y + a.height) - shelfY) < 30;
        return onShelf ? Math.max(maxX, a.x + a.width + 20) : maxX;
      }, tableTotalWidth + LEFT_GAP);
      const shelfDrawWidth = shelfRightEdge - LEFT_GAP;
      const SHELF_THICK = 11;

      // Shadow cast on the wall just below the shelf
      const shShadow = ctx.createLinearGradient(0, shelfY + SHELF_THICK, 0, shelfY + SHELF_THICK + 22);
      shShadow.addColorStop(0, "rgba(0,0,0,0.30)");
      shShadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = shShadow;
      ctx.fillRect(LEFT_GAP + 5, shelfY + SHELF_THICK, shelfDrawWidth, 22);

      // Triangular support brackets beneath the board
      ctx.fillStyle = "#3c4d59";
      for (let bx = LEFT_GAP + 45; bx < LEFT_GAP + shelfDrawWidth - 25; bx += 235) {
        ctx.beginPath();
        ctx.moveTo(bx, shelfY + SHELF_THICK);
        ctx.lineTo(bx + 11, shelfY + SHELF_THICK);
        ctx.lineTo(bx, shelfY + SHELF_THICK + 32);
        ctx.closePath();
        ctx.fill();
      }

      // Shelf board — front edge (thickness) shaded for 3D
      const boardGrad = ctx.createLinearGradient(0, shelfY, 0, shelfY + SHELF_THICK);
      boardGrad.addColorStop(0, "#dce6f0");
      boardGrad.addColorStop(0.45, "#bccadb");
      boardGrad.addColorStop(1, "#8a9cb0");
      ctx.fillStyle = boardGrad;
      ctx.fillRect(LEFT_GAP, shelfY, shelfDrawWidth, SHELF_THICK);
      // Lit top edge where items rest
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.fillRect(LEFT_GAP, shelfY - 1, shelfDrawWidth, 2);
      // Dark underside line
      ctx.fillStyle = "rgba(35,50,65,0.55)";
      ctx.fillRect(LEFT_GAP, shelfY + SHELF_THICK - 1.5, shelfDrawWidth, 1.5);
      // Right end cap for depth
      ctx.fillStyle = "rgba(55,75,92,0.6)";
      ctx.fillRect(LEFT_GAP + shelfDrawWidth, shelfY, 4, SHELF_THICK + 1);

      // 4. DRAW TABLE / BENCH
      const drawCabinet = (cabX: number, isRight: boolean) => {
        // Front face — vertical gradient (lit at the counter, darker toward floor)
        const fg = ctx.createLinearGradient(cabX, benchTopY, cabX, benchTopY + benchHeight);
        fg.addColorStop(0, "#96aabd");
        fg.addColorStop(0.5, "#7e93a7");
        fg.addColorStop(1, "#5d7183");
        ctx.fillStyle = fg;
        ctx.fillRect(cabX, benchTopY, CABINET_WIDTH, benchHeight);

        // Left edge highlight + right edge seam (panel relief)
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(cabX, benchTopY, 3, benchHeight);
        ctx.fillStyle = "rgba(25,40,55,0.30)";
        ctx.fillRect(cabX + CABINET_WIDTH - 3, benchTopY, 3, benchHeight);

        if (isRight) {
          // Angled side panel recedes (darker)
          const sg = ctx.createLinearGradient(cabX + CABINET_WIDTH, 0, cabX + CABINET_WIDTH + SIDE_DEPTH, 0);
          sg.addColorStop(0, "#5a6e80");
          sg.addColorStop(1, "#3d4d5c");
          ctx.fillStyle = sg;
          ctx.fillRect(cabX + CABINET_WIDTH, benchTopY, SIDE_DEPTH, benchHeight);
        }

        // Drawers — inset bevel + metallic bar handle
        for (let i = 0; i < 2; i++) {
          const dY = benchTopY + 30 + i * 90;
          if (dY + 70 >= canvasSize.height) continue;
          const dx = cabX + 12, dw = CABINET_WIDTH - 24, dh = 62;
          const dg = ctx.createLinearGradient(0, dY, 0, dY + dh);
          dg.addColorStop(0, "#b3c3d3");
          dg.addColorStop(1, "#8499ad");
          ctx.fillStyle = dg;
          ctx.beginPath();
          ctx.roundRect(dx, dY, dw, dh, 5);
          ctx.fill();
          // Top-left highlight
          ctx.strokeStyle = "rgba(255,255,255,0.5)";
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(dx + 1.5, dY + dh - 2);
          ctx.lineTo(dx + 1.5, dY + 1.5);
          ctx.lineTo(dx + dw - 2, dY + 1.5);
          ctx.stroke();
          // Bottom-right shadow
          ctx.strokeStyle = "rgba(28,42,56,0.5)";
          ctx.beginPath();
          ctx.moveTo(dx + dw - 1.5, dY + 2);
          ctx.lineTo(dx + dw - 1.5, dY + dh - 1.5);
          ctx.lineTo(dx + 2, dY + dh - 1.5);
          ctx.stroke();
          // Metallic bar handle
          const hw = Math.min(72, dw * 0.42);
          const hx = cabX + CABINET_WIDTH / 2 - hw / 2;
          const hy = dY + dh / 2 - 3;
          const hg = ctx.createLinearGradient(0, hy, 0, hy + 7);
          hg.addColorStop(0, "#eef3f8");
          hg.addColorStop(0.5, "#aab9c7");
          hg.addColorStop(1, "#748699");
          ctx.fillStyle = hg;
          ctx.beginPath();
          ctx.roundRect(hx, hy, hw, 7, 3.5);
          ctx.fill();
          ctx.fillStyle = "rgba(0,0,0,0.16)";
          ctx.beginPath();
          ctx.roundRect(hx, hy + 5, hw, 2, 1);
          ctx.fill();
        }
      };

      // Recessed back panel between the two cabinets
      ctx.fillStyle = "#5e7183";
      ctx.fillRect(LEFT_GAP + CABINET_WIDTH, benchTopY, tableTotalWidth - CABINET_WIDTH * 2, benchHeight / 2.5);
      const midShade = ctx.createLinearGradient(0, benchTopY, 0, benchTopY + benchHeight / 2.5);
      midShade.addColorStop(0, "rgba(0,0,0,0)");
      midShade.addColorStop(1, "rgba(0,0,0,0.38)");
      ctx.fillStyle = midShade;
      ctx.fillRect(LEFT_GAP + CABINET_WIDTH, benchTopY, tableTotalWidth - CABINET_WIDTH * 2, benchHeight / 2.5);

      drawCabinet(LEFT_GAP, false);
      drawCabinet(LEFT_GAP + tableTotalWidth - CABINET_WIDTH, true);

      // 5. COUNTERTOP — beveled front edge for a thick 3D worktop
      const topGrad = ctx.createLinearGradient(0, TABLE_Y, 0, TABLE_Y + LIP_HEIGHT);
      topGrad.addColorStop(0, "#cdd9e6");
      topGrad.addColorStop(0.2, "#b2c3d4");
      topGrad.addColorStop(1, "#7d91a5");
      ctx.fillStyle = topGrad;
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, LIP_HEIGHT);
      // Bright bevel highlight at the very top edge
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillRect(LEFT_GAP, TABLE_Y, tableTotalWidth + SIDE_DEPTH, 2);
      // Soft sheen band
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(LEFT_GAP, TABLE_Y + 3, tableTotalWidth + SIDE_DEPTH, 3);
      // Right-side depth chamfer
      ctx.fillStyle = "rgba(40,55,70,0.30)";
      ctx.fillRect(LEFT_GAP + tableTotalWidth, TABLE_Y, SIDE_DEPTH, LIP_HEIGHT);
      // Dark separation line beneath the lip
      ctx.fillStyle = "rgba(28,42,56,0.5)";
      ctx.fillRect(LEFT_GAP, TABLE_Y + LIP_HEIGHT - 2, tableTotalWidth + SIDE_DEPTH, 2);

      // ── Instrument holder stands on the shelf ──────────────────────────────
      // Draw a small bracket/dock for each instrument that lives on the shelf.
      // These show WHERE instruments belong when not in use.
      // Holders always fixed at original shelf positions
      const origHolderList = initialApparatusFor();
      const HOLDER_IDS = ["thermometer-digital","thermometer-digital-2","glass-stirring-rod","spatula","ph-meter","viscosity-gauge"];
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
      // Build a render order where every contained item is drawn immediately
      // AFTER its container, so it appears INSIDE the glass (in front of it)
      // rather than hidden behind it.  The item currently being dragged is drawn
      // last of all so it stays visible while it is lifted out.
      const dragId = draggingRef.current?.id ?? null;
      const childrenByParent = new Map<string, Apparatus[]>();
      apparatus.forEach((a) => {
        const pid = a.data?.containedInId;
        if (pid) {
          if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
          childrenByParent.get(pid)!.push(a);
        }
      });
      const renderOrder: Apparatus[] = [];
      const seen = new Set<string>();
      const pushItem = (a: Apparatus) => {
        if (seen.has(a.id)) return;
        seen.add(a.id);
        renderOrder.push(a);
        (childrenByParent.get(a.id) ?? []).forEach((kid) => {
          if (kid.id !== dragId && !seen.has(kid.id)) { seen.add(kid.id); renderOrder.push(kid); }
        });
      };
      // A container that is actively pouring is deferred so it draws AFTER its
      // target — its liquid stream then lands on top of the target beaker rather
      // than being hidden behind the target's glass.
      const isPourSrc = (a: Apparatus) =>
        !!(a.data?.isPouring && a.data?.pouringTargetId) && a.id !== dragId;
      apparatus.forEach((a) => {
        if (a.id === dragId) return;          // drawn last, on top
        if (a.data?.containedInId) return;     // drawn with its container
        if (isPourSrc(a)) return;              // deferred → drawn after its target
        pushItem(a);
      });
      // Safety: any orphan whose container no longer exists still gets drawn.
      // (Items whose parent IS present are deferred to that parent's push so a
      // dragged container's contents stay layered on top of it, not behind.)
      apparatus.forEach((a) => {
        if (a.id === dragId || seen.has(a.id)) return;
        if (isPourSrc(a)) return;              // still deferred (handled below)
        const pid = a.data?.containedInId;
        if (pid && apparatus.some((p) => p.id === pid)) return;
        pushItem(a);
      });
      // Pouring sources (and their contents) draw above their target.
      apparatus.forEach((a) => { if (isPourSrc(a)) pushItem(a); });
      // Dragged item (and its contents, if it is a container) on top
      if (dragId) { const d = apparatus.find((a) => a.id === dragId); if (d) pushItem(d); }

      // Detached caps — any open container that had its lid removed shows the cap
      // parked on its surface, so the lid doesn't simply disappear. Drawn before
      // the apparatus so a vessel set over it still reads as in front.
      apparatus.forEach((a) => {
        const off = a.data?.lidOff;
        if (off && !a.data?.hasLid)
          drawDetachedLid(ctx, off.x, off.y, off.w, a.data?.lidColor || "#64748b", !!a.data?.isSolid);
      });

      renderOrder.forEach((item) => {
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
          // While pouring, the spout sits on the leading (low) edge: tilting to
          // the right (tiltAngle < 0) drops the LEFT rim, so the spout goes left.
          const spoutSide: "left" | "right" =
            item.data?.isPouring && tiltAngle !== 0 ? (tiltAngle < 0 ? "left" : "right") : "right";
          drawBeaker(ctx, x, y, width, height, maxVol, currentVol, liquidColor, item.data?.liquidTemperature ?? 25, hotPlateFrame, item.data?.isStirring ?? false, (item.data?.solidStearicGrams ?? 0) + (item.data?.solidBeeswaxGrams ?? 0), tiltAngle, item.data?.emulsificationProgress ?? 0, spoutSide, item.data?.creamQuality ?? 1);
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
          // Drive the internal-flow animation from pour progress (which advances
          // every step) so the rising blobs move even when the hot plate is off.
          const bottleFrame = hotPlateFrame + (item.data?.pouringProgress ?? 0) * 220;
          drawBottle(
            ctx, x, y, width, height, maxVol, name,
            item.data?.hasLid ?? false, currentVol, tiltAngle, liquidColor, lidColor,
            item.data?.isSolid ?? false,
            item.data?.isPouring ?? false, bottleFrame,
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
          // Decide the spatula's working action from what its blade is over:
          //  • empty blade inside a solid jar  → chopping motion
          //  • loaded blade inside a beaker    → tipping its content out
          const bladeCX  = x + width / 2;
          const bladeBot = y + height;
          const load     = item.data?.spatulaLoad ?? 0;
          const isActive = dragging?.id === item.id;   // only while being handled
          const overSolid = apparatus.some(
            (a) => a.data?.isSolid &&
                   bladeCX  >= a.x && bladeCX  <= a.x + a.width &&
                   bladeBot >= a.y && bladeBot <= a.y + a.height,
          );
          // A loaded blade lifted clear of the solid jar is being carried and so
          // is drawn tilted up. Test the pour against where the blade is actually
          // drawn (the tilted tip), not the upright bounding box.
          const carrying = load > 0 && !overSolid;
          const tip = spatulaBladeTip(x, y, width, height, carrying);
          const overBeaker = apparatus.some(
            (a) => (a.type === "beaker" || a.type === "cylinder") &&
                   bladeOverMouth(tip.cx, tip.bot, a),
          );
          const action: "idle" | "chop" | "tip" =
            isActive && load === 0 && overSolid ? "chop" :
            isActive && load > 0  && overBeaker ? "tip"  : "idle";
          // Hold the blade well inclined (≥80°) while carrying so the scoop is
          // tipped up and the solid is cradled against the blade, not spilled.
          const tiltAngle = carrying ? CARRY_TILT : 0;
          drawSpatula(ctx, x, y, width, height, load, action, tiltAngle);
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

            // startX/Y = anchored INSIDE the liquid body (not at the bare rim),
            // so the flow is seen leaving the MAIN liquid. We step from the spout
            // lip back into the container interior — which, once the source is
            // tilted, lies along its rotated "downward" axis.
            const bodyDirX  = -Math.sin(tiltAngle);
            const bodyDirY  =  Math.cos(tiltAngle);
            const intoLiquid = Math.min(width, height) * 0.30;
            const startX = streamExitX + bodyDirX * intoLiquid;
            const startY = streamExitY + bodyDirY * intoLiquid;
            // endX/Y = the point INSIDE the target where the stream lands. It
            // enters at the lip nearest the source, then runs continuously down
            // to the rising liquid surface — so the flow looks like one unbroken
            // column from the source spout to the bottom of the target, instead
            // of stopping (discontinuously) at the mouth.
            const pourFromLeft = streamExitX <= target.x + target.width / 2;
            const endX = pourFromLeft
              ? target.x + target.width * 0.30
              : target.x + target.width * 0.70;
            // Liquid surface inside the target (matches drawBeaker / drawCylinder
            // geometry) so the stream meets the liquid as the target fills.
            const tIsCyl     = target.type === "cylinder";
            const tUsableH   = target.height * (tIsCyl ? 0.8 : 0.7);
            const tBottomPad = target.height * (tIsCyl ? 0.1 : 0.15);
            const tFloorY    = target.y + target.height - tBottomPad;
            const tMaxVol    = target.data?.maxVolume || 250;
            const tCurVol    = target.data?.currentVolume || 0;
            const tSurfaceY  = tFloorY - tUsableH * Math.min(tCurVol / tMaxVol, 1);
            // Clamp inside the beaker: below the rim, above the floor.
            const endY = Math.max(target.y + 8, Math.min(tFloorY - 2, tSurfaceY - 2));
            const progress = item.data?.pouringProgress || 0;

            // Control point sits AT the spout tip, so the stream arcs out of the
            // liquid, through the lip (the real pour point), and down to target.
            const ctrlX = streamExitX;
            const ctrlY = streamExitY + 2;

            // ── Continuous gravity stream ─────────────────────────────────────
            // A real pour is one unbroken column of liquid that leaves the
            // spout and FALLS, getting thinner as it speeds up (the same volume
            // per second is stretched over a faster-moving column → narrower).
            // We sample the spout→surface bezier and build a tapering filled
            // ribbon so the liquid visibly runs from the source straight onto
            // the surface of the liquid already in the target.
            const bezPt = (t: number): [number, number] => [
              (1-t)*(1-t)*startX + 2*(1-t)*t*ctrlX + t*t*endX,
              (1-t)*(1-t)*startY + 2*(1-t)*t*ctrlY + t*t*endY,
            ];
            const bezPerp = (t: number): [number, number] => {
              const tx = 2*(1-t)*(ctrlX-startX) + 2*t*(endX-ctrlX);
              const ty = 2*(1-t)*(ctrlY-startY) + 2*t*(endY-ctrlY);
              const tl = Math.hypot(tx, ty) || 1;
              return [-ty / tl, tx / tl];
            };
            // Half-width profile along the column: full where it leaves the
            // body, a slight bulge at the spout lip, then steadily thinning as
            // it falls to the surface. Tiny animated shimmer keeps it alive.
            const SEG = 28;
            const halfW = (t: number) => {
              const taper = 3.6 * (1 - t) + 1.3;                 // 4.9 → 1.3 px
              const lip   = Math.exp(-Math.pow((t - 0.5) / 0.16, 2)) * 1.1; // bulge at spout
              const ripple = Math.sin(t * 22 - progress * Math.PI * 8) * 0.35 * t;
              return taper + lip + ripple;
            };

            const buildRibbon = (scale: number, dx: number) => {
              ctx.beginPath();
              for (let i = 0; i <= SEG; i++) {           // left edge, top → bottom
                const t = i / SEG;
                const [bx, by] = bezPt(t);
                const [px, py] = bezPerp(t);
                const hw = halfW(t) * scale;
                if (i === 0) ctx.moveTo(bx + dx - px*hw, by - py*hw);
                else         ctx.lineTo(bx + dx - px*hw, by - py*hw);
              }
              for (let i = SEG; i >= 0; i--) {           // right edge, bottom → top
                const t = i / SEG;
                const [bx, by] = bezPt(t);
                const [px, py] = bezPerp(t);
                const hw = halfW(t) * scale;
                ctx.lineTo(bx + dx + px*hw, by + py*hw);
              }
              ctx.closePath();
            };

            // Soft outer glow
            ctx.fillStyle = sc(0.22);
            buildRibbon(2.2, 0);
            ctx.fill();
            // Translucent body
            ctx.fillStyle = sc(0.6);
            buildRibbon(1.35, 0);
            ctx.fill();
            // Opaque core
            ctx.fillStyle = sc(0.95);
            buildRibbon(1.0, 0);
            ctx.fill();
            // Specular highlight running down one side of the column
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            buildRibbon(0.3, -1.1);
            ctx.fill();

            // ── Gentle surface contact where the stream meets the liquid ──────
            // No violent splash — just a small bright dimple and a couple of
            // soft ripple rings spreading on the surface, as in a real pour.
            const splashP = 0.55 + 0.45 * Math.sin(progress * Math.PI * 2);
            for (let ring = 0; ring < 2; ring++) {
              const rt = ((progress * 2.2 + ring * 0.5) % 1);
              ctx.strokeStyle = sc((1 - rt) * 0.4);
              ctx.lineWidth = 1.2;
              ctx.beginPath();
              ctx.ellipse(endX, endY + 1, rt * 13 + 2, (rt * 13 + 2) * 0.32, 0, 0, Math.PI * 2);
              ctx.stroke();
            }
            // Bright contact dimple at the point of entry
            const dimpleR = 3 + splashP * 2.5;
            const dg = ctx.createRadialGradient(endX, endY, 0, endX, endY, dimpleR);
            dg.addColorStop(0, sc(0.95));
            dg.addColorStop(1, sc(0));
            ctx.fillStyle = dg;
            ctx.beginPath();
            ctx.ellipse(endX, endY, dimpleR, dimpleR * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();

            // Bright glow dot at the spout tip — the visible pour point (lip)
            ctx.fillStyle = sc(0.92);
            ctx.beginPath();
            ctx.arc(streamExitX, streamExitY, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
            ctx.beginPath();
            ctx.arc(streamExitX - 1.5, streamExitY - 1.5, 2.2, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
          }
        }
      });
    },
    [canvasSize, apparatus, benchHeight, tableTotalWidth, hoveredId, hotPlateFrame, initialApparatusFor],
  );

  useEffect(() => {
    const handleResize = () => {
      // Walk up to find the scrollable wrapper (.lab-canvas-wrap or similar)
      const container = canvasRef.current?.parentElement;
      if (container) {
        const w = Math.max(container.clientWidth,  MIN_SCENE_WIDTH);
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

  // ── Ambient sound cues ──────────────────────────────────────────────────────
  // Drive the procedural sound loops from the matching simulation state so the
  // lab feels physical: a rolling boil once any sample is hot, a swish while
  // stirring, and a trickle while a container is pouring.
  const anyBoiling = apparatus.some(
    (a) => (a.type === "beaker" || a.type === "cylinder") &&
      (a.data?.currentVolume ?? 0) > 0 && (a.data?.liquidTemperature ?? 25) > 70,
  );
  const anyPouring = apparatus.some((a) => a.data?.isPouring);

  const [soundMuted, setSoundMuted] = useState(soundManager.isMuted());
  useEffect(() => { soundManager.setMuted(soundMuted); }, [soundMuted]);
  useEffect(() => { soundManager.setLoop("boiling", anyBoiling); }, [anyBoiling]);
  useEffect(() => { soundManager.setLoop("stirring", anyStirring); }, [anyStirring]);
  useEffect(() => { soundManager.setLoop("pouring", anyPouring); }, [anyPouring]);
  // Silence every loop when the canvas unmounts
  useEffect(() => () => {
    soundManager.setLoop("boiling", false);
    soundManager.setLoop("stirring", false);
    soundManager.setLoop("pouring", false);
  }, []);

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
            // Off the plate, the ambient-cooling loop relaxes the sample toward
            // room temperature (Newton's law); the ice bucket cools it further.
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

  // Ambient cooling — Newton's law of cooling toward the live room temperature.
  //
  //     T(t+dt) = T_room + (T − T_room) · e^(−dt/τ)
  //
  // Applies to any beaker/cylinder that is NOT actively heated on the hot plate
  // and NOT sitting in the ice bucket.  Still air cools a beaker slowly, so the
  // time constant τ is deliberately large — and even larger once the sample
  // drops near body/room warmth (≤50 °C), where natural convection almost
  // stalls.  To pull a hot melt down quickly the student must use the ice bath.
  //   • above 50 °C → τ ≈ 150 s  (gentle, realistic still-air cooling)
  //   • at/below 50 °C → τ ≈ 600 s (crawls toward room temp)
  // Because the sample relaxes toward roomTemp (from real weather), a cooler
  // room cools samples a little faster, a warmer room slower.  A sample below
  // room temperature (just lifted from the ice bath) warms back up the same way.
  useEffect(() => {
    const TICK_MS  = 150;
    const TAU_HOT  = 150;   // s, while still hot (> 50 °C)
    const TAU_COOL = 600;   // s, once near room warmth (≤ 50 °C)
    const factorHot  = Math.exp(-(TICK_MS / 1000) / TAU_HOT);
    const factorCool = Math.exp(-(TICK_MS / 1000) / TAU_COOL);
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const hp     = prev.find((a) => a.type === "hotplate");
        const bucket = prev.find((a) => a.type === "icebucket");
        let changed = false;

        const next = prev.map((a) => {
          if (a.type !== "beaker" && a.type !== "cylinder") return a;

          const cx  = a.x + a.width / 2;
          const bot = a.y + a.height;

          // Skip while actively heated on a switched-on hot plate
          if (hp && hp.data?.isOn) {
            const onHP = Math.abs(bot - hp.y) < 8 && cx >= hp.x && cx <= hp.x + hp.width;
            if (onHP) return a;
          }
          // Skip while in the ice bucket (handled by the ice-cooling loop)
          if (bucket) {
            const inBucket =
              cx  >= bucket.x + 10 && cx  <= bucket.x + bucket.width - 10 &&
              bot >= bucket.y + 20  && bot <= bucket.y + bucket.height + 10;
            if (inBucket) return a;
          }

          const curT = a.data?.liquidTemperature ?? roomTemp;
          if (Math.abs(curT - roomTemp) < 0.15) return a;   // already at room temp
          const factor = curT > 50 ? factorHot : factorCool;
          const newT = roomTemp + (curT - roomTemp) * factor;
          changed = true;
          return { ...a, data: { ...a.data, liquidTemperature: newT } };
        });

        return changed ? next : prev;
      });
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [roomTemp]);

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

          // ── Product quality (0..1) — drives the FINAL cream colour ──
          // A well-made batch (correct ratios + mixed warm) becomes a clean
          // white vanishing-cream colour; a poorly-made one stays dull/off-white
          // so the visual result honestly reflects what was produced.
          const total = Object.values(comp).reduce((s, v) => s + (v || 0), 0) || 1;
          const band  = (v: number, lo: number, hi: number) =>
            v >= lo && v <= hi ? 1 : v >= lo - 5 && v <= hi + 5 ? 0.5 : 0;
          let ratioQ: number;
          if (isColdCream) {
            ratioQ = (band((comp.beeswax ?? 0) / total * 100, 10, 16)
                    + band((comp.liquidParaffin ?? 0) / total * 100, 34, 46)
                    + band((comp.water ?? 0) / total * 100, 38, 52)) / 3;
          } else {
            ratioQ = (band((comp.stearicAcid ?? 0) / total * 100, 15, 20)
                    + band((comp.liquidParaffin ?? 0) / total * 100, 5, 10)
                    + band((comp.water ?? 0) / total * 100, 60, 75)) / 3;
          }
          const mixedWarm = (a.data?.mixedWarm ?? false) || temp >= 55;
          const quality   = Math.max(0, Math.min(1, ratioQ * (mixedWarm ? 1 : 0.55)));

          // Interpolate liquidColor from the mixed base toward a quality-dependent
          // target: clean white when good, dull greyish-tan when poor.
          const tC   = Math.max(0, (newProg - 20) / 80);
          const tgtR = 200 + 55 * quality;   // poor 200 → good 255
          const tgtG = 190 + 62 * quality;   // poor 190 → good 252
          const tgtB = 170 + 78 * quality;   // poor 170 → good 248
          const r  = Math.round(210 + (tgtR - 210) * tC);
          const g  = Math.round(195 + (tgtG - 195) * tC);
          const b  = Math.round(170 + (tgtB - 170) * tC);
          const al = (0.62 + 0.33 * tC * (0.5 + 0.5 * quality)).toFixed(2);
          const newColor = `rgba(${r},${g},${b},${al})`;

          return {
            ...a,
            data: {
              ...a.data,
              emulsificationProgress: newProg,
              liquidColor: newColor,
              mixedWarm,
              creamQuality: quality,
            },
          };
        }),
      );
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // Thermometer thermal lag — every thermometer independently drifts its reading
  // toward the liquid it's dipped into, or back toward room temperature when
  // lifted out.  Two thermometers let the student read both phases at once.
  useEffect(() => {
    const interval = setInterval(() => {
      setApparatus((prev) => {
        const thermos = prev.filter((a) => a.type === "thermometer");
        if (thermos.length === 0) return prev;

        const updates: Record<string, number> = {};
        let changed = false;
        for (const thermo of thermos) {
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
          // Probe outside → drift back to the live room temperature
          const targetTemp = beakerUnder?.data?.liquidTemperature ?? roomTemp;
          const current    = thermo.data?.readingTemperature ?? roomTemp;
          if (Math.abs(current - targetTemp) < 0.1) continue;

          const rate = beakerUnder ? 2.0 : 0.8;   // fast when dipped, slow when removed
          updates[thermo.id] =
            current < targetTemp
              ? Math.min(current + rate, targetTemp)
              : Math.max(current - rate, targetTemp);
          changed = true;
        }

        if (!changed) return prev;
        return prev.map((a) =>
          a.id in updates ? { ...a, data: { ...a.data, readingTemperature: updates[a.id] } } : a,
        );
      });
    }, 80);   // check every 80 ms
    return () => clearInterval(interval);
  }, [roomTemp]);

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
              // The pour event triggers the check, but the warning is judged on the
              // TOTAL of this ingredient now in the beaker — not the single pour —
              // so students who build up the amount over several pours are graded
              // on the accumulated quantity.
              const added = +((endComp[key] ?? 0) - (startComp[key] ?? 0)).toFixed(1);
              if (added < 0.02) return;
              const total = +(endComp[key] ?? 0).toFixed(1);
              const min = +(baseMin * multiplier).toFixed(2);
              const max = +(baseMax * multiplier).toFixed(2);
              if (total >= min && total <= max) {
                addNotif(`✓ ${label}: ${total} ${unit}`, "success",
                  `Correct amount — target ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} total: ${total} ${unit} ✓`);
              } else if (total < min) {
                addNotif(`⚠ ${label}: ${total} ${unit} — too little`, "warning",
                  `Target is ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} total: ${total} ${unit} ⚠ too little`);
              } else {
                addNotif(`⚠ ${label}: ${total} ${unit} — too much`, "warning",
                  `Target is ${min}–${max} ${unit}`);
                logLabMilestone(practicalId, `${label} total: ${total} ${unit} ⚠ too much`);
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
          // Beaker/cylinder-to-beaker transfer completed.  Only call this a phase
          // COMBINATION when the target beaker NOW genuinely holds BOTH an oil-phase
          // and an aqueous-phase component.  Pouring a single liquid into a beaker is
          // just a transfer, not a mix — claiming "phases combined" there would be a
          // false alert, so we report the transfer truthfully instead.
          const tid     = p.data?.pouringTargetId ?? "";
          const tgt     = apparatus.find((a) => a.id === tid);
          const comp    = (tgt?.data?.composition ?? {}) as Record<string, number>;
          const present = (v?: number) => (v ?? 0) > 0.02;
          // Oil phase = stearic acid / liquid paraffin / beeswax (incl. un-melted solids).
          const hasOil =
            present(comp.stearicAcid) || present(comp.liquidParaffin) || present(comp.beeswax) ||
            present(tgt?.data?.solidStearicGrams) || present(tgt?.data?.solidBeeswaxGrams);
          // Aqueous phase = water / borax / glycerin / KOH-triethanolamine.
          const hasAqueous =
            present(comp.water) || present(comp.borax) || present(comp.glycerin) || present(comp.koh);

          if (hasOil && hasAqueous) {
            addNotif("Phases combined ✓", "success", "Continue stirring to complete emulsification");
            logLabMilestone(practicalId, "Oil and aqueous phases combined in mixing beaker");
          } else if (tgt) {
            // Single-phase transfer — say what actually happened, not "combined".
            addNotif(`Liquid transferred into ${tgt.name}`, "info",
              hasOil ? "Oil phase only — add the aqueous phase to combine"
                     : hasAqueous ? "Aqueous phase only — add the oil phase to combine"
                     : undefined);
          }
          // Always clean up the snapshot to prevent orphan entries
          delete pourStartRef.current[tid];
        }
      }

      // ── Beaker / cylinder — temperature milestones & solid deposit ─────────
      if (curr.type === "beaker" || curr.type === "cylinder") {
        const prevT = p.data?.liquidTemperature ?? 25;
        const currT = curr.data?.liquidTemperature ?? 25;
        const name  = curr.name;

        // Only announce melting when the beaker ACTUALLY contains stearic acid —
        // either still solid, or already melted into the composition.  A beaker of
        // plain water crossing 70°C must not claim "stearic acid melting".
        const hasStearic =
          (p.data?.solidStearicGrams ?? 0) > 0 || (curr.data?.solidStearicGrams ?? 0) > 0 ||
          (p.data?.composition?.stearicAcid ?? 0) > 0 || (curr.data?.composition?.stearicAcid ?? 0) > 0;
        if (prevT < 70 && currT >= 70 && hasStearic && hit(`melt-${curr.id}`)) {
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

        // Solid stearic acid deposited by spatula (instant, not a pour animation).
        // The deposit triggers the check, but the warning is judged on the TOTAL
        // stearic acid now in the beaker — not the single spatula load — so a charge
        // built up over several scoops is graded on the accumulated quantity.
        const prevSolid = p.data?.solidStearicGrams ?? 0;
        const currSolid = curr.data?.solidStearicGrams ?? 0;
        if (currSolid > prevSolid) {
          const total  = +currSolid.toFixed(1);
          const sMin   = +(15 * multiplier).toFixed(1);
          const sMax   = +(20 * multiplier).toFixed(1);
          const sWarnL = +(12 * multiplier).toFixed(1);
          const sWarnH = +(23 * multiplier).toFixed(1);
          const hint   = `Target is ${sMin}–${sMax} g`;
          if (total >= sMin && total <= sMax) {
            addNotif(`✓ Stearic acid: ${total} g`, "success", `Correct amount (${hint})`);
            logLabMilestone(practicalId, `Stearic acid total: ${total} g ✓ (target ${sMin}–${sMax} g)`);
          } else if (total >= sWarnL && total <= sWarnH) {
            addNotif(`⚠ Stearic acid: ${total} g — marginal`, "warning", `${hint} — borderline amount`);
            logLabMilestone(practicalId, `Stearic acid total: ${total} g ⚠ borderline (target ${sMin}–${sMax} g)`);
          } else if (total < sWarnL) {
            addNotif(`✗ Stearic acid: ${total} g — too little`, "error", hint);
            logLabMilestone(practicalId, `Stearic acid total: ${total} g ✗ too little (target ${sMin}–${sMax} g)`);
          } else {
            addNotif(`✗ Stearic acid: ${total} g — too much`, "error", hint);
            logLabMilestone(practicalId, `Stearic acid total: ${total} g ✗ too much (target ${sMin}–${sMax} g)`);
          }
        }

        // Solid beeswax deposited by spatula (cold cream).
        // Judged on the TOTAL beeswax now in the beaker — not the single spatula
        // load — so a charge built up over several scoops is graded on the
        // accumulated quantity.
        const prevWax = p.data?.solidBeeswaxGrams ?? 0;
        const currWax = curr.data?.solidBeeswaxGrams ?? 0;
        if (currWax > prevWax) {
          const total  = +currWax.toFixed(1);
          const wMin   = +(10 * multiplier).toFixed(1);
          const wMax   = +(16 * multiplier).toFixed(1);
          const wWarnL = +(8  * multiplier).toFixed(1);
          const wWarnH = +(18 * multiplier).toFixed(1);
          const hint   = `Target is ${wMin}–${wMax} g`;
          if (total >= wMin && total <= wMax) {
            addNotif(`✓ Beeswax: ${total} g`, "success", `Correct amount (${hint})`);
            logLabMilestone(practicalId, `Beeswax total: ${total} g ✓ (target ${wMin}–${wMax} g)`);
          } else if (total >= wWarnL && total <= wWarnH) {
            addNotif(`⚠ Beeswax: ${total} g — marginal`, "warning", `${hint} — borderline amount`);
            logLabMilestone(practicalId, `Beeswax total: ${total} g ⚠ borderline (target ${wMin}–${wMax} g)`);
          } else if (total < wWarnL) {
            addNotif(`✗ Beeswax: ${total} g — too little`, "error", hint);
            logLabMilestone(practicalId, `Beeswax total: ${total} g ✗ too little (target ${wMin}–${wMax} g)`);
          } else {
            addNotif(`✗ Beeswax: ${total} g — too much`, "error", hint);
            logLabMilestone(practicalId, `Beeswax total: ${total} g ✗ too much (target ${wMin}–${wMax} g)`);
          }
        }
      }

      // ── Stirring rod ───────────────────────────────────────────────────────
      if (curr.type === "stirringrod" && !p.data?.isStirring && curr.data?.isStirring) {
        // Only claim "emulsification" when actually stirring a beaker that HAS content.
        // Stirring an empty (or off-target) beaker shouldn't promise an emulsion.
        const stgt   = apparatus.find((a) => a.id === curr.data?.stirringTargetId);
        const scomp  = (stgt?.data?.composition ?? {}) as Record<string, number>;
        const hasContent =
          Object.values(scomp).some((v) => (v ?? 0) > 0.02) ||
          (stgt?.data?.solidStearicGrams ?? 0) > 0 || (stgt?.data?.solidBeeswaxGrams ?? 0) > 0;
        if (hasContent) {
          addNotif("Stirring in progress", "info", "Hold for at least 30 seconds for full emulsification");
          logLabMilestone(practicalId, "Stirring started — mixing phases");
        }
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

  // Shared press logic for mouse and touch.  Returns what it set up so the
  // caller (touch) can decide on long-press / tap handling.
  const pointerDownAt = (
    clientX: number, clientY: number, kind: "mouse" | "touch",
  ): "stir" | "lid" | "drag" | "none" => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return "none";
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const clicked = apparatus.find(
      (a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
    );
    if (!clicked) return "none";

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
        // Pressing ANY part of the rod (top or bottom) stirs the beaker. We also
        // arm a drag: if the pointer then moves clearly, the stir converts into a
        // drag so the rod can still be lifted out / repositioned (handled in
        // handleMouseMove). A press without movement is a pure stir.
        holdStirRef.current = { rodId: clicked.id, targetId: beakerUnder.id };
        setApparatus((prev) =>
          prev.map((a) =>
            a.id === clicked.id || a.id === beakerUnder.id
              ? { ...a, data: { ...a.data, isStirring: true, stirringTargetId: beakerUnder.id } }
              : a,
          ),
        );
        const dragState = { id: clicked.id, offsetX: x - clicked.x, offsetY: y - clicked.y };
        draggingRef.current = dragState;
        dragStartRef.current = { x: clientX, y: clientY };
        dragMovedRef.current = false;
        setDragging(dragState);
        if (kind === "mouse") {
          window.addEventListener("mousemove", handleMouseMove);
          window.addEventListener("mouseup", handleMouseUp);
        }
        return "stir";
      }
    }

    // Lid handling — only the CAP/neck region opens the lid modal, so the body
    // of a closed container can still be grabbed and dragged.  Geometry mirrors
    // drawBottle (wide cap for solid jars, narrow for liquids).
    if (clicked.type === "bottle" || clicked.type === "container") {
      const solid = !!clicked.data?.isSolid;
      const capH  = solid ? Math.max(clicked.height * 0.13, 10) : Math.max(clicked.height * 0.09, 7);
      const neckH = solid ? Math.max(clicked.height * 0.04, 3)  : Math.max(clicked.height * 0.07, 5);
      const neckW = solid ? Math.max(clicked.width * 0.74, 30)  : Math.max(clicked.width * 0.34, 11);
      const capW  = solid ? Math.min(clicked.width * 0.94, neckW + 12) : neckW + 6;
      const ccx   = clicked.x + clicked.width / 2;
      const inLidZone =
        x >= ccx - capW / 2 - 3 && x <= ccx + capW / 2 + 3 &&
        y >= clicked.y - 2 && y <= clicked.y + capH + neckH + 2;
      if (inLidZone) {
        setShowLidModal({ id: clicked.id });
        return "lid";
      }
      // else fall through → drag the container (lid stays as-is)
    }

    const dragState = { id: clicked.id, offsetX: x - clicked.x, offsetY: y - clicked.y };
    draggingRef.current = dragState;
    dragStartRef.current = { x: clientX, y: clientY };
    dragMovedRef.current = false;
    // Seed table-surface contact from where the item is grabbed (the move
    // updater keeps it current thereafter). If it's grabbed off the table
    // (e.g. from the shelf) treat it as already airborne so bringing it down
    // onto the bench produces a landing knock.
    dragOnTableRef.current = Math.abs(clicked.y + clicked.height - TABLE_Y) < 2;
    dragLiftedRef.current  = !dragOnTableRef.current;
    dragTypeRef.current    = clicked.type;
    collidingRef.current   = new Set();   // fresh collision tracking for this drag
    lastMovePosRef.current = { x: clientX, y: clientY };
    setDragging(dragState);
    // Tactile pick-up "click" — only for the beaker, measuring cylinder and
    // containers; other apparatus (hot-plate, ice-bath, instruments) are silent.
    if (GRAB_SOUND_TYPES.includes(clicked.type)) soundManager.grab();
    if (kind === "mouse") {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return "drag";
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only the left button drags / stirs. Right-click is reserved for the
    // context menu (handled by onContextMenu) so it must never start a stir.
    if (e.button !== 0) return;
    e.preventDefault();
    pointerDownAt(e.clientX, e.clientY, "mouse");
  };

  const handleMouseMove = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const drag = draggingRef.current;   // always fresh — no stale closure
      if (!drag) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Mark as a real drag only once the pointer travels a few px — keeps a
      // click / double-click from being treated as a drag (e.g. spurious pour).
      if (dragStartRef.current) {
        const dxm = e.clientX - dragStartRef.current.x;
        const dym = e.clientY - dragStartRef.current.y;
        if (Math.hypot(dxm, dym) > 4) dragMovedRef.current = true;
      }
      // Per-tick pointer travel — drives both the airborne "clink" loudness and
      // the on-bench sliding "scrape" level.
      const prevPos = lastMovePosRef.current;
      const moveSpeed = prevPos ? Math.hypot(e.clientX - prevPos.x, e.clientY - prevPos.y) : 0;
      // Glass "clink" when a beaker / cylinder / container is carried through the
      // air and knocks into a beaker — not while sliding along the bench. Gated on
      // dragOnTableRef (false ⇒ airborne) and fired on the rising edge of each
      // overlap so a single bump rings once, not every move tick. Pointer speed
      // scales the loudness so a gentle nudge is softer than a hard knock.
      if (
        dragMovedRef.current && !holdStirRef.current && !dragOnTableRef.current &&
        dragTypeRef.current && COLLISION_SOUND_TYPES.includes(dragTypeRef.current)
      ) {
        const apps = latestApparatusRef.current;
        const me = apps.find((a) => a.id === drag.id);
        if (me) {
          const nowHit = new Set<string>();
          for (const b of apps) {
            if (b.type !== "beaker" || b.id === drag.id) continue;
            if (b.data?.containedInId === drag.id || me.data?.containedInId === b.id) continue;
            const overlap =
              me.x < b.x + b.width && me.x + me.width > b.x &&
              me.y < b.y + b.height && me.y + me.height > b.y;
            if (!overlap) continue;
            nowHit.add(b.id);
            if (!collidingRef.current.has(b.id))
              soundManager.clink(0.4 + Math.min(1, moveSpeed / 18) * 0.6);
          }
          collidingRef.current = nowHit;
        }
      }
      lastMovePosRef.current = { x: e.clientX, y: e.clientY };
      // Once the item leaves the table top, remember it was airborne so the
      // landing "knock" can fire when it next touches the table.
      if (!dragOnTableRef.current) dragLiftedRef.current = true;
      // While stirring, keep the rod still until the pointer clearly moves; once
      // it does, stop the swirl and let the press become a drag (lift the rod).
      if (holdStirRef.current) {
        if (!dragMovedRef.current) return;
        const { rodId, targetId } = holdStirRef.current;
        holdStirRef.current = null;
        setApparatus((prev) =>
          prev.map((a) =>
            a.id === rodId || a.id === targetId
              ? { ...a, data: { ...a.data, isStirring: false } }
              : a,
          ),
        );
      }
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
        const draggedApp = prev.find((a) => a.id === drag.id);
        let carryDx = 0, carryDy = 0;
        const moved = prev.map((app) => {
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

            // Keep a clear gap below the top bar so apparatus never touches it.
            const TOP_CLEARANCE = NAV_BAR_HEIGHT + 16;
            const boundedX = Math.max(0, Math.min(x - drag.offsetX, canvasSize.width - app.width));
            const boundedY = Math.max(TOP_CLEARANCE, Math.min(newY, canvasSize.height - app.height));
            // Track table-surface contact so friction/landing sounds only play
            // while the item is actually resting on the table (not mid-air, on
            // the shelf, in a beaker, on the hot plate, etc.).
            dragOnTableRef.current = Math.abs(boundedY + app.height - TABLE_Y) < 2;
            carryDx = boundedX - app.x;
            carryDy = boundedY - app.y;
            return { ...app, x: boundedX, y: boundedY };
          }
          return app;
        });

        // When a container (beaker, cylinder OR a solid jar holding a spatula)
        // is dragged, its contents travel with it and keep resting inside — you
        // can't separate them by moving the container; lift the item out instead.
        if (draggedApp && (carryDx !== 0 || carryDy !== 0) &&
            moved.some((a) => a.data?.containedInId === drag.id)) {
          const newContainer = { ...draggedApp, x: draggedApp.x + carryDx, y: draggedApp.y + carryDy };
          return moved.map((app) =>
            app.data?.containedInId === drag.id
              ? { ...app, x: app.x + carryDx, y: restYInside(app, newContainer) }
              : app,
          );
        }
        return moved;
      });

      // Sliding friction "scrape" — only while the item is actually resting on
      // and moving along the table (dragOnTableRef was refreshed above), never
      // while it is lifted through the air. Limited to bench-able apparatus.
      if (
        dragMovedRef.current && dragOnTableRef.current && moveSpeed > 0.6 &&
        dragTypeRef.current && SLIDE_SOUND_TYPES.includes(dragTypeRef.current)
      ) {
        soundManager.slide(moveSpeed);
      }
    },
    [TABLE_Y, shelfY, canvasSize, NAV_BAR_HEIGHT],   // dragging removed — we read from ref instead
  );

  const handleMouseUp = useCallback(() => {
    // Any in-progress sliding scrape ends the instant the item is set down.
    soundManager.endSlide();
    // Release hold-to-stir (a press with no real drag → pure stir).
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
      // The stir also armed a drag (so it could convert on movement). Since no
      // drag happened, tear that down too.
      draggingRef.current = null;
      dragStartRef.current = null;
      dragMovedRef.current = false;
      setDragging(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      return;
    }

    if (dragging) {
      const didMove = dragMovedRef.current;
      if (didMove) {
        pushHistory(); // ← snapshot the position before a real drag is finalised
        // Landing "knock" only for glassware containers, and only when they
        // actually come down onto the table surface from the air — sliding flat
        // along the bench, or setting down on the shelf / hot plate, is silent.
        const t = dragTypeRef.current;
        if (t && DROP_SOUND_TYPES.includes(t) && dragOnTableRef.current && dragLiftedRef.current)
          soundManager.drop();
      }
      // Check if dropped over a valid target (beaker or cylinder, lid off).
      // Only when the container was actually dragged — a plain click/double-click
      // must never raise the pour prompt.
      const dragged = apparatus.find((a) => a.id === dragging.id);
      if (
        didMove &&
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

      // Containment — an instrument lowered into a beaker/cylinder becomes part
      // of it: it snaps to rest on the inner floor (never touching the table)
      // and is tagged so it travels with the container.  Lifted clear, the tag
      // is removed so it sits on the table/shelf again.
      if (dragged && CONTAINABLE_TYPES.includes(dragged.type)) {
        const container = findContainerFor(dragged, apparatus);
        setApparatus((prev) =>
          prev.map((a) => {
            if (a.id !== dragged.id) return a;
            if (container) {
              return { ...a, y: restYInside(a, container), data: { ...a.data, containedInId: container.id } };
            }
            return { ...a, data: { ...a.data, containedInId: null } };
          }),
        );
      }

      // Spatula drop — auto-scoop from bottle OR auto-deposit into beaker
      if (dragged && dragged.type === "spatula") {
        const currentLoad = dragged.data?.spatulaLoad ?? 0;
        // Upright tip for the empty-blade scoop test; tilted tip (matching how a
        // carried, loaded blade is drawn) for the deposit test.
        const uprightCX = dragged.x + dragged.width / 2;
        const uprightY  = dragged.y + dragged.height;
        const carriedTip = spatulaBladeTip(dragged.x, dragged.y, dragged.width, dragged.height, currentLoad > 0);

        if (currentLoad > 0) {
          // Loaded — deposit only when the blade (chopping head) is aimed into
          // the beaker's mouth, mirroring how a real scoop is tipped over the rim.
          const beakerTarget = apparatus.find(
            (a) =>
              (a.type === "beaker" || a.type === "cylinder") &&
              bladeOverMouth(carriedTip.cx, carriedTip.bot, a),
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
              uprightCX >= a.x && uprightCX <= a.x + a.width &&
              uprightY  >= a.y && uprightY  <= a.y + a.height,
          );
          if (solidContainer) {
            const density   = solidContainer.data?.density ?? 0.847;
            const available = Math.floor((solidContainer.data?.currentVolume ?? 0) * density);
            if (available > 0) {
              // Scaled default: 18g stearic or 12g beeswax, multiplied by assignment multiplier
              const baseGrams    = solidContainer.id === "container-beeswax" ? 12 : 18;
              const defaultGrams = Math.max(1, Math.round(baseGrams * multiplier));
              // Capped by what's left AND by the most a spatula can carry at once
              const maxScoop     = Math.min(available, MAX_SPATULA_LOAD);
              setSelectedScoopGrams(Math.min(defaultGrams, maxScoop));
              setShowScoopModal({ spatulaId: dragged.id, sourceId: solidContainer.id, maxGrams: maxScoop });
            }
          }
        }
      }
    }
    draggingRef.current = null;
    dragStartRef.current = null;
    dragMovedRef.current = false;
    dragOnTableRef.current = false;
    dragLiftedRef.current = false;
    dragTypeRef.current = null;
    collidingRef.current = new Set();
    lastMovePosRef.current = null;
    setDragging(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }, [dragging, apparatus, handleMouseMove]);

  // ── Shared tap / double-tap / context-menu handlers (mouse + touch) ────────
  const canvasContextMenuAt = (x: number, y: number, clientX: number, clientY: number) => {
    setMoveMenu(null);
    setLidContextMenu(null);
    const clicked = apparatus.find(
      (a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
    );
    if (!clicked) return;
    // Lid menu for bottles/containers; move menu for everything else
    if (clicked.type === "bottle" || clicked.type === "container")
      setLidContextMenu({ id: clicked.id, x: clientX, y: clientY });
    else
      setMoveMenu({ id: clicked.id, x: clientX, y: clientY });
  };

  const canvasDoubleTapAt = (x: number, y: number) => {
    const clicked = apparatus.find(
      (a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
    );
    if (clicked && (clicked.type === "bottle" || clicked.type === "container"))
      setShowLidModal({ id: clicked.id });
  };

  const canvasTapAt = (x: number, y: number) => {
    if (lidContextMenu) { setLidContextMenu(null); return; }
    if (moveMenu) { setMoveMenu(null); return; }

    // Viscosity gauge tap — activate spindle measurement
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
        setApparatus((prev) =>
          prev.map((a) =>
            a.id === viscGauge.id ? { ...a, data: { ...a.data, isViscosityActive: true, viscosityReading: 0 } } : a,
          ),
        );
        setTimeout(() => {
          setApparatus((prev) =>
            prev.map((a) =>
              a.id === viscGauge.id ? { ...a, data: { ...a.data, isViscosityActive: false } } : a,
            ),
          );
        }, 3000);
        return;
      }
    }

    const clicked = apparatus.find(
      (a) => x >= a.x && x <= a.x + a.width && y >= a.y && y <= a.y + a.height,
    );
    if (clicked) {
      if (clicked.type === "hotplate") {
        const topH = clicked.height * 0.42;
        const frontH = clicked.height - topH;
        const frontY = clicked.y + topH;
        const btnR = Math.min(frontH * 0.34, 12);
        const btnCX = clicked.x + btnR + 5;
        const btnCY = frontY + frontH / 2;
        const dx = x - btnCX;
        const dy = y - btnCY;
        if (Math.sqrt(dx * dx + dy * dy) <= btnR + 4) {
          soundManager.click(!(clicked.data?.isOn ?? false));
          setApparatus((prev) =>
            prev.map((a) =>
              a.type === "hotplate"
                ? { ...a, data: { ...a.data, isOn: !a.data?.isOn, temperature: a.data?.isOn ? 25 : (a.data?.temperature ?? 25) } }
                : a,
            ),
          );
          return;
        }
        // Temperature (heat-range) knob — only this opens the temperature modal.
        // Matches the knob geometry drawn in drawHotPlate().
        const knobCX = clicked.x + clicked.width - btnR - 5;
        const knobCY = frontY + frontH / 2;
        const knobR  = frontH * 0.3;
        const kdx = x - knobCX;
        const kdy = y - knobCY;
        if (Math.sqrt(kdx * kdx + kdy * kdy) <= knobR + 4) {
          setSelectedApparatus(clicked);
          setShowHotPlateModal(true);
          return;
        }
        // Any other part of the hot plate just selects it — no modal.
        setSelectedApparatus(clicked);
        return;
      }
      setSelectedApparatus(clicked);
    }
  };

  // ── Touch handlers (registered natively so preventDefault works) ───────────
  const clearLongPress = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const onCanvasTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) {        // multi-touch → cancel any interaction
      clearLongPress();
      draggingRef.current = null;
      panningRef.current = null;
      return;
    }
    const t = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = t.clientX - rect.left;
    const y = t.clientY - rect.top;
    touchStartRef.current = { clientX: t.clientX, clientY: t.clientY, x, y, time: Date.now() };
    longPressFiredRef.current = false;

    const result = pointerDownAt(t.clientX, t.clientY, "touch");
    if (result === "none") {
      // Empty area → drag to pan the view horizontally
      const wrap = canvasRef.current?.parentElement;
      panningRef.current = wrap ? { startX: t.clientX, scrollLeft: wrap.scrollLeft } : null;
      return;
    }
    e.preventDefault();   // grabbed an apparatus → suppress scroll & synthetic mouse
    if (result === "drag") {
      // Hold still on a draggable → open its context menu (like a right-click)
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTimerRef.current = null;
        longPressFiredRef.current = true;
        draggingRef.current = null;
        setDragging(null);
        dragMovedRef.current = false;
        canvasContextMenuAt(x, y, t.clientX, t.clientY);
      }, 500);
    }
  };

  const onCanvasTouchMove = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    if (panningRef.current) {
      const wrap = canvasRef.current?.parentElement;
      if (wrap) wrap.scrollLeft = panningRef.current.scrollLeft - (t.clientX - panningRef.current.startX);
      e.preventDefault();
      return;
    }
    if (touchStartRef.current) {
      const d = Math.hypot(t.clientX - touchStartRef.current.clientX, t.clientY - touchStartRef.current.clientY);
      if (d > 8) clearLongPress();   // a real move → no context menu
    }
    if (draggingRef.current) {
      e.preventDefault();
      handleMouseMove({ clientX: t.clientX, clientY: t.clientY });
    }
  };

  const onCanvasTouchEnd = () => {
    clearLongPress();
    if (panningRef.current) { panningRef.current = null; touchStartRef.current = null; return; }
    if (longPressFiredRef.current) {     // context menu already shown
      longPressFiredRef.current = false;
      draggingRef.current = null;
      setDragging(null);
      dragMovedRef.current = false;
      touchStartRef.current = null;
      return;
    }
    const moved   = dragMovedRef.current;
    const wasStir = !!holdStirRef.current;
    handleMouseUp();                      // finalize a drag or release the stir
    if (!moved && !wasStir && touchStartRef.current) {
      const { x, y } = touchStartRef.current;
      const now  = Date.now();
      const last = lastTapRef.current;
      if (last && now - last.time < 320 && Math.hypot(x - last.x, y - last.y) < 28) {
        lastTapRef.current = null;        // double-tap → lid modal
        canvasDoubleTapAt(x, y);
      } else {
        lastTapRef.current = { time: now, x, y };
        canvasTapAt(x, y);                // single tap → buttons / activation
      }
    }
    touchStartRef.current = null;
  };

  // Keep the latest closures available to the once-registered native listeners
  const touchFnsRef = useRef({ start: onCanvasTouchStart, move: onCanvasTouchMove, end: onCanvasTouchEnd });
  touchFnsRef.current = { start: onCanvasTouchStart, move: onCanvasTouchMove, end: onCanvasTouchEnd };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s  = (e: TouchEvent) => touchFnsRef.current.start(e);
    const m  = (e: TouchEvent) => touchFnsRef.current.move(e);
    const en = ()              => touchFnsRef.current.end();
    canvas.addEventListener("touchstart", s,  { passive: false });
    canvas.addEventListener("touchmove",  m,  { passive: false });
    canvas.addEventListener("touchend",   en, { passive: false });
    canvas.addEventListener("touchcancel", en, { passive: false });
    return () => {
      canvas.removeEventListener("touchstart", s);
      canvas.removeEventListener("touchmove",  m);
      canvas.removeEventListener("touchend",   en);
      canvas.removeEventListener("touchcancel", en);
    };
  }, []);

  return (
    <div className="lab-canvas-container">
      <StepAlerts items={notifications} />
      <div className="canvas-wrapper custom-scrollbar">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          className="lab-canvas"
          style={{ touchAction: "none" }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={() => handleMouseUp()}
          onMouseLeave={() => setHoveredId(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            canvasContextMenuAt(e.clientX - rect.left, e.clientY - rect.top, e.clientX, e.clientY);
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
            if (dragging) return;   // ignore the click that ends a drag
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            canvasTapAt(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onDoubleClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            canvasDoubleTapAt(e.clientX - rect.left, e.clientY - rect.top);
          }}
        />
      </div>
      {/* ── Pour Modal ─────────────────────────────────────────────────────── */}
      {showPourModal &&
        (() => {
          const source = apparatus.find((a) => a.id === showPourModal.sourceId);
          const target = apparatus.find((a) => a.id === showPourModal.targetId);
          if (!source || !target) return null;
          const liveAvailable  = source.data?.currentVolume || 0;
          const targetMax      = target.data?.maxVolume || 0;
          const targetCurrent  = target.data?.currentVolume || 0;
          const liveMaxPour    = Math.min(liveAvailable, targetMax - targetCurrent);
          // While the pour animation runs the source drains every frame, which
          // would otherwise rescale the cylinder graduations on each tick. Hold
          // the scale steady using the snapshot taken when the pour started.
          const frozen     = isAnimatingPour ? pourScaleFreezeRef.current : null;
          const maxPour    = frozen ? frozen.maxPour : liveMaxPour;
          const currentAmount = frozen
            ? frozen.amount
            : (selectedPourAmount > 0 && selectedPourAmount <= maxPour
                ? selectedPourAmount : maxPour);
          const pct = maxPour > 0 ? (currentAmount / maxPour) * 100 : 100;
          const liquidColor = source.data?.liquidColor || "rgba(56,189,248,0.7)";

          return (
            <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
              zIndex:100, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <div style={{ background:"#0f172a", borderRadius:20,
                width:"min(520px, 95vw)", boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
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

                  {(() => {
                    const fillFrac = maxPour > 0 ? Math.max(0, Math.min(1, currentAmount / maxPour)) : 0;
                    // Pick a "nice" graduation step (1/2/5 × 10ⁿ) for the beaker scale
                    const niceStep = (m: number) => {
                      if (m <= 0) return 1;
                      const raw = m / 5;
                      const pow = Math.pow(10, Math.floor(Math.log10(raw)));
                      const n   = raw / pow;
                      const f   = n >= 5 ? 5 : n >= 2 ? 2 : 1;
                      return f * pow;
                    };
                    const tickStep = niceStep(maxPour);
                    const ticks: number[] = [];
                    for (let v = 0; v <= maxPour + 1e-6; v += tickStep) ticks.push(+v.toFixed(2));
                    if (ticks[ticks.length - 1] < maxPour - 1e-6) ticks.push(+maxPour.toFixed(2));
                    // Measuring-cylinder geometry (narrow tall tube), matching
                    // the realistic cylinder drawn on the lab bench.
                    const CYL_L = 50, CYL_W = 32, CYL_R = CYL_L + CYL_W;
                    const CX = CYL_L + CYL_W / 2;
                    const TOP = 32, BOT = 166, BODY = BOT - TOP;
                    const fmtTick  = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
                    const liquidY  = BOT - BODY * fillFrac;
                    // Map a pointer position on the cylinder to a pour amount (drag to fill)
                    const setFromEvent = (e: React.PointerEvent<SVGSVGElement>) => {
                      if (isAnimatingPour) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      const yTop = r.top + (TOP / 200) * r.height;
                      const yBot = r.top + (BOT / 200) * r.height;
                      const frac = (yBot - e.clientY) / (yBot - yTop);
                      const c    = Math.max(0, Math.min(1, frac));
                      setSelectedPourAmount(Math.min(maxPour, Math.max(0.1, +(c * maxPour).toFixed(1))));
                    };
                    return (
                      <div style={{ display:"flex", gap:18, marginBottom:18 }}>
                        {/* Measuring-cylinder visualization — doubles as the graduated scale / number line */}
                        <svg viewBox="0 0 120 200" width={120} height={200}
                          onPointerDown={e => { if (isAnimatingPour) return; e.currentTarget.setPointerCapture(e.pointerId); setFromEvent(e); }}
                          onPointerMove={e => { if (e.buttons === 1) setFromEvent(e); }}
                          style={{ flexShrink:0, touchAction:"none",
                            cursor: isAnimatingPour ? "not-allowed" : "ns-resize" }}>
                          <defs>
                            <clipPath id="pourCylClip">
                              <path d={`M${CYL_L} ${TOP} L${CYL_L} ${BOT - 5} Q${CYL_L} ${BOT} ${CYL_L + 5} ${BOT} L${CYL_R - 5} ${BOT} Q${CYL_R} ${BOT} ${CYL_R} ${BOT - 5} L${CYL_R} ${TOP} Z`} />
                            </clipPath>
                            <linearGradient id="pourCylGlass" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0"    stopColor="rgba(255,255,255,0.05)" />
                              <stop offset="0.18" stopColor="rgba(255,255,255,0.22)" />
                              <stop offset="0.5"  stopColor="rgba(255,255,255,0.04)" />
                              <stop offset="0.85" stopColor="rgba(180,210,235,0.16)" />
                              <stop offset="1"    stopColor="rgba(150,185,220,0.22)" />
                            </linearGradient>
                          </defs>

                          {/* Liquid (clipped to the beaker body) */}
                          <g clipPath="url(#pourCylClip)">
                            <rect x={CYL_L} y={liquidY} width={CYL_W} height={BOT - liquidY} fill={liquidColor} />
                            {/* concave meniscus — water wets the glass and dips in the middle */}
                            {fillFrac > 0.015 && <>
                              <path d={`M${CYL_L} ${liquidY} Q${CX} ${liquidY + 5} ${CYL_R} ${liquidY}`}
                                fill="rgba(255,255,255,0.18)" />
                              <path d={`M${CYL_L + 1} ${liquidY + 0.5} Q${CX} ${liquidY + 5} ${CYL_R - 1} ${liquidY + 0.5}`}
                                fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.3} />
                            </>}
                          </g>

                          {/* Glass beaker body — flat rounded bottom, open top */}
                          <path d={`M${CYL_L} ${TOP} L${CYL_L} ${BOT - 5} Q${CYL_L} ${BOT} ${CYL_L + 5} ${BOT} L${CYL_R - 5} ${BOT} Q${CYL_R} ${BOT} ${CYL_R} ${BOT - 5} L${CYL_R} ${TOP}`}
                            fill="url(#pourCylGlass)" stroke="#94a3b8" strokeWidth={2} strokeLinejoin="round" />
                          {/* Vertical glass highlight streak */}
                          <rect x={CYL_L + 4} y={TOP + 8} width={3} height={BODY - 18} rx={1.5}
                            fill="rgba(255,255,255,0.3)" />

                          {/* Beaker pouring spout — small curved lip on the right */}
                          <path d={`M${CYL_R - 1} ${TOP} Q${CYL_R + 4} ${TOP - 5} ${CYL_R + 9} ${TOP - 2}`}
                            fill="none" stroke="#94a3b8" strokeWidth={2} strokeLinecap="round" />

                          {/* "mL" unit label */}
                          <text x={CYL_R - 4} y={TOP + 12} textAnchor="end" fontSize={7} fontWeight={700}
                            fill="rgba(226,232,240,0.7)" fontFamily="monospace">mL</text>

                          {/* Graduation marks (the scale) — alternating long/short ticks */}
                          {ticks.map((v, i) => {
                            const y = BOT - BODY * (maxPour > 0 ? v / maxPour : 0);
                            return (
                              <g key={i}>
                                <line x1={CYL_L + 1} y1={y} x2={CYL_L + 11} y2={y}
                                  stroke="rgba(226,232,240,0.8)" strokeWidth={1.2} />
                                <text x={CYL_L - 4} y={y + 3.2} textAnchor="end" fontSize={9}
                                  fontWeight={600} fill="#e2e8f0" fontFamily="monospace">{fmtTick(v)}</text>
                              </g>
                            );
                          })}
                        </svg>

                        {/* Controls column */}
                        <div style={{ flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>
                          {/* Volume display with ±0.1 steppers */}
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                            gap:12, marginBottom:4 }}>
                            <button
                              disabled={isAnimatingPour || currentAmount <= 0.1}
                              onClick={() => setSelectedPourAmount(Math.max(0.1, +(currentAmount - 0.1).toFixed(1)))}
                              title="−0.1 mL"
                              style={{ width:38, height:38, borderRadius:10, border:"none",
                                cursor: (isAnimatingPour || currentAmount <= 0.1) ? "not-allowed" : "pointer",
                                background:"#1e293b", color:"#cbd5e1", fontSize:22, fontWeight:800, lineHeight:1 }}>
                              −
                            </button>
                            <div style={{ textAlign:"center", minWidth:96 }}>
                              <div style={{ fontSize:40, fontWeight:900, fontFamily:"monospace", lineHeight:1,
                                background:"linear-gradient(135deg,#60a5fa,#a78bfa)",
                                WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                                {currentAmount.toFixed(1)}
                              </div>
                              <div style={{ color:"#475569", fontSize:13, fontWeight:600, marginTop:2 }}>mL selected</div>
                            </div>
                            <button
                              disabled={isAnimatingPour || currentAmount >= maxPour}
                              onClick={() => setSelectedPourAmount(Math.min(maxPour, +(currentAmount + 0.1).toFixed(1)))}
                              title="+0.1 mL"
                              style={{ width:38, height:38, borderRadius:10, border:"none",
                                cursor: (isAnimatingPour || currentAmount >= maxPour) ? "not-allowed" : "pointer",
                                background:"#1e293b", color:"#cbd5e1", fontSize:22, fontWeight:800, lineHeight:1 }}>
                              +
                            </button>
                          </div>

                          {/* Custom slider (0.1 mL precision) */}
                          <div style={{ position:"relative", marginTop:12, marginBottom:8 }}>
                            <div style={{ height:8, borderRadius:4, background:"#1e293b",
                              position:"relative", overflow:"hidden" }}>
                              <div style={{ height:"100%", borderRadius:4, width:`${pct}%`,
                                background:"linear-gradient(90deg,#3b82f6,#7c3aed)",
                                transition: isAnimatingPour ? "none" : "width 0.1s" }} />
                            </div>
                            <input type="range" min={0.1} max={maxPour} step={0.1}
                              value={currentAmount}
                              disabled={isAnimatingPour}
                              onChange={e => setSelectedPourAmount(Number(e.target.value))}
                              style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
                                opacity:0, cursor: isAnimatingPour ? "not-allowed" : "pointer",
                                margin:0, padding:0 }} />
                            <div style={{ position:"absolute", top:"50%", transform:"translate(-50%,-50%)",
                              left:`calc(${pct}% - ${pct * 0.16}px)`,
                              width:20, height:20, borderRadius:"50%",
                              background:"linear-gradient(135deg,#3b82f6,#7c3aed)",
                              border:"3px solid #0f172a", boxShadow:"0 0 0 2px #3b82f6",
                              pointerEvents:"none", transition: isAnimatingPour ? "none" : "left 0.1s" }} />
                          </div>
                          <div style={{ display:"flex", justifyContent:"space-between",
                            fontSize:11, color:"#334155", marginBottom:14 }}>
                            <span>0.1 mL</span>
                            <span>{maxPour.toFixed(1)} mL (max)</span>
                          </div>

                          {/* Quick preset buttons */}
                          <div style={{ display:"flex", gap:8 }}>
                            {[25, 50, 75, 100].map(p => {
                              // 100% uses exact available volume so nothing is left behind
                              const val = p === 100 ? maxPour : Math.max(0.1, +(maxPour * p / 100).toFixed(1));
                              const active = Math.abs(currentAmount - val) < 0.05;
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
                        </div>
                      </div>
                    );
                  })()}

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

                    // Freeze the cylinder scale at the values shown right now so
                    // the graduations don't shift while the source drains.
                    pourScaleFreezeRef.current = { available: liveAvailable, maxPour, amount };
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
                              // Melted/mixed stearic acid & beeswax pour out with the
                              // liquid, so the suspended solids leave at the same rate.
                              // Without this, a poured-out beaker still showed a stearic
                              // acid chunk that isn't really there.
                              const prevSolidS = a.data?.solidStearicGrams ?? 0;
                              const prevSolidB = a.data?.solidBeeswaxGrams ?? 0;
                              const sS = keepFrac < 0.01 ? 0 : prevSolidS * keepFrac;
                              const sB = keepFrac < 0.01 ? 0 : prevSolidB * keepFrac;
                              return {
                                ...a,
                                data: {
                                  ...a.data,
                                  currentVolume:    finalVol,
                                  isPouring:        false,
                                  pouringTargetId:  null,
                                  pouringProgress:  0,
                                  composition:      reducedComp,
                                  solidStearicGrams: sS,
                                  solidBeeswaxGrams: sB,
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
                        pourScaleFreezeRef.current = null;
                        setIsAnimatingPour(false);
                        setShowPourModal(null);
                        setSelectedPourAmount(0);
                      }
                    };
                    animate();
                  }}
                    >
                      {isAnimatingPour ? "Pouring…" : `⬇ Pour ${currentAmount.toFixed(1)} mL`}
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
                        soundManager.click(!isOn);
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
          const isSolid = !!item.data?.isSolid;
          const lidColor = item.data?.lidColor || "#3b82f6";  // button theming (hex)
          // Solid jars show a coloured screw cover; liquid bottles a glass lid.
          const lidSwatch = isSolid ? lidColor : "rgba(210,232,250,0.65)";
          const lidBorder = isSolid ? lidColor : "rgba(255,255,255,0.7)";
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
                        background: isOpen ? "rgba(255,255,255,0.05)" : lidSwatch,
                        border: isOpen ? "1.5px dashed #475569" : `1.5px solid ${lidBorder}` }} />
                      {/* Lid sitting to the side if open — glass for liquids, cover for solids */}
                      {isOpen && (
                        <div style={{ position:"absolute", top:0, right:-12, width:18, height:10,
                          borderRadius:3, background:lidSwatch, border:`1px solid ${lidBorder}`,
                          opacity:0.85, transform:"rotate(-15deg)" }} />
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
                        prev.map(a => a.id === item.id ? toggleLid(a, isOpen) : a)
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
          // "Return to Shelf" is only offered when the container is NOT already
          // on the shelf (e.g. it was dragged down to the table to pour).
          const onShelf = Math.abs((item.y + item.height) - shelfY) < 25;
          const origList = initialApparatusFor();
          const orig = origList.find((a) => a.id === item.id);
          const shelfPos = orig ? { x: orig.x, y: orig.y } : { x: item.x, y: shelfY - item.height };
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
                      prev.map((a) => a.id === item.id ? toggleLid(a, isOpen) : a)
                    );
                    setLidContextMenu(null);
                  }}
                >
                  <span style={{ fontSize:16 }}>{isOpen ? "🔒" : "🔓"}</span>
                  {isOpen ? "Close Lid" : "Open Lid"}
                </button>
                {/* Return to Shelf — only when the container is off the shelf */}
                {!onShelf && (
                  <button
                    style={{ width:"100%", padding:"10px 14px", background:"transparent", border:"none",
                      cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:10,
                      color:"#e2e8f0", fontSize:13, fontWeight:600, borderTop:"1px solid #1e293b" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#1e293b")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    onClick={() => {
                      setApparatus((prev) =>
                        prev.map((a) => a.id === item.id
                          ? { ...a, x: shelfPos.x, y: shelfPos.y, data: { ...a.data, containedInId: null } }
                          : a)
                      );
                      setLidContextMenu(null);
                    }}
                  >
                    <span style={{ fontSize:16 }}>📦</span>
                    Return to Shelf
                  </button>
                )}
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
        // dockInto: places probe instruments INSIDE the beaker, resting on the
        // inner floor (tip touches the inside bottom — never the table below).
        const dockInto = (tgt: typeof mainBeaker, slotOffset = 0) => {
          if (!tgt) return null;
          const iy = restYInside(item, tgt);
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
                    const dx = d.pos.x - item.x;
                    const movedContainer = { ...item, x: d.pos.x, y: d.pos.y };
                    setApparatus(prev => prev.map(a => {
                      if (a.id === item.id) {
                        // Re-evaluate containment after the move so docking into a
                        // beaker tags it (travels with the container), and moving
                        // it elsewhere releases it.
                        if (CONTAINABLE_TYPES.includes(a.type)) {
                          const c = findContainerFor(movedContainer, prev);
                          return { ...movedContainer, data: { ...a.data, containedInId: c?.id ?? null } };
                        }
                        return { ...movedContainer };
                      }
                      // Contents of a moved container travel with it.
                      if (a.data?.containedInId === item.id) {
                        return { ...a, x: a.x + dx, y: restYInside(a, movedContainer) };
                      }
                      return a;
                    }));
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

        const origList = initialApparatusFor();
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
                    a.id === item.id
                      ? { ...a, x: shelfPos.x, y: shelfPos.y, data: { ...a.data, containedInId: null } }
                      : a
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
        const maxG           = showScoopModal.maxGrams;
        // Never exceed what the spatula can carry
        const curG           = Math.max(1, Math.min(Math.round(selectedScoopGrams), maxG));
        const pct            = maxG > 1 ? ((curG - 1) / (maxG - 1)) * 100 : 100;
        const swatch         = src.data?.liquidColor || "rgba(255,250,240,0.95)";
        const available      = Math.round((src.data?.currentVolume ?? 0) * density);
        const presets        = [
          ...(hasTarget ? [{ label: "Target", val: Math.max(1, Math.min(Math.round(targetGrams), maxG)) }] : []),
          { label: "½ load", val: Math.max(1, Math.round(maxG / 2)) },
          { label: "Max",    val: maxG },
        ];
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
            zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ background:"#0f172a", borderRadius:20,
              width:"min(440px, 95vw)", boxShadow:"0 24px 80px rgba(0,0,0,0.8)",
              border:"1px solid #1e293b", overflow:"hidden" }}>

              {/* ── Header ── */}
              <div style={{ background:"linear-gradient(135deg,#1c1207,#27200f)",
                padding:"20px 24px 16px", borderBottom:"1px solid #2a2010" }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:42, height:42, borderRadius:12, background:swatch,
                    border:"2px solid rgba(255,255,255,0.15)", flexShrink:0 }} />
                  <div>
                    <div style={{ color:"white", fontWeight:800, fontSize:17 }}>Chop {solidName}</div>
                    <div style={{ color:"#b08948", fontSize:12, marginTop:2 }}>
                      Measure solid onto the spatula
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Body ── */}
              <div style={{ padding:"22px 24px" }}>

                {/* Big gram display */}
                <div style={{ textAlign:"center", marginBottom:18 }}>
                  <div style={{ fontSize:48, fontWeight:900, fontFamily:"monospace", lineHeight:1,
                    background:"linear-gradient(135deg,#f59e0b,#fcd34d)",
                    WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
                    {curG}
                  </div>
                  <div style={{ color:"#9aa6b6", fontSize:14, fontWeight:600, marginTop:2 }}>grams selected</div>
                </div>

                {/* Info row */}
                <div style={{ display:"flex", gap:10, marginBottom:18 }}>
                  <div style={{ flex:1, background:"#0b1322", border:"1px solid #1e293b",
                    borderRadius:10, padding:"8px 12px" }}>
                    <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.6 }}>Available</div>
                    <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14 }}>{available} g</div>
                  </div>
                  <div style={{ flex:1, background:"#0b1322", border:"1px solid #1e293b",
                    borderRadius:10, padding:"8px 12px" }}>
                    <div style={{ color:"#64748b", fontSize:10, textTransform:"uppercase", letterSpacing:0.6 }}>Spatula max</div>
                    <div style={{ color:"#e2e8f0", fontWeight:700, fontSize:14 }}>{maxG} g</div>
                  </div>
                  {hasTarget && (
                    <div style={{ flex:1, background:"#10210f", border:"1px solid #1e3a1e",
                      borderRadius:10, padding:"8px 12px" }}>
                      <div style={{ color:"#65a30d", fontSize:10, textTransform:"uppercase", letterSpacing:0.6 }}>🎯 Target</div>
                      <div style={{ color:"#bef264", fontWeight:700, fontSize:14 }}>{targetGrams} g</div>
                    </div>
                  )}
                </div>

                {/* Custom slider */}
                <div style={{ position:"relative", marginBottom:8 }}>
                  <div style={{ height:8, borderRadius:4, background:"#1e293b", position:"relative", overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:4, width:`${pct}%`,
                      background:"linear-gradient(90deg,#b45309,#f59e0b)" }} />
                  </div>
                  <input type="range" min={1} max={maxG} step={1} value={curG}
                    onChange={(e) => setSelectedScoopGrams(Math.min(maxG, Number(e.target.value)))}
                    style={{ position:"absolute", top:0, left:0, width:"100%", height:"100%",
                      opacity:0, cursor:"pointer", margin:0, padding:0 }} />
                  <div style={{ position:"absolute", top:"50%", transform:"translate(-50%,-50%)",
                    left:`calc(${pct}% - ${pct * 0.16}px)`, width:20, height:20, borderRadius:"50%",
                    background:"linear-gradient(135deg,#f59e0b,#fbbf24)", border:"3px solid #0f172a",
                    boxShadow:"0 0 0 2px #f59e0b", pointerEvents:"none" }} />
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#334155", marginBottom:18 }}>
                  <span>1 g</span><span>{maxG} g (max)</span>
                </div>

                {/* Preset buttons */}
                <div style={{ display:"flex", gap:8, marginBottom:20 }}>
                  {presets.map(p => {
                    const active = curG === p.val;
                    return (
                      <button key={p.label}
                        onClick={() => setSelectedScoopGrams(p.val)}
                        style={{ flex:1, padding:"8px 0", borderRadius:8, border:"none", cursor:"pointer",
                          background: active ? "linear-gradient(135deg,#b45309,#f59e0b)" : "#1e293b",
                          color: active ? "white" : "#94a3b8", fontWeight:700, fontSize:12,
                          boxShadow: active ? "0 2px 10px rgba(245,158,11,0.4)" : "none",
                          transition:"all 0.15s" }}>
                        {p.label}
                      </button>
                    );
                  })}
                </div>

                {/* Action buttons */}
                <div style={{ display:"flex", gap:10 }}>
                  <button
                    style={{ flex:1, padding:"13px 0", borderRadius:12, border:"none", cursor:"pointer",
                      background:"linear-gradient(135deg,#b45309,#f59e0b)", color:"white",
                      fontWeight:800, fontSize:15, letterSpacing:0.5,
                      boxShadow:"0 4px 18px rgba(180,83,9,0.45)" }}
                    onClick={() => {
                      pushHistory(); // ← snapshot before scoop
                      const grams = curG;
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
                    Chop {curG} g
                  </button>
                  <button
                    style={{ padding:"13px 22px", background:"#1e293b", border:"none", borderRadius:12,
                      cursor:"pointer", fontWeight:700, fontSize:14, color:"#94a3b8" }}
                    onClick={() => setShowScoopModal(null)}
                  >Cancel</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Submit Formulation Button — top bar, left of Lab Workbook button */}
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
        ⤴ Submit
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

      {/* ── Sound mute toggle ─── */}
      <button
        onClick={() => setSoundMuted((m) => !m)}
        title={soundMuted ? "Sound off — click to enable lab sounds" : "Sound on — click to mute"}
        style={{
          position: "absolute",
          top: 14,
          right: 510,
          background: soundMuted ? "#1e293b" : "#334155",
          color: soundMuted ? "#475569" : "#e2e8f0",
          border: "none",
          borderRadius: 10,
          padding: "9px 16px",
          fontWeight: 700,
          fontSize: 13,
          cursor: "pointer",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "background .15s, color .15s",
        }}
      >
        {soundMuted ? "🔇 Sound" : "🔊 Sound"}
      </button>

      <EvaluationPanel
        isOpen={showEvaluationPanel}
        onClose={() => setShowEvaluationPanel(false)}
        apparatus={apparatus}
        practicalId={practicalId}
        assignment={assignment}
        labExpired={labExpired}
        sessionStartAt={assignment ? (
          (() => { try { const k = "vlab_timer_" + assignment.token; const v = localStorage.getItem(k); return v ? parseInt(v,10) : null; } catch { return null; } })()
        ) : null}
      />

      {/* ── Large floating thermometer displays ────────────────────────────
           One readout beside each thermometer whose probe is in a beaker, so
           both phase temperatures can be read at the same time. */}
      {(() => {
        const canvasRect = canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return null;
        const thermos = apparatus.filter(a => a.type === "thermometer");

        // Track placed readouts so a second one never overlaps the first.
        const DW = 104, DH = 96, PAD = 8;
        const placed: { left: number; top: number }[] = [];
        const overlaps = (l: number, t: number) =>
          placed.some(p =>
            l < p.left + DW + PAD && l + DW + PAD > p.left &&
            t < p.top  + DH + PAD && t + DH + PAD > p.top);

        return thermos.map((thermo) => {
          const probeBottom = thermo.y + thermo.height;
          const probeCX     = thermo.x + thermo.width / 2;
          const isMeasuring = apparatus.some(
            a => (a.type === "beaker" || a.type === "cylinder") &&
                 probeCX    >= a.x && probeCX    <= a.x + a.width &&
                 probeBottom >= a.y && probeBottom <= a.y + a.height,
          );
          if (!isMeasuring) return null;

          const temp = thermo.data?.readingTemperature ?? roomTemp;
          const tempStr = temp < 100 ? temp.toFixed(1) : `${Math.round(temp)}`;
          const fluidColor =
            temp > 120 ? "#ef4444"
            : temp > 75 ? "#f97316"
            : temp > 40 ? "#fbbf24"
            : "#60a5fa";

          // Position display to the right of the thermometer, nudging it down
          // until it clears any readout already placed this frame.
          const dispX = canvasRect.left + thermo.x + thermo.width + 8;
          let dispY = canvasRect.top  + thermo.y;
          let guard = 0;
          while (overlaps(dispX, dispY) && guard < 12) { dispY += DH + PAD; guard++; }
          placed.push({ left: dispX, top: dispY });

          return (
            <div key={thermo.id} style={{
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
        });
      })()}

      {/* ── Room-temperature badge (live weather → cooling rate) ─────────── */}
      <div style={{
        position: "fixed",
        right: 14,
        bottom: 14,
        zIndex: 40,
        background: "rgba(2,11,18,0.82)",
        border: "1px solid #1e3a4d",
        borderRadius: 10,
        padding: "7px 12px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        pointerEvents: "none",
        boxShadow: "0 2px 12px rgba(0,0,0,0.5)",
      }}>
        <span style={{ fontSize: 16 }}>{ambient.live ? "🌡️" : "🏠"}</span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ color: "#60a5fa", fontWeight: 800, fontFamily: "monospace", fontSize: 15 }}>
            {ambient.roomTemp.toFixed(1)}°C
          </div>
          <div style={{ color: "#64748b", fontSize: 9, fontWeight: 600, letterSpacing: 0.3 }}>
            room · {ambient.location}
          </div>
        </div>
      </div>

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
                prev.map(a => a.id === hovered.id ? toggleLid(a, true) : a)
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
