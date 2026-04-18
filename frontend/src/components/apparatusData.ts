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
    data: { maxVolume: 250, currentVolume: 0, hasLid: false },
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
    data: { maxVolume: 250, currentVolume: 0, hasLid: false },
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
    data: { maxVolume: 500, currentVolume: 0, hasLid: false },
  },
  {
    id: "distilled-water-bottle",
    type: "bottle",
    name: "Distilled Water Bottle",
    x: LEFT_GAP + 350,
    y: shelfY - 140,
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
    data: { maxVolume: 100 },
  },
  {
    id: "container-stearic-acid",
    type: "bottle",
    name: "Stearic Acid",
    x: LEFT_GAP + 530,
    y: shelfY - 140,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500 },
  },
  {
    id: "container-liquid-paraffin",
    type: "bottle",
    name: "Liquid Paraffin",
    x: LEFT_GAP + 610,
    y: shelfY - 140,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500 },
  },
  {
    id: "container-glycerin",
    type: "bottle",
    name: "Glycerin",
    x: LEFT_GAP + 690,
    y: shelfY - 140,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500 },
  },
  {
    id: "container-koh-triethanolamine",
    type: "bottle",
    name: "KOH & Triethanolamine",
    x: LEFT_GAP + 770,
    y: shelfY - 140,
    width: 60,
    height: 130,
    isInteractive: true,
    data: { maxVolume: 500 },
  },
];