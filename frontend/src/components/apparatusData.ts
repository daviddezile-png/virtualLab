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
    data: { maxVolume: 1000, currentVolume: 500, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0 },
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
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(240, 240, 235, 0.6)", lidColor: "#8B6914" },
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
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(255, 250, 200, 0.5)", lidColor: "#FF8C00" },
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
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(220, 235, 250, 0.4)", lidColor: "#E8E8E8" },
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
    data: { maxVolume: 500, currentVolume: 300, hasLid: true, isPouring: false, pouringTargetId: null, pouringProgress: 0, liquidColor: "rgba(200, 120, 60, 0.5)", lidColor: "#654321" },
  },
];