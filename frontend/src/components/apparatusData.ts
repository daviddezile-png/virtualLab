export interface Apparatus {
  id: string;
  type: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  image?: string;
  data?: {
    maxVolume?: number;
    currentVolume?: number;
    emptyWeight?: number;       // tare weight (g) of the empty glass vessel itself
    hasLid?: boolean;
    isPouring?: boolean;
    pouringTargetId?: string | null;
    pouringProgress?: number;
    liquidColor?: string;
    lidColor?: string;
    isOn?: boolean;
    temperature?: number;
    targetTemperature?: number;
    liquidTemperature?: number;
    readingTemperature?: number;
    isStirring?: boolean;
    stirringTargetId?: string | null;
    pH?: number;
    viscosity?: number;
    phReading?: number;
    viscosityReading?: number;
    isViscosityActive?: boolean;
    isSolid?: boolean;          // true → content is solid at room temp
    density?: number;           // g/mL for weight calculation
    spatulaLoad?: number;       // grams of solid on spatula blade
    spatulaLoadSourceId?: string | null;
    solidStearicGrams?: number; // grams of solid stearic acid in beaker (melts when hot)
    solidBeeswaxGrams?: number; // grams of solid beeswax in beaker (melts at 62°C)
    iceLevel?: number;
    emulsificationProgress?: number;
    mixedWarm?: boolean;              // phases were combined while warm (≥55°C)
    creamQuality?: number;            // 0..1 quality of finished emulsion (drives colour)
    maxTemperatureReached?: number;   // peak temperature during heating
    stirringSeconds?: number;         // total seconds stirred
    minCoolingTemp?: number;          // lowest temperature reached in ice bucket
    pouringSourceHistory?: string[];  // IDs poured into this beaker, in order
    containedInId?: string | null;    // id of the container this item is resting inside
    composition?: {
      stearicAcid?: number;
      liquidParaffin?: number;
      glycerin?: number;
      koh?: number;
      water?: number;
      beeswax?: number;   // cold cream
      borax?: number;     // cold cream
    };
  };
  isInteractive: boolean;
}

// Empty (tare) weight of each glass vessel in grams.  The digital balance reads
// the REAL weight (beaker + contents), so the student subtracts these listed
// values to find the net mass of reagent.  Shown in the lab notebook's
// Materials section and applied to the on-bench balance in InteractiveLabCanvas.
export const BEAKER_EMPTY_WEIGHTS: Record<string, number> = {
  "beaker-250-oil": 110,
  "beaker-250-aqueous": 110,
  "beaker-500-main": 190,
  "graduated-cylinder-100": 95,
};

