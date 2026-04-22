import React, { useRef, useEffect, useState, useCallback } from "react";
import classNames from "classnames";
import { SimulationStep } from "../simulation/model";
import ApparatusDetailModal from "./ApparatusDetailModal";
import ProtocolSidebar from "./ProtocolSidebar";
import { getInitialApparatus, Apparatus } from "./apparatusData";

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
) => {
  const radius = 5;
  const usableHeight = h * 0.7;
  const bottomPadding = h * 0.15;

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
    const markY = y + h - bottomPadding - i * (usableHeight / (maxVol / step));
    ctx.beginPath();
    ctx.moveTo(x + 2, markY);
    ctx.lineTo(x + 10, markY);
    ctx.stroke();
    ctx.fillText(`${i * step}`, x + 12, markY + 3);
  }
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
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 1;
  ctx.font = "7px Arial";
  ctx.textAlign = "left";

  // For 100mL, use 10mL steps
  const step = 10;
  const numberOfMarks = maxVol / step;

  for (let i = 0; i <= numberOfMarks; i++) {
    const markVol = i * step;
    const markY = y + h - bottomPadding - i * (usableHeight / numberOfMarks);

    ctx.beginPath();
    const lineLength = w * 0.3;
    ctx.moveTo(x, markY);
    ctx.lineTo(x + lineLength, markY);
    ctx.stroke();

    if (markVol % 20 === 0) {
      // Label every 20mL
      ctx.fillText(`${markVol}`, x + lineLength + 2, markY + 2);
    }
  }

  // 5. Label "mL"
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

  // 1. Liquid Level
  if (currentVol > 0) {
    const fillLevel = currentVol / maxVol;
    const liquidH = bodyHeight * fillLevel;
    ctx.fillStyle = liquidColor;
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
    ctx.fillStyle = lidColor;
    ctx.fillRect(x + w * 0.3, y, w * 0.4, neckHeight);
  }

  // 4. Label
  ctx.fillStyle = "white";
  ctx.fillRect(x + 5, bodyY + 10, w - 10, 25);
  ctx.fillStyle = "black";
  ctx.font = "bold 8px Arial";
  ctx.textAlign = "center";
  ctx.fillText(name.split(" ")[0], x + w / 2, bodyY + 25);
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
) => {
  ctx.save();

  const dispH = Math.min(h * 0.28, 38);
  const probeStartY = y + dispH;
  const probeH = h - dispH - 10;
  const probeW = Math.max(w * 0.32, 7);
  const probeCX = x + w / 2;
  const bulbR = probeW * 0.95;

  // Display housing shadow
  ctx.shadowColor = "rgba(0,0,0,0.30)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const dispGrad = ctx.createLinearGradient(x, y, x + w, y);
  dispGrad.addColorStop(0, "#cdd8e8");
  dispGrad.addColorStop(0.5, "#eaf0f8");
  dispGrad.addColorStop(1, "#bac8d8");
  ctx.fillStyle = dispGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, dispH, [5, 5, 3, 3]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // LCD screen
  ctx.fillStyle = "#060e14";
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, dispH - 5, 3);
  ctx.fill();

  // Green digital temperature readout
  const tempStr = readingTemperature < 100
    ? readingTemperature.toFixed(1)
    : `${Math.round(readingTemperature)}`;
  ctx.fillStyle = "#00e676";
  ctx.font = `bold ${Math.floor((dispH - 8) * 0.55)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(tempStr, probeCX, y + dispH * 0.66);

  // °C label
  ctx.font = `${Math.floor((dispH - 8) * 0.28)}px monospace`;
  ctx.fillStyle = "rgba(0, 230, 118, 0.62)";
  ctx.fillText("°C", x + w * 0.84, y + dispH * 0.32);

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

  // Label (rotated 90° along the rod)
  ctx.save();
  ctx.translate(rodCX + rodW / 2 + 7, y + h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.font = "5px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GLASS STIRRING ROD", 0, 0);
  ctx.restore();

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

  const dispH = Math.min(h * 0.30, 42);
  const probeStartY = y + dispH + 10;
  const probeH = h - dispH - 10 - 12;
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

  // Display housing
  ctx.shadowColor = "rgba(0,0,0,0.28)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const dispGrad = ctx.createLinearGradient(x, y, x + w, y);
  dispGrad.addColorStop(0, "#cdd8e8");
  dispGrad.addColorStop(0.5, "#eaf0f8");
  dispGrad.addColorStop(1, "#bac8d8");
  ctx.fillStyle = dispGrad;
  ctx.beginPath();
  ctx.roundRect(x, y, w, dispH, [6, 6, 3, 3]);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // LCD screen
  ctx.fillStyle = "#060e14";
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, dispH - 4, 3);
  ctx.fill();

  // "pH" tag top-left
  ctx.fillStyle = phColor;
  ctx.font = `bold ${Math.floor((dispH - 6) * 0.26)}px monospace`;
  ctx.textAlign = "left";
  ctx.fillText("pH", x + 4, y + dispH * 0.40);

  // Numeric readout
  ctx.font = `bold ${Math.floor((dispH - 6) * 0.54)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText(phReading.toFixed(2), probeCX, y + dispH * 0.76);

  // Rainbow pH scale bar
  const barH = 7;
  const barY = y + dispH + 1;
  const barX = x + 2;
  const barW = w - 4;
  const barGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  barGrad.addColorStop(0,    "rgba(255,0,0,0.9)");
  barGrad.addColorStop(0.21, "rgba(255,120,0,0.9)");
  barGrad.addColorStop(0.43, "rgba(255,230,0,0.9)");
  barGrad.addColorStop(0.50, "rgba(0,200,80,0.9)");
  barGrad.addColorStop(0.57, "rgba(0,200,255,0.9)");
  barGrad.addColorStop(0.79, "rgba(0,80,220,0.9)");
  barGrad.addColorStop(1,    "rgba(100,0,200,0.9)");
  ctx.fillStyle = barGrad;
  ctx.beginPath();
  ctx.roundRect(barX, barY, barW, barH, 2);
  ctx.fill();

  // White triangle indicator on the scale
  const indX = barX + (phReading / 14) * barW;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(indX, barY - 1);
  ctx.lineTo(indX - 3.5, barY - 7);
  ctx.lineTo(indX + 3.5, barY - 7);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

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

  // Sensitive bulb at tip — glows with pH colour
  ctx.fillStyle = phColor;
  ctx.shadowColor = phColor;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(probeCX, probeStartY + probeH + bulbR * 0.5, bulbR, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
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

  // "VISCOSITY" header
  const accentColor = isActive ? "#00e676" : "#4caf50";
  ctx.fillStyle = accentColor;
  ctx.font = `${Math.floor(lcdH * 0.17)}px monospace`;
  ctx.textAlign = "center";
  ctx.fillText("VISCOSITY", probeCX, lcdY + lcdH * 0.22);

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

  // Descriptor label
  const desc =
    viscosityReading < 2 ? "WATER-LIKE" :
    viscosityReading < 50 ? "LOW" :
    viscosityReading < 300 ? "MEDIUM" :
    viscosityReading < 1000 ? "HIGH" : "VERY HIGH";
  ctx.font = `${Math.floor(lcdH * 0.15)}px Arial`;
  ctx.fillStyle = `rgba(0, 230, 118, 0.52)`;
  ctx.fillText(desc, probeCX, lcdY + lcdH * 0.82);

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

  // Scale labels
  ctx.fillStyle = "rgba(255,255,255,0.42)";
  ctx.font = `5px Arial`;
  ctx.textAlign = "center";
  ctx.fillText("1", dialCX + Math.cos(startAngle) * (dialR + 6), dialCY + Math.sin(startAngle) * (dialR + 6) + 3);
  ctx.fillText("3k", dialCX + Math.cos(endAngle) * (dialR + 7), dialCY + Math.sin(endAngle) * (dialR + 7) + 3);

  // "CLICK TO MEASURE" hint when probe is dipped but not active
  if (!isActive && viscosityReading === 0) {
    ctx.fillStyle = "rgba(255,255,255,0.30)";
    ctx.font = `5px Arial`;
    ctx.textAlign = "center";
    ctx.fillText("CLICK TO", probeCX, dialCY + dialR + 9);
    ctx.fillText("MEASURE", probeCX, dialCY + dialR + 15);
  }

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

interface InteractiveLabCanvasProps {
  currentStep: SimulationStep;
  onApparatusClick?: (apparatus: Apparatus) => void;
}

const InteractiveLabCanvas: React.FC<InteractiveLabCanvasProps> = ({
  currentStep,
  onApparatusClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedApparatus, setSelectedApparatus] = useState<Apparatus | null>(
    null,
  );
  const [showDetailModal, setShowDetailModal] = useState(false);
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

  const [apparatus, setApparatus] = useState<Apparatus[]>(
    getInitialApparatus(LEFT_GAP, shelfY, TABLE_Y),
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pouringSource, setPouringSource] = useState<string | null>(null);
  const [pouringTarget, setPouringTarget] = useState<string | null>(null);
  const [showPourModal, setShowPourModal] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);
  const [isAnimatingPour, setIsAnimatingPour] = useState(false);
  const [showLidModal, setShowLidModal] = useState<{ id: string } | null>(null);
  const [showHotPlateModal, setShowHotPlateModal] = useState(false);
  const [hotPlateFrame, setHotPlateFrame] = useState(0);

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
          drawBeaker(ctx, x, y, width, height, maxVol, currentVol, liquidColor, item.data?.liquidTemperature ?? 25, hotPlateFrame, item.data?.isStirring ?? false);
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
            item.data?.hasLid, currentVol, tiltAngle, liquidColor, lidColor,
          );
        } else if (type === "thermometer") {
          drawThermometer(ctx, x, y, width, height, item.data?.readingTemperature ?? 25);
        } else if (type === "stirringrod") {
          drawStirringRod(ctx, x, y, width, height, item.data?.isStirring ?? false, hotPlateFrame);
        } else if (type === "phmeter") {
          drawPhMeter(ctx, x, y, width, height, item.data?.phReading ?? 7.0);
        } else if (type === "viscositygauge") {
          drawViscosityGauge(ctx, x, y, width, height, item.data?.viscosityReading ?? 0, item.data?.isViscosityActive ?? false, hotPlateFrame);
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
              const maxT = hp.data?.targetTemperature ?? 200;
              if (curT < maxT - 0.5)
                return { ...a, data: { ...a.data, liquidTemperature: Math.min(curT + 0.7, maxT) } };
            } else if (curT > 25) {
              // Beaker removed from plate — cool slowly toward ambient
              return { ...a, data: { ...a.data, liquidTemperature: Math.max(25, curT - 0.25) } };
            }
          }
          return a;
        });
      });
    }, 80);
    return () => clearInterval(interval);
  }, [hotPlateIsOn]);

  // Cool beakers down when hot plate is switched off
  useEffect(() => {
    if (hotPlateIsOn) return;
    const cooling = setInterval(() => {
      setApparatus((prev) => {
        const hasHeat = prev.some(
          (a) =>
            (a.type === "beaker" || a.type === "cylinder") &&
            (a.data?.liquidTemperature ?? 25) > 26,
        );
        if (!hasHeat) return prev;
        return prev.map((a) => {
          if (
            (a.type === "beaker" || a.type === "cylinder") &&
            (a.data?.liquidTemperature ?? 25) > 25
          ) {
            return {
              ...a,
              data: {
                ...a.data,
                liquidTemperature: Math.max(
                  25,
                  (a.data?.liquidTemperature ?? 25) - 0.4,
                ),
              },
            };
          }
          return a;
        });
      });
    }, 100);
    return () => clearInterval(cooling);
  }, [hotPlateIsOn]);

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

        // When probe is outside any beaker, drift back to ambient
        const targetTemp = beakerUnder?.data?.liquidTemperature ?? 25;
        const current = thermo.data?.readingTemperature ?? 25;
        if (Math.abs(current - targetTemp) < 0.05) return prev;

        // ~0.25 °C per tick → realistic lag (heating faster, cooling a touch slower)
        const rate = current < targetTemp ? 0.25 : 0.18;
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
    }, 120);
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

        // When outside a beaker drift to neutral 7.0
        const targetPH = beakerUnder?.data?.pH ?? 7.0;
        const current = meter.data?.phReading ?? 7.0;
        if (Math.abs(current - targetPH) < 0.005) return prev;

        const rate = 0.04; // ~0.04 pH units per tick → realistic electrode lag
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

        const targetVisc = beakerUnder?.data?.viscosity ?? 0;
        const current = gauge.data?.viscosityReading ?? 0;
        if (Math.abs(current - targetVisc) < 0.5) return prev;

        // Approach 4% of remaining gap per tick → reaches target in ~3 s
        const next = current + (targetVisc - current) * 0.04;

        return prev.map((a) =>
          a.id === gauge.id ? { ...a, data: { ...a.data, viscosityReading: next } } : a,
        );
      });
    }, 80);
    return () => clearInterval(interval);
  }, []);

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
      // If lid is present, show lid modal
      if (clicked.data?.hasLid) {
        setShowLidModal({ id: clicked.id });
        return;
      }
      setDragging({
        id: clicked.id,
        offsetX: x - clicked.x,
        offsetY: y - clicked.y,
      });
      e.preventDefault();
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!dragging) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const snapDistance = 50;
      setApparatus((prev) => {
        const hotPlate = prev.find((a) => a.type === "hotplate");
        return prev.map((app) => {
          if (app.id === dragging.id) {
            let newY = y - dragging.offsetY;
            // Snap to table surface
            if (Math.abs(newY + app.height - TABLE_Y) < snapDistance) {
              newY = TABLE_Y - app.height;
            }
            // Snap to shelf
            if (Math.abs(newY + app.height - shelfY) < snapDistance) {
              newY = shelfY - app.height;
            }
            // Snap beakers / cylinders onto the hot plate heating surface
            if (hotPlate && (app.type === "beaker" || app.type === "cylinder")) {
              const newX = x - dragging.offsetX;
              const centerX = newX + app.width / 2;
              if (
                centerX >= hotPlate.x &&
                centerX <= hotPlate.x + hotPlate.width &&
                Math.abs(newY + app.height - hotPlate.y) < snapDistance
              ) {
                newY = hotPlate.y - app.height;
              }
            }
            return { ...app, x: x - dragging.offsetX, y: newY };
          }
          return app;
        });
      });
    },
    [dragging, TABLE_Y, shelfY],
  );

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      // Check if dropped over a valid target (beaker or cylinder, lid off)
      const dragged = apparatus.find((a) => a.id === dragging.id);
      if (
        dragged &&
        !dragged.data?.hasLid &&
        (dragged.type === "bottle" ||
          dragged.type === "container" ||
          dragged.type === "cylinder")
      ) {
        const dragRect = {
          x: dragged.x,
          y: dragged.y,
          w: dragged.width,
          h: dragged.height,
        };
        const target = apparatus.find(
          (a) =>
            (a.type === "beaker" || a.type === "cylinder") &&
            !a.data?.hasLid &&
            a.id !== dragged.id &&
            dragRect.x + dragRect.w > a.x &&
            dragRect.x < a.x + a.width &&
            dragRect.y + dragRect.h > a.y &&
            dragRect.y < a.y + a.height,
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
    }
    setDragging(null);
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
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
            if (dragging) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
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

            // Stirring rod checked first — it may overlap a beaker
            const stirRod = apparatus.find(
              (a) =>
                a.type === "stirringrod" &&
                x >= a.x && x <= a.x + a.width &&
                y >= a.y && y <= a.y + a.height,
            );
            if (stirRod && stirRod.data?.stirringTargetId) {
              const targetId = stirRod.data.stirringTargetId;
              setApparatus((prev) =>
                prev.map((a) => {
                  if (a.id === stirRod.id || a.id === targetId)
                    return { ...a, data: { ...a.data, isStirring: true } };
                  return a;
                }),
              );
              setTimeout(() => {
                setApparatus((prev) =>
                  prev.map((a) => {
                    if (a.id === stirRod.id || a.id === targetId)
                      return { ...a, data: { ...a.data, isStirring: false } };
                    return a;
                  }),
                );
              }, 2500);
              return;
            }

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
              // If lid is present, show lid modal; otherwise show detail modal
              if (clicked.data?.hasLid) {
                setShowLidModal({ id: clicked.id });
              } else {
                setSelectedApparatus(clicked);
                setShowDetailModal(true);
                onApparatusClick?.(clicked);
              }
            }
          }}
        />
        {/* Tooltip for volume */}
        {hoveredId &&
          (() => {
            const item = apparatus.find((a) => a.id === hoveredId);
            if (!item) return null;
            const vol = item.data?.currentVolume ?? 0;
            const max = item.data?.maxVolume ?? 0;
            return (
              <div
                style={{
                  position: "absolute",
                  left: item.x + item.width / 2,
                  top: item.y - 30,
                  background: "rgba(30,41,59,0.95)",
                  color: "white",
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 13,
                  pointerEvents: "none",
                  transform: "translate(-50%, 0)",
                  zIndex: 20,
                }}
              >
                {vol} mL / {max} mL
              </div>
            );
          })()}
      </div>
      {/* Pour Modal */}
      {showPourModal &&
        (() => {
          const source = apparatus.find((a) => a.id === showPourModal.sourceId);
          const target = apparatus.find((a) => a.id === showPourModal.targetId);
          if (!source || !target) return null;
          const available = source.data?.currentVolume || 0;
          const targetMax = target.data?.maxVolume || 0;
          const targetCurrent = target.data?.currentVolume || 0;
          const maxPour = Math.min(available, targetMax - targetCurrent, 100);
          return (
            <div
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.25)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 32,
                  minWidth: 320,
                  boxShadow: "0 8px 32px #0002",
                }}
              >
                <h2 className="font-bold text-lg mb-2">Pour Liquid</h2>
                <p className="mb-4">
                  How much would you like to pour from <b>{source.name}</b> into{" "}
                  <b>{target.name}</b>?
                </p>
                <div className="mb-4">
                  <input
                    type="range"
                    min={1}
                    max={maxPour}
                    defaultValue={maxPour}
                    id="pourAmount"
                    style={{ width: 200 }}
                    disabled={isAnimatingPour}
                  />
                  <span className="ml-2 font-mono">{maxPour} mL</span>
                </div>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                  disabled={isAnimatingPour}
                  onClick={() => {
                    const amount = parseInt(
                      (
                        document.getElementById(
                          "pourAmount",
                        ) as HTMLInputElement
                      )?.value || "0",
                      10,
                    );
                    setIsAnimatingPour(true);
                    // Animate pouring with tilt and real-time volume
                    let progress = 0;
                    const steps = 60;
                    const animate = () => {
                      progress += 1 / steps;
                      setApparatus((prev) =>
                        prev.map((a) => {
                          if (a.id === source.id) {
                            const newVol = Math.max(
                              0,
                              (a.data?.currentVolume || 0) - amount / steps,
                            );
                            return {
                              ...a,
                              data: {
                                ...a.data,
                                isPouring: true,
                                pouringTargetId: target.id,
                                pouringProgress: progress,
                                currentVolume: newVol,
                              },
                            };
                          }
                          if (a.id === target.id) {
                            const prevVol = a.data?.currentVolume || 0;
                            const addVol  = amount / steps;
                            const newVol  = Math.min(a.data?.maxVolume || 1000, prevVol + addVol);
                            // Blend pH and viscosity proportionally when mixing
                            const srcPH   = source.data?.pH ?? 7.0;
                            const srcVisc = source.data?.viscosity ?? 1;
                            const tgtPH   = a.data?.pH ?? srcPH;
                            const tgtVisc = a.data?.viscosity ?? srcVisc;
                            const blendedPH   = prevVol > 0 ? (prevVol * tgtPH   + addVol * srcPH)   / newVol : srcPH;
                            const blendedVisc = prevVol > 0 ? (prevVol * tgtVisc + addVol * srcVisc) / newVol : srcVisc;
                            return {
                              ...a,
                              data: {
                                ...a.data,
                                currentVolume: newVol,
                                liquidColor: source.data?.liquidColor || "rgba(56, 189, 248, 0.6)",
                                pH: blendedPH,
                                viscosity: blendedVisc,
                              },
                            };
                          }
                          return a;
                        }),
                      );
                      if (progress < 1) {
                        setTimeout(animate, 18);
                      } else {
                        setApparatus((prev) =>
                          prev.map((a) =>
                            a.id === source.id
                              ? {
                                  ...a,
                                  data: {
                                    ...a.data,
                                    isPouring: false,
                                    pouringTargetId: null,
                                    pouringProgress: 0,
                                  },
                                }
                              : a,
                          ),
                        );
                        setIsAnimatingPour(false);
                        setShowPourModal(null);
                      }
                    };
                    animate();
                  }}
                >
                  Pour
                </button>
                <button
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  disabled={isAnimatingPour}
                  onClick={() => setShowPourModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}
      {showHotPlateModal &&
        (() => {
          const hp = apparatus.find((a) => a.type === "hotplate");
          if (!hp) return null;
          const currentTemp = Math.round(hp.data?.temperature ?? 25);
          const targetTemp = hp.data?.targetTemperature ?? 200;
          const isOn = hp.data?.isOn ?? false;
          return (
            <div
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.35)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 14,
                  padding: 32,
                  minWidth: 340,
                  boxShadow: "0 8px 40px #0003",
                }}
              >
                <h2 className="font-bold text-lg mb-1">Hot Plate Control</h2>
                <div className="mb-3 flex items-center gap-3">
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      background: isOn ? "#22c55e" : "#9ca3af",
                      boxShadow: isOn ? "0 0 6px #22c55e" : "none",
                    }}
                  />
                  <span className="font-mono text-sm">
                    {isOn ? "HEATING" : "OFF"} — {currentTemp}°C
                  </span>
                </div>
                <div className="mb-5">
                  <label className="block text-sm font-semibold mb-1">
                    Target Temperature: <span className="font-mono">{targetTemp}°C</span>
                  </label>
                  <input
                    type="range"
                    min={25}
                    max={500}
                    step={5}
                    defaultValue={targetTemp}
                    style={{ width: "100%" }}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setApparatus((prev) =>
                        prev.map((a) =>
                          a.type === "hotplate"
                            ? { ...a, data: { ...a.data, targetTemperature: val } }
                            : a,
                        ),
                      );
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>25°C</span>
                    <span>500°C</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    className={`px-5 py-2 rounded font-semibold text-white ${isOn ? "bg-red-500 hover:bg-red-600" : "bg-orange-500 hover:bg-orange-600"}`}
                    onClick={() => {
                      setApparatus((prev) =>
                        prev.map((a) =>
                          a.type === "hotplate"
                            ? {
                                ...a,
                                data: {
                                  ...a.data,
                                  isOn: !isOn,
                                  temperature: isOn ? 25 : (a.data?.temperature ?? 25),
                                },
                              }
                            : a,
                        ),
                      );
                      setShowHotPlateModal(false);
                    }}
                  >
                    {isOn ? "Turn OFF" : "Turn ON"}
                  </button>
                  <button
                    className="px-5 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                    onClick={() => setShowHotPlateModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {showLidModal &&
        (() => {
          const item = apparatus.find((a) => a.id === showLidModal.id);
          if (!item) return null;
          return (
            <div
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                width: "100vw",
                height: "100vh",
                background: "rgba(0,0,0,0.25)",
                zIndex: 100,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  background: "white",
                  borderRadius: 12,
                  padding: 32,
                  minWidth: 320,
                  boxShadow: "0 8px 32px #0002",
                }}
              >
                <h2 className="font-bold text-lg mb-2">{item.name}</h2>
                <p className="mb-4">
                  This container is closed. Remove the lid to pour?
                </p>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 mr-2"
                  onClick={() => {
                    setApparatus((prev) =>
                      prev.map((a) =>
                        a.id === item.id
                          ? { ...a, data: { ...a.data, hasLid: false } }
                          : a,
                      ),
                    );
                    setShowLidModal(null);
                  }}
                >
                  Remove Lid
                </button>
                <button
                  className="px-4 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                  onClick={() => setShowLidModal(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          );
        })()}

      {/* MODAL & SIDEBAR RESTORED */}
      {selectedApparatus && (
        <ApparatusDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedApparatus(null);
          }}
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
