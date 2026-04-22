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
  };
  isInteractive: boolean;
}

export const getInitialApparatus = (LEFT_GAP: number, shelfY: number, TABLE_Y: number): Apparatus[] => [
  {
    id: "beaker-250-oil",
    type: "beaker",
    name: "250 mL Beaker (Oil Phase)",
    x: LEFT_GAP + 50,
    y: shelfY - 100,
    width: 60,
    height: 100,
    isInteractive: true,
    data: { maxVolume: 250, currentVolume: 0, hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "beaker-250-aqueous",
    type: "beaker",
    name: "250 mL Beaker (Aqueous Phase)",
    x: LEFT_GAP + 150,
    y: shelfY - 100,
    width: 60,
    height: 100,
    isInteractive: true,
    data: { maxVolume: 250, currentVolume: 0, hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "beaker-500-main",
    type: "beaker",
    name: "500 mL Beaker (Main Mixing)",
    x: LEFT_GAP + 250,
    y: shelfY - 120,
    width: 70,
    height: 120,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 0, hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "distilled-water-bottle",
    type: "bottle",
    name: "Distilled Water Bottle",
    x: LEFT_GAP + 350,
    y: shelfY - 150,
    width: 70,
    height: 150,
    isInteractive: true,
    data: { maxVolume: 1000, currentVolume: 500, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(185, 228, 255, 0.32)", lidColor: "#3b82f6", pH: 7.0, viscosity: 1 },
  },
  {
    id: "graduated-cylinder-100",
    type: "cylinder",
    name: "100 mL Graduated Cylinder",
    x: LEFT_GAP + 440,
    y: shelfY - 120,
    width: 40,
    height: 120,
    isInteractive: true,
    data: { maxVolume: 100, currentVolume: 0, hasLid: false, liquidColor: "rgba(56, 189, 248, 0.6)" },
  },
  {
    id: "container-stearic-acid",
    type: "bottle",
    name: "Stearic Acid",
    x: LEFT_GAP + 530,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 252, 245, 0.92)", lidColor: "#8B6914", pH: 3.5, viscosity: 15 },
  },
  {
    id: "container-liquid-paraffin",
    type: "bottle",
    name: "Liquid Paraffin",
    x: LEFT_GAP + 610,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 248, 195, 0.70)", lidColor: "#FF8C00", pH: 7.0, viscosity: 110 },
  },
  {
    id: "container-glycerin",
    type: "bottle",
    name: "Glycerin",
    x: LEFT_GAP + 690,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(235, 250, 215, 0.62)", lidColor: "#E8E8E8", pH: 7.5, viscosity: 1412 },
  },
  {
    id: "container-koh-triethanolamine",
    type: "bottle",
    name: "KOH & Triethanolamine",
    x: LEFT_GAP + 770,
    y: shelfY - 130,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 245, 175, 0.68)", lidColor: "#654321", pH: 13.5, viscosity: 3 },
  },
  {
    id: "hot-plate-1",
    type: "hotplate",
    name: "Hot Plate",
    x: LEFT_GAP + 500,
    y: TABLE_Y - 65,
    width: 130,
    height: 65,
    isInteractive: true,
    data: { isOn: false, temperature: 25, targetTemperature: 200 },
  },
  {
    id: "thermometer-digital",
    type: "thermometer",
    name: "Digital Thermometer",
    x: LEFT_GAP + 870,
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
    x: LEFT_GAP + 925,
    y: shelfY - 155,
    width: 20,
    height: 155,
    isInteractive: true,
    data: { isStirring: false, stirringTargetId: null },
  },
  {
    id: "ph-meter",
    type: "phmeter",
    name: "pH Meter",
    x: LEFT_GAP + 960,
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
    x: LEFT_GAP + 1025,
    y: shelfY - 150,
    width: 62,
    height: 150,
    isInteractive: true,
    data: { viscosityReading: 0, isViscosityActive: false },
  },
];