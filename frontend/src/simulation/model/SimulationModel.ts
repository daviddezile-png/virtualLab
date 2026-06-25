import {
  SimulationStep,
  Ingredient,
  IngredientType,
  SimulationState,
  SimulationError,
  BeakerState
} from './types';
import { AxonProperties } from './AxonProperties';
import { TelemetryManager } from '../telemetry/TelemetryManager';

export interface SimulationConfig {
  sessionId: string;
  studentId: string;
  telemetryEndpoint: string;
  maxErrors: number;
  timeLimits: Record<SimulationStep, number>; // in seconds
}

export class SimulationModel {
  private state: SimulationState;
  private axonProperties: AxonProperties;
  private telemetryManager: TelemetryManager;
  private config: SimulationConfig;
  private beakers: Map<string, BeakerState> = new Map();
  private stepStartTime: Map<SimulationStep, number> = new Map();

  constructor(config: SimulationConfig) {
    this.config = config;
    this.state = this.initializeState();
    this.axonProperties = new AxonProperties();
    this.telemetryManager = new TelemetryManager({
      apiEndpoint: config.telemetryEndpoint,
      sessionId: config.sessionId,
      studentId: config.studentId,
      batchSize: 10,
      flushInterval: 5000,
      retryAttempts: 3
    });

    this.initializeBeakers();
  }

  private initializeState(): SimulationState {
    return {
      currentStep: SimulationStep.SELECTION,
      isCompleted: false,
      isStarted: false,
      startTime: new Date(),
      errors: [],
      score: 0,
      feedback: [],
      currentIngredients: [],
      selectedIngredients: [],
      timeSpent: {
        [SimulationStep.SELECTION]: 0,
        [SimulationStep.HEATING]: 0,
        [SimulationStep.EMULSIFICATION]: 0,
        [SimulationStep.COOLING]: 0,
        [SimulationStep.EVALUATION]: 0
      }
    };
  }

  private initializeBeakers(): void {
    // Create oil phase beaker
    this.beakers.set('oil_phase', {
      id: 'oil_phase',
      ingredients: [],
      temperature: {
        current: 25,
        target: 75,
        heatingRate: 2.5,
        coolingRate: 1.5,
        lastUpdated: new Date()
      },
      pH: 6.5,
      viscosity: 500,
      volume: 0,
      isMixed: false
    });

    // Create water phase beaker
    this.beakers.set('water_phase', {
      id: 'water_phase',
      ingredients: [],
      temperature: {
        current: 25,
        target: 75,
        heatingRate: 3.0,
        coolingRate: 2.0,
        lastUpdated: new Date()
      },
      pH: 7.0,
      viscosity: 100,
      volume: 0,
      isMixed: false
    });

    // Create emulsion beaker
    this.beakers.set('emulsion', {
      id: 'emulsion',
      ingredients: [],
      temperature: {
        current: 25,
        target: 45,
        heatingRate: 1.5,
        coolingRate: 1.0,
        lastUpdated: new Date()
      },
      pH: 6.8,
      viscosity: 1000,
      volume: 0,
      isMixed: false
    });
  }

  public getCurrentStep(): SimulationStep {
    return this.state.currentStep;
  }

  public getState(): SimulationState {
    return { ...this.state };
  }

  public getBeaker(id: string): BeakerState | undefined {
    return this.beakers.get(id);
  }

  public getAxonProperties(): AxonProperties {
    return this.axonProperties;
  }

  // Step 1: Selection
  public selectIngredients(ingredients: Ingredient[]): boolean {
    if (this.state.currentStep !== SimulationStep.SELECTION) {
      this.logError('process_error', 'Cannot select ingredients outside selection step');
      return false;
    }

    try {
      // Validate ingredient combinations
      const oilPhaseIngredients = ingredients.filter(i => i.type === IngredientType.OIL_PHASE);
      const waterPhaseIngredients = ingredients.filter(i => i.type === IngredientType.WATER_PHASE);
      const emulsifiers = ingredients.filter(i => i.type === IngredientType.EMULSIFIER);

      if (oilPhaseIngredients.length === 0) {
        this.logError('wrong_ingredient', 'No oil phase ingredients selected');
        return false;
      }

      if (waterPhaseIngredients.length === 0) {
        this.logError('wrong_ingredient', 'No water phase ingredients selected');
        return false;
      }

      if (emulsifiers.length === 0) {
        this.logError('wrong_ingredient', 'No emulsifier selected');
        return false;
      }

      // Add ingredients to appropriate beakers
      oilPhaseIngredients.forEach(ingredient => {
        const beaker = this.beakers.get('oil_phase')!;
        beaker.ingredients.push(ingredient);
        beaker.volume += ingredient.quantity / ingredient.density;
      });

      waterPhaseIngredients.forEach(ingredient => {
        const beaker = this.beakers.get('water_phase')!;
        beaker.ingredients.push(ingredient);
        beaker.volume += ingredient.quantity / ingredient.density;
      });

      emulsifiers.forEach(ingredient => {
        const beaker = this.beakers.get('water_phase')!;
        beaker.ingredients.push(ingredient);
        beaker.volume += ingredient.quantity / ingredient.density;
      });

      this.telemetryManager.logAction('ingredients_selected', SimulationStep.SELECTION, {
        ingredientCount: ingredients.length,
        oilPhaseCount: oilPhaseIngredients.length,
        waterPhaseCount: waterPhaseIngredients.length,
        emulsifierCount: emulsifiers.length
      });

      this.moveToNextStep();
      return true;
    } catch (error) {
      this.logError('process_error', `Error during ingredient selection: ${error}`);
      return false;
    }
  }