// Compact shelf layout — 15 px gap within a group, 25 px between groups.
// All shelf items fit within ~1150 px so they are visible on small screens.
//
// Group 1 (beakers):      LEFT_GAP+20  … LEFT_GAP+240
// Group 2 (water/cyl):    LEFT_GAP+265 … LEFT_GAP+390
// Group 3 (chemicals):    LEFT_GAP+415 … LEFT_GAP+700
// Group 4 (instruments):  LEFT_GAP+725 … LEFT_GAP+963
// Group 5 (cc chemicals): LEFT_GAP+988 … LEFT_GAP+1123
export const getInitialApparatus = (LEFT_GAP: number, shelfY: number, TABLE_Y: number): Apparatus[] => [
  // ── Group 1: Beakers ─────────────────────────────────────────────────────
  {
    id: "beaker-250-oil",
    type: "beaker",
    name: "250 mL Beaker (Oil Phase)",
    x: LEFT_GAP + 20,
    y: shelfY - 100,
    width: 60,
    height: 100,
    isInteractive: true,
    data: { maxVolume: 250, currentVolume: 0, emptyWeight: BEAKER_EMPTY_WEIGHTS["beaker-250-oil"], hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "beaker-250-aqueous",
    type: "beaker",
    name: "250 mL Beaker (Aqueous Phase)",
    x: LEFT_GAP + 95,
    y: shelfY - 100,
    width: 60,
    height: 100,
    isInteractive: true,
    data: { maxVolume: 250, currentVolume: 0, emptyWeight: BEAKER_EMPTY_WEIGHTS["beaker-250-aqueous"], hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "beaker-500-main",
    type: "beaker",
    name: "500 mL Beaker (Main Mixing)",
    x: LEFT_GAP + 170,
    y: shelfY - 120,
    width: 70,
    height: 120,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 0, emptyWeight: BEAKER_EMPTY_WEIGHTS["beaker-500-main"], hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  // ── Group 2: Distilled water + graduated cylinder ─────────────────────────
  {
    id: "distilled-water-bottle",
    type: "bottle",
    name: "Distilled Water Bottle",
    x: LEFT_GAP + 265,
    y: shelfY - 150,
    width: 70,
    height: 150,
    isInteractive: true,
    data: { maxVolume: 1000, currentVolume: 920, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(185, 228, 255, 0.32)", lidColor: "#3b82f6", pH: 7.0, viscosity: 1, density: 1.0 },
  },
  {
    id: "graduated-cylinder-100",
    type: "cylinder",
    name: "100 mL Graduated Cylinder",
    x: LEFT_GAP + 350,
    y: shelfY - 120,
    width: 40,
    height: 120,
    isInteractive: true,
    data: { maxVolume: 100, currentVolume: 0, emptyWeight: BEAKER_EMPTY_WEIGHTS["graduated-cylinder-100"], hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  // ── Group 3: Chemical bottles ─────────────────────────────────────────────
  {
    id: "container-stearic-acid",
    type: "bottle",
    name: "Stearic Acid",
    x: LEFT_GAP + 415,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: {
      maxVolume: 500, currentVolume: 470, hasLid: true, isPouring: false, pouringTargetId: null,
      pouringProgress: 0, liquidColor: "rgba(255, 252, 245, 0.95)", lidColor: "#8B6914",
      pH: 3.5, viscosity: 15, isSolid: true, density: 0.847,
    },
  },
  {
    id: "container-liquid-paraffin",
    type: "bottle",
    name: "Liquid Paraffin",
    x: LEFT_GAP + 490,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 470, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 248, 195, 0.70)", lidColor: "#FF8C00", pH: 7.0, viscosity: 110, density: 0.88 },
  },
  {
    id: "container-glycerin",
    type: "bottle",
    name: "Glycerin",
    x: LEFT_GAP + 565,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 470, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(235, 250, 215, 0.62)", lidColor: "#E8E8E8", pH: 7.5, viscosity: 1412, density: 1.261 },
  },
  {
    id: "container-koh-triethanolamine",
    type: "bottle",
    name: "KOH & Triethanolamine",
    x: LEFT_GAP + 640,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 470, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 245, 175, 0.68)", lidColor: "#654321", pH: 13.5, viscosity: 3, density: 1.1 },
  },
  // ── Table equipment (y positions are TABLE_Y-based, not shelf-based) ──────
  {
    id: "ice-bucket",
    type: "icebucket",
    name: "Ice Bucket",
    x: LEFT_GAP + 300,
    y: TABLE_Y - 110,
    width: 160,
    height: 110,
    isInteractive: false,
    data: { iceLevel: 100 },
  },
  {
    id: "hot-plate-1",
    type: "hotplate",
    name: "Hot Plate",
    x: LEFT_GAP + 500,
    y: TABLE_Y - 65,
    width: 270,
    height: 65,
    isInteractive: true,
    data: { isOn: false, temperature: 25, targetTemperature: 75 },
  },
  {
    id: "weight-balance",
    type: "weightbalance",
    name: "Digital Weight Balance",
    x: LEFT_GAP + 80,
    y: TABLE_Y - 85,
    width: 150,
    height: 85,
    isInteractive: true,
    data: { isOn: true },
  },
  // ── Group 4: Instruments ──────────────────────────────────────────────────
  {
    id: "thermometer-digital",
    type: "thermometer",
    name: "Glass Thermometer 1",
    x: LEFT_GAP + 725,
    y: shelfY - 130,
    width: 30,
    height: 130,
    isInteractive: true,
    data: { readingTemperature: 25 },
  },
  // Second thermometer — lets the student read both phases (oil + aqueous) at the
  // same time.  Lives on the shelf next to thermometer 1.
  {
    id: "thermometer-digital-2",
    type: "thermometer",
    name: "Glass Thermometer 2",
    x: LEFT_GAP + 760,
    y: shelfY - 130,
    width: 30,
    height: 130,
    isInteractive: true,
    data: { readingTemperature: 25 },
  },
  {
    id: "glass-stirring-rod",
    type: "stirringrod",
    name: "Glass Stirring Rod",
    x: LEFT_GAP + 805,
    y: shelfY - 155,
    width: 20,
    height: 155,
    isInteractive: true,
    data: { isStirring: false, stirringTargetId: null },
  },
  {
    id: "spatula",
    type: "spatula",
    name: "Spatula",
    x: LEFT_GAP + 840,
    y: shelfY - 150,
    width: 18,
    height: 150,
    isInteractive: true,
    data: { spatulaLoad: 0, spatulaLoadSourceId: null },
  },
  {
    id: "ph-meter",
    type: "phmeter",
    name: "pH Meter",
    x: LEFT_GAP + 873,
    y: shelfY - 165,
    width: 48,
    height: 165,
    isInteractive: true,
    data: { phReading: 7.0 },
  },
  {
    id: "viscosity-gauge",
    type: "viscositygauge",
    name: "Viscosity Gauge",
    x: LEFT_GAP + 936,
    y: shelfY - 150,
    width: 62,
    height: 150,
    isInteractive: true,
    data: { viscosityReading: 0, isViscosityActive: false },
  },
  // ── Group 5: Cold-cream chemicals stored on shelf ─────────────────────────
  {
    id: "container-beeswax",
    type: "bottle",
    name: "Beeswax",
    x: LEFT_GAP + 1023,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: {
      maxVolume: 300, currentVolume: 275, hasLid: true,
      isPouring: false, pouringTargetId: null, pouringProgress: 0,
      liquidColor: "rgba(255,213,79,0.82)", lidColor: "#b8860b",
      isSolid: true, density: 0.96,
    },
  },
  {
    id: "container-borax",
    type: "bottle",
    name: "Borax Solution",
    x: LEFT_GAP + 1098,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: {
      maxVolume: 300, currentVolume: 275, hasLid: true,
      isPouring: false, pouringTargetId: null, pouringProgress: 0,
      liquidColor: "rgba(200,240,255,0.65)", lidColor: "#0ea5e9",
      pH: 9.2, viscosity: 1.2, density: 1.07,
    },
  },
];

// ── Cold Cream (W/O) initial apparatus ────────────────────────────────────────
// Same compact shelf layout — all items fit within ~900 px.
//
// Group 1 (beakers):       LEFT_GAP+20  … LEFT_GAP+240
// Group 2 (water/cyl):     LEFT_GAP+265 … LEFT_GAP+390
// Group 3 (cc chemicals):  LEFT_GAP+415 … LEFT_GAP+625
// Group 4 (instruments):   LEFT_GAP+650 … LEFT_GAP+888
export const getInitialApparatusColdCream = (LEFT_GAP: number, shelfY: number, TABLE_Y: number): Apparatus[] => [
  // ── Group 1: Beakers ─────────────────────────────────────────────────────
  { id:"beaker-250-oil",    type:"beaker",  name:"250 mL Beaker (Oil Phase)",    x:LEFT_GAP+20,  y:shelfY-100, width:60, height:100, isInteractive:true, data:{maxVolume:250,currentVolume:0,emptyWeight:BEAKER_EMPTY_WEIGHTS["beaker-250-oil"],hasLid:false,liquidColor:"rgba(255,213,79,0.4)"} },
  { id:"beaker-250-aqueous",type:"beaker",  name:"250 mL Beaker (Aqueous Phase)",x:LEFT_GAP+95,  y:shelfY-100, width:60, height:100, isInteractive:true, data:{maxVolume:250,currentVolume:0,emptyWeight:BEAKER_EMPTY_WEIGHTS["beaker-250-aqueous"],hasLid:false,liquidColor:"rgba(200,240,255,0.4)"} },
  { id:"beaker-500-main",   type:"beaker",  name:"500 mL Beaker (Main Mixing)",  x:LEFT_GAP+170, y:shelfY-120, width:70, height:120, isInteractive:true, data:{maxVolume:500,currentVolume:0,emptyWeight:BEAKER_EMPTY_WEIGHTS["beaker-500-main"],hasLid:false,liquidColor:"rgba(240,235,220,0.6)"} },
  // ── Group 2: Distilled water + graduated cylinder ─────────────────────────
  { id:"distilled-water-bottle", type:"bottle", name:"Distilled Water", x:LEFT_GAP+265, y:shelfY-150, width:70, height:150, isInteractive:true,
    data:{maxVolume:1000,currentVolume:920,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,liquidColor:"rgba(185,228,255,0.32)",lidColor:"#3b82f6",pH:7.0,viscosity:1,density:1.0} },
  { id:"graduated-cylinder-100", type:"cylinder", name:"100 mL Graduated Cylinder", x:LEFT_GAP+350, y:shelfY-120, width:40, height:120, isInteractive:true,
    data:{maxVolume:100,currentVolume:0,emptyWeight:BEAKER_EMPTY_WEIGHTS["graduated-cylinder-100"],hasLid:false,liquidColor:"rgba(56,189,248,0.6)"} },
  // ── Group 3: ALL chemicals (every reagent is available in both practicals so
  //     a wrong-chemical selection can be caught) ───────────────────────────
  { id:"container-beeswax", type:"bottle", name:"Beeswax", x:LEFT_GAP+415, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:300,currentVolume:275,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(255,213,79,0.85)",lidColor:"#b8860b",isSolid:true,density:0.96} },
  { id:"container-liquid-paraffin", type:"bottle", name:"Liquid Paraffin", x:LEFT_GAP+490, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:500,currentVolume:470,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(255,248,195,0.70)",lidColor:"#FF8C00",pH:7.0,viscosity:110,density:0.88} },
  { id:"container-borax", type:"bottle", name:"Borax Solution", x:LEFT_GAP+565, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:300,currentVolume:275,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(200,240,255,0.65)",lidColor:"#0ea5e9",pH:9.2,viscosity:1.2,density:1.07} },
  { id:"container-stearic-acid", type:"bottle", name:"Stearic Acid", x:LEFT_GAP+640, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:500,currentVolume:470,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(255,252,245,0.95)",lidColor:"#8B6914",pH:3.5,viscosity:15,isSolid:true,density:0.847} },
  { id:"container-glycerin", type:"bottle", name:"Glycerin", x:LEFT_GAP+715, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:500,currentVolume:470,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(235,250,215,0.62)",lidColor:"#E8E8E8",pH:7.5,viscosity:1412,density:1.261} },
  { id:"container-koh-triethanolamine", type:"bottle", name:"KOH & Triethanolamine", x:LEFT_GAP+790, y:shelfY-130, width:60, height:130, isInteractive:true,
    data:{maxVolume:500,currentVolume:470,hasLid:true,isPouring:false,pouringTargetId:null,pouringProgress:0,
      liquidColor:"rgba(255,245,175,0.68)",lidColor:"#654321",pH:13.5,viscosity:3,density:1.1} },
  // ── Table equipment ───────────────────────────────────────────────────────
  { id:"ice-bucket",        type:"icebucket",    name:"Ice Bucket",             x:LEFT_GAP+300, y:TABLE_Y-110, width:160, height:110, isInteractive:false, data:{iceLevel:100} },
  { id:"hot-plate-1",       type:"hotplate",      name:"Hot Plate",              x:LEFT_GAP+500, y:TABLE_Y-65,  width:270, height:65,  isInteractive:true,  data:{isOn:false,temperature:25,targetTemperature:70} },
  { id:"weight-balance",    type:"weightbalance", name:"Digital Weight Balance", x:LEFT_GAP+80,  y:TABLE_Y-85,  width:150, height:85,  isInteractive:true,  data:{isOn:true} },
  // ── Group 4: Instruments (shifted right to make room for all chemicals) ─────
  { id:"thermometer-digital",type:"thermometer",  name:"Glass Thermometer 1",   x:LEFT_GAP+875,  y:shelfY-130,  width:30,  height:130, isInteractive:true, data:{readingTemperature:25} },
  // Second thermometer — read both phases at once (lives on the shelf).
  { id:"thermometer-digital-2",type:"thermometer",name:"Glass Thermometer 2",   x:LEFT_GAP+910,  y:shelfY-130,  width:30,  height:130, isInteractive:true, data:{readingTemperature:25} },
  { id:"glass-stirring-rod", type:"stirringrod",  name:"Glass Stirring Rod",    x:LEFT_GAP+955,  y:shelfY-155,  width:20,  height:155, isInteractive:true, data:{isStirring:false,stirringTargetId:null} },
  { id:"spatula",            type:"spatula",       name:"Spatula",               x:LEFT_GAP+990,  y:shelfY-150,  width:18,  height:150, isInteractive:true, data:{spatulaLoad:0,spatulaLoadSourceId:null} },
  { id:"ph-meter",           type:"phmeter",       name:"pH Meter",              x:LEFT_GAP+1023, y:shelfY-165,  width:48,  height:165, isInteractive:true, data:{phReading:7.0} },
  { id:"viscosity-gauge",    type:"viscositygauge",name:"Viscosity Gauge",       x:LEFT_GAP+1086, y:shelfY-150,  width:62,  height:150, isInteractive:true, data:{viscosityReading:0,isViscosityActive:false} },
];
