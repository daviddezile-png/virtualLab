// Core types for the Virtual Vanishing Cream Simulation

export enum SimulationStep {
  SELECTION = 'selection',
  HEATING = 'heating',
  EMULSIFICATION = 'emulsification',
  COOLING = 'cooling',
  EVALUATION = 'evaluation'
}

export enum IngredientType {
  OIL_PHASE = 'oil_phase',
  WATER_PHASE = 'water_phase',
  EMULSIFIER = 'emulsifier',
  ACTIVE_INGREDIENT = 'active_ingredient'
}

export interface Ingredient {
  id: string;
  name: string;
  type: IngredientType;
  quantity: number; // in grams
  meltingPoint: number; // in Celsius
  density: number; // g/cm³
}

export interface TemperatureData {
  current: number;
  target: number;
  heatingRate: number; // °C per second
  coolingRate: number; // °C per second
  lastUpdated: Date;
}

export interface AxonProperty<T = any> {
  id: string;
  name: string;
  value: T;
  type: 'temperature' | 'ph' | 'viscosity' | 'quantity' | 'boolean';
  constraints?: {
    min?: number;
    max?: number;
    tolerance?: number; // for temperature difference validation
  };
  lastModified: Date;
}

export interface SimulationState {
  currentStep: SimulationStep;
  isCompleted: boolean;
  isStarted: boolean;
  startTime: Date;
  endTime?: Date;
  errors: SimulationError[];
  score: number;
  feedback: string[];
  currentIngredients: Ingredient[];
  selectedIngredients: Ingredient[];
  timeSpent: Record<SimulationStep, number>;
}

export interface SimulationError {
  id: string;
  timestamp: Date;
  step: SimulationStep;
  type: 'temperature_mismatch' | 'wrong_ingredient' | 'incorrect_quantity' | 'process_error';
  message: string;
  severity: 'warning' | 'error' | 'critical';
  data?: any;
}

export interface TelemetryEvent {
  id: string;
  sessionId: string;
  studentId: string;
  timestamp: Date;
  eventType: 'step_start' | 'step_complete' | 'error' | 'action' | 'temperature_change';
  step?: SimulationStep;
  data: any;
  duration?: number; // in milliseconds
}

export interface BeakerState {
  id: string;
  ingredients: Ingredient[];
  temperature: TemperatureData;
  pH: number;
  viscosity: number; // in centipoise
  volume: number; // in mL
  isMixed: boolean;
}