  // Step 2: Heating
  public startHeating(beakerId: string): boolean {
    if (this.state.currentStep !== SimulationStep.HEATING) {
      this.logError('process_error', 'Cannot start heating outside heating step');
      return false;
    }

    const beaker = this.beakers.get(beakerId);
    if (!beaker) {
      this.logError('process_error', `Beaker ${beakerId} not found`);
      return false;
    }

    this.axonProperties.setProperty('is_heating', true);
    this.startTemperatureSimulation(beakerId, 'heating');
    
    this.telemetryManager.logAction('heating_started', SimulationStep.HEATING, { beakerId });
    return true;
  }

  public stopHeating(beakerId: string): boolean {
    this.axonProperties.setProperty('is_heating', false);
    this.stopTemperatureSimulation(beakerId);

    // After stopping heating, check if both phases are within allowed temperature range
    const oilBeaker = this.beakers.get('oil_phase');
    const waterBeaker = this.beakers.get('water_phase');
    if (oilBeaker && waterBeaker) {
      const oilTemp = oilBeaker.temperature.current;
      const waterTemp = waterBeaker.temperature.current;
      const tempDiff = Math.abs(oilTemp - waterTemp);
      // Acceptable range: 70-80°C, difference <= 5°C
      if (
        oilTemp >= 70 && oilTemp <= 80 &&
        waterTemp >= 70 && waterTemp <= 80 &&
        tempDiff <= 5
      ) {
        // Clear any previous temperature mismatch errors
        this.state.errors = this.state.errors.filter(e => e.type !== 'temperature_mismatch');
      }
    }

    this.telemetryManager.logAction('heating_stopped', SimulationStep.HEATING, { beakerId });
    return true;
  }

  // Step 3: Emulsification
  public startEmulsification(): boolean {
    if (this.state.currentStep !== SimulationStep.EMULSIFICATION) {
      this.logError('process_error', 'Cannot start emulsification outside emulsification step');
      return false;
    }

    // Validate temperature difference before mixing
    const tempValidation = this.axonProperties.validateTemperatureDifference(
      'oil_phase_temp',
      'water_phase_temp'
    );

    if (!tempValidation.isValid) {
      this.logError('temperature_mismatch', 
        `Temperature difference too high: ${tempValidation.difference.toFixed(1)}°C (max: ${tempValidation.tolerance}°C)`);
      return false;
    }

    this.axonProperties.setProperty('is_mixing', true);
    
    // Combine phases into emulsion beaker
    this.combinePhases();
    
    this.telemetryManager.logAction('emulsification_started', SimulationStep.EMULSIFICATION, {
      temperatureDifference: tempValidation.difference
    });

    return true;
  }

  private combinePhases(): void {
    const oilBeaker = this.beakers.get('oil_phase')!;
    const waterBeaker = this.beakers.get('water_phase')!;
    const emulsionBeaker = this.beakers.get('emulsion')!;

    // Combine all ingredients
    emulsionBeaker.ingredients = [...oilBeaker.ingredients, ...waterBeaker.ingredients];
    emulsionBeaker.volume = oilBeaker.volume + waterBeaker.volume;
    
    // Calculate average temperature
    const avgTemp = (oilBeaker.temperature.current + waterBeaker.temperature.current) / 2;
    emulsionBeaker.temperature.current = avgTemp;
    
    // Update axon properties
    this.axonProperties.setProperty('emulsion_temp', avgTemp);
  }

  // Step 4: Cooling
  public startCooling(): boolean {
    if (this.state.currentStep !== SimulationStep.COOLING) {
      this.logError('process_error', 'Cannot start cooling outside cooling step');
      return false;
    }

    this.axonProperties.setProperty('is_cooling', true);
    this.startTemperatureSimulation('emulsion', 'cooling');
    
    this.telemetryManager.logAction('cooling_started', SimulationStep.COOLING);
    return true;
  }

  public stopCooling(): boolean {
    this.axonProperties.setProperty('is_cooling', false);
    this.stopTemperatureSimulation('emulsion');
    
    this.telemetryManager.logAction('cooling_stopped', SimulationStep.COOLING);
    return true;
  }

  // Step 5: Evaluation
  public evaluateProduct(): { score: number; feedback: string[] } {
    if (this.state.currentStep !== SimulationStep.EVALUATION) {
      this.logError('process_error', 'Cannot evaluate outside evaluation step');
      return { score: 0, feedback: ['Invalid step for evaluation'] };
    }

    const feedback: string[] = [];
    let score = 100;

    const emulsionBeaker = this.beakers.get('emulsion')!;
    
    // Check temperature
    if (Math.abs(emulsionBeaker.temperature.current - 45) > 5) {
      score -= 20;
      feedback.push('Final temperature is not optimal (should be ~45°C)');
    }

    // Check pH
    if (Math.abs(emulsionBeaker.pH - 6.5) > 0.5) {
      score -= 15;
      feedback.push('pH level is not in optimal range (should be 6.0-7.0)');
    }

    // Check viscosity
    if (emulsionBeaker.viscosity < 2000 || emulsionBeaker.viscosity > 5000) {
      score -= 15;
      feedback.push('Viscosity is not in optimal range (should be 2000-5000 cP)');
    }

    // Check for errors during process
    const criticalErrors = this.state.errors.filter(e => e.severity === 'critical');
    if (criticalErrors.length > 0) {
      score -= criticalErrors.length * 10;
      feedback.push(`${criticalErrors.length} critical errors occurred during simulation`);
    }

    // Calculate final score
    this.state.score = Math.max(0, score);
    
    if (score >= 90) {
      feedback.push('Excellent work! Product quality is outstanding.');
    } else if (score >= 70) {
      feedback.push('Good work! Product meets quality standards.');
    } else {
      feedback.push('Product needs improvement. Review the process and try again.');
    }

    this.state.isCompleted = true;
    this.state.endTime = new Date();

    this.telemetryManager.logAction('evaluation_completed', SimulationStep.EVALUATION, {
      score: this.state.score,
      feedback
    });

    return { score: this.state.score, feedback };
  }

  private moveToNextStep(): void {
    const steps = Object.values(SimulationStep);
    const currentIndex = steps.indexOf(this.state.currentStep);
    
    if (currentIndex < steps.length - 1) {
      const duration = this.getStepDuration();
      this.telemetryManager.logStepComplete(this.state.currentStep, duration);
      
      this.state.currentStep = steps[currentIndex + 1];
      this.stepStartTime.set(this.state.currentStep, Date.now());
      
      this.telemetryManager.logStepStart(this.state.currentStep);
    }
  }

  private getStepDuration(): number {
    const startTime = this.stepStartTime.get(this.state.currentStep);
    return startTime ? (Date.now() - startTime) / 1000 : 0;
  }

  private startTemperatureSimulation(beakerId: string, mode: 'heating' | 'cooling'): void {
    const beaker = this.beakers.get(beakerId);
    if (!beaker) return;

    const interval = setInterval(() => {
      const isHeating = this.axonProperties.getProperty('is_heating')?.value;
      const isCooling = this.axonProperties.getProperty('is_cooling')?.value;

      if ((mode === 'heating' && !isHeating) || (mode === 'cooling' && !isCooling)) {
        clearInterval(interval);
        return;
      }

      const oldTemp = beaker.temperature.current;
      const rate = mode === 'heating' ? beaker.temperature.heatingRate : beaker.temperature.coolingRate;
      const target = beaker.temperature.target;

      if (mode === 'heating' && oldTemp < target) {
        beaker.temperature.current = Math.min(target, oldTemp + rate);
      } else if (mode === 'cooling' && oldTemp > target) {
        beaker.temperature.current = Math.max(target, oldTemp - rate);
      }

      beaker.temperature.lastUpdated = new Date();

      // Update axon properties
      const propertyId = beakerId === 'oil_phase' ? 'oil_phase_temp' : 
                       beakerId === 'water_phase' ? 'water_phase_temp' : 'emulsion_temp';
      
      const oldPropertyValue = this.axonProperties.getProperty(propertyId)?.value as number;
      this.axonProperties.setProperty(propertyId, beaker.temperature.current);

      // Log temperature change
      this.telemetryManager.logTemperatureChange(
        propertyId,
        oldPropertyValue || oldTemp,
        beaker.temperature.current,
        this.state.currentStep
      );
    }, 1000);
  }

  private stopTemperatureSimulation(_beakerId: string): void {
    // Temperature simulation will stop automatically when is_heating/is_cooling is false
  }

  private logError(type: SimulationError['type'], message: string, data?: any): void {
    const error: SimulationError = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      step: this.state.currentStep,
      type,
      message,
      severity: type === 'temperature_mismatch' ? 'critical' : 'error',
      data
    };

    this.state.errors.push(error);
    this.telemetryManager.logError(error);

    // Check max errors
    if (this.state.errors.length >= this.config.maxErrors) {
      this.state.isCompleted = true;
      this.state.endTime = new Date();
    }
  }

  public reset(): void {
    this.state = this.initializeState();
    this.axonProperties.reset();
    this.beakers.clear();
    this.initializeBeakers();
    this.stepStartTime.clear();
  }

  public destroy(): void {
    this.telemetryManager.destroy();
  }
}
