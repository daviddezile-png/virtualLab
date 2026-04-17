import { SimulationModel, SimulationStep, IngredientType } from './simulation/model';
import { BeakerNode } from './simulation/view/BeakerNode';
import { ThermometerNode } from './simulation/view/ThermometerNode';

// Mock SceneryStack Scene class - replace with actual import
interface Scene {
  addChild(node: any): void;
  removeChild(node: any): void;
}

class MockScene implements Scene {
  children: any[] = [];
  
  addChild(node: any): void {
    this.children.push(node);
  }
  
  removeChild(node: any): void {
    const index = this.children.indexOf(node);
    if (index > -1) {
      this.children.splice(index, 1);
    }
  }
}

export class MainSim {
  private scene: Scene;
  private simulationModel: SimulationModel;
  private beakerNodes: Map<string, BeakerNode> = new Map();
  private thermometerNodes: Map<string, ThermometerNode> = new Map();
  private isInitialized: boolean = false;
  private stateChangeListeners: Array<(state: any) => void> = [];
  private errorListeners: Array<(error: any) => void> = [];
  private stepCompleteListeners: Array<(step: any, score: number, feedback: string[]) => void> = [];

  constructor(scene?: Scene, sessionId: string = 'default-session', studentId: string = 'default-student') {
    this.scene = scene || new MockScene();
    this.simulationModel = new SimulationModel({
      sessionId,
      studentId,
      telemetryEndpoint: '/api/log',
      maxErrors: 5,
      timeLimits: {
        [SimulationStep.SELECTION]: 300,
        [SimulationStep.HEATING]: 600,
        [SimulationStep.EMULSIFICATION]: 300,
        [SimulationStep.COOLING]: 600,
        [SimulationStep.EVALUATION]: 180
      }
    });
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create mock scene if not provided
      if (!this.scene) {
        this.scene = new MockScene();
      }

      // Load assets (mock implementation)
      const beakerImage = await this.loadImage('/assets/beaker.png');
      const thermometerImage = await this.loadImage('/assets/thermometer.png');

      // Create visual components for each beaker
      const oilBeaker = this.simulationModel.getBeaker('oil_phase');
      const waterBeaker = this.simulationModel.getBeaker('water_phase');
      const emulsionBeaker = this.simulationModel.getBeaker('emulsion');

      if (oilBeaker) {
        const oilBeakerNode = new BeakerNode(oilBeaker, beakerImage);
        oilBeakerNode.centerX = 200;
        oilBeakerNode.centerY = 300;
        this.beakerNodes.set('oil_phase', oilBeakerNode);
        this.scene.addChild(oilBeakerNode);

        // Create thermometer for oil phase
        const oilThermometer = new ThermometerNode(oilBeaker.temperature, thermometerImage);
        oilThermometer.centerX = oilBeakerNode.centerX + 100;
        oilThermometer.centerY = oilBeakerNode.centerY;
        this.thermometerNodes.set('oil_phase', oilThermometer);
        this.scene.addChild(oilThermometer);
      }

      if (waterBeaker) {
        const waterBeakerNode = new BeakerNode(waterBeaker, beakerImage);
        waterBeakerNode.centerX = 400;
        waterBeakerNode.centerY = 300;
        this.beakerNodes.set('water_phase', waterBeakerNode);
        this.scene.addChild(waterBeakerNode);

        // Create thermometer for water phase
        const waterThermometer = new ThermometerNode(waterBeaker.temperature, thermometerImage);
        waterThermometer.centerX = waterBeakerNode.centerX + 100;
        waterThermometer.centerY = waterBeakerNode.centerY;
        this.thermometerNodes.set('water_phase', waterThermometer);
        this.scene.addChild(waterThermometer);
      }

      if (emulsionBeaker) {
        const emulsionBeakerNode = new BeakerNode(emulsionBeaker, beakerImage);
        emulsionBeakerNode.centerX = 600;
        emulsionBeakerNode.centerY = 300;
        this.beakerNodes.set('emulsion', emulsionBeakerNode);
        this.scene.addChild(emulsionBeakerNode);

        // Create thermometer for emulsion
        const emulsionThermometer = new ThermometerNode(emulsionBeaker.temperature, thermometerImage);
        emulsionThermometer.centerX = emulsionBeakerNode.centerX + 100;
        emulsionThermometer.centerY = emulsionBeakerNode.centerY;
        this.thermometerNodes.set('emulsion', emulsionThermometer);
        this.scene.addChild(emulsionThermometer);
      }

      // Set up temperature property linking
      this.setupTemperatureLinking();

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize simulation:', error);
      throw error;
    }
  }

  private setupTemperatureLinking(): void {
    const axonProperties = this.simulationModel.getAxonProperties();

    // Link oil phase temperature
    const oilTempProperty = axonProperties.getProperty('oil_phase_temp');
    if (oilTempProperty) {
      this.thermometerNodes.get('oil_phase')?.setTemperatureProperty({
        link: (callback: (value: number) => void) => {
          // Mock property linking - in real implementation, use Axon property
          const checkTemp = () => {
            callback(oilTempProperty.value as number);
          };
          checkTemp();
          // In real implementation, this would be automatically updated by Axon
        }
      });
    }

    // Link water phase temperature
    const waterTempProperty = axonProperties.getProperty('water_phase_temp');
    if (waterTempProperty) {
      this.thermometerNodes.get('water_phase')?.setTemperatureProperty({
        link: (callback: (value: number) => void) => {
          const checkTemp = () => {
            callback(waterTempProperty.value as number);
          };
          checkTemp();
        }
      });
    }

    // Link emulsion temperature
    const emulsionTempProperty = axonProperties.getProperty('emulsion_temp');
    if (emulsionTempProperty) {
      this.thermometerNodes.get('emulsion')?.setTemperatureProperty({
        link: (callback: (value: number) => void) => {
          const checkTemp = () => {
            callback(emulsionTempProperty.value as number);
          };
          checkTemp();
        }
      });
    }
  }

  // Event listener methods
  public onStateChange(callback: (state: any) => void): void {
    this.stateChangeListeners.push(callback);
  }

  public onError(callback: (error: any) => void): void {
    this.errorListeners.push(callback);
  }

  public onStepComplete(callback: (step: any, score: number, feedback: string[]) => void): void {
    this.stepCompleteListeners.push(callback);
  }

  private notifyStateChange(state: any): void {
    this.stateChangeListeners.forEach(callback => callback(state));
  }

  private notifyError(error: any): void {
    this.errorListeners.forEach(callback => callback(error));
  }

  private notifyStepComplete(step: any, score: number, feedback: string[]): void {
    this.stepCompleteListeners.forEach(callback => callback(step, score, feedback));
  }

  private async loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        // Create a fallback canvas-based image
        const canvas = document.createElement('canvas');
        canvas.width = 80;
        canvas.height = 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#e3f2fd';
          ctx.fillRect(0, 0, 80, 120);
          ctx.strokeStyle = '#2196f3';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, 80, 120);
          ctx.fillStyle = '#2196f3';
          ctx.fillRect(0, 100, 80, 20);
        }
        const fallbackImg = new Image();
        fallbackImg.onload = () => resolve(fallbackImg);
        fallbackImg.src = canvas.toDataURL();
      };
      img.src = src;
    });
  }

  public startIngredientSelection(): void {
    // Highlight beakers for ingredient selection
    this.beakerNodes.get('oil_phase')?.highlight(true);
    this.beakerNodes.get('water_phase')?.highlight(true);
  }

  public selectIngredients(ingredients: any[]): boolean {
    const success = this.simulationModel.selectIngredients(ingredients);
    
    if (success) {
      // Update visual beakers
      this.updateBeakerVisuals();
      // Remove highlights
      this.beakerNodes.forEach(node => node.highlight(false));
    }
    
    return success;
  }

  public startHeating(beakerId: string): boolean {
    const success = this.simulationModel.startHeating(beakerId);
    
    if (success) {
      // Highlight the beaker being heated
      this.beakerNodes.get(beakerId)?.highlight(true);
      this.thermometerNodes.get(beakerId)?.highlight(true);
      
      // Start temperature animation
      this.animateHeating(beakerId);
    }
    
    return success;
  }

  public stopHeating(beakerId: string): boolean {
    const success = this.simulationModel.stopHeating(beakerId);
    
    if (success) {
      // Remove highlights
      this.beakerNodes.get(beakerId)?.highlight(false);
      this.thermometerNodes.get(beakerId)?.highlight(false);
    }
    
    return success;
  }

  public startEmulsification(): boolean {
    const success = this.simulationModel.startEmulsification();
    
    if (success) {
      // Hide individual beakers and show emulsion beaker
      this.beakerNodes.get('oil_phase')?.highlight(false);
      this.beakerNodes.get('water_phase')?.highlight(false);
      this.beakerNodes.get('emulsion')?.highlight(true);
      
      // Update visuals
      this.updateBeakerVisuals();
    }
    
    return success;
  }

  public startCooling(): boolean {
    const success = this.simulationModel.startCooling();
    
    if (success) {
      // Highlight emulsion beaker for cooling
      this.beakerNodes.get('emulsion')?.highlight(true);
      this.thermometerNodes.get('emulsion')?.highlight(true);
      
      // Start cooling animation
      this.animateCooling();
    }
    
    return success;
  }

  public stopCooling(): boolean {
    const success = this.simulationModel.stopCooling();
    
    if (success) {
      // Remove highlights
      this.beakerNodes.get('emulsion')?.highlight(false);
      this.thermometerNodes.get('emulsion')?.highlight(false);
    }
    
    return success;
  }

  public getState(): any {
    return this.simulationModel.getState();
  }

  public async start(): Promise<void> {
    // Mock implementation - update state to started
    const currentState = this.getState();
    currentState.isStarted = true;
    this.notifyStateChange(currentState);
  }

  public async reset(): Promise<void> {
    // Mock implementation - reset to initial state
    const initialState = {
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
    this.notifyStateChange(initialState);
  }

  public async goToStep(step: any): Promise<void> {
    // Mock implementation - update current step
    const currentState = this.getState();
    currentState.currentStep = step;
    this.notifyStateChange(currentState);
  }

  public evaluateProduct(): { score: number; feedback: string[] } {
    const result = this.simulationModel.evaluateProduct();
    
    // Remove all highlights
    this.beakerNodes.forEach(node => node.highlight(false));
    this.thermometerNodes.forEach(node => node.highlight(false));
    
    return result;
  }

  private updateBeakerVisuals(): void {
    // Update all beaker visuals based on current state
    ['oil_phase', 'water_phase', 'emulsion'].forEach(beakerId => {
      const beaker = this.simulationModel.getBeaker(beakerId);
      const beakerNode = this.beakerNodes.get(beakerId);
      
      if (beaker && beakerNode) {
        beakerNode.updateBeakerState(beaker);
      }
    });
  }

  private animateHeating(beakerId: string): void {
    const thermometer = this.thermometerNodes.get(beakerId);
    const beaker = this.simulationModel.getBeaker(beakerId);
    
    if (thermometer && beaker) {
      thermometer.animateToTemperature(beaker.temperature.target, 3000);
    }
  }

  private animateCooling(): void {
    const thermometer = this.thermometerNodes.get('emulsion');
    const beaker = this.simulationModel.getBeaker('emulsion');
    
    if (thermometer && beaker) {
      thermometer.animateToTemperature(beaker.temperature.target, 4000);
    }
  }

  public getCurrentStep(): SimulationStep {
    return this.simulationModel.getCurrentStep();
  }

  public getSimulationState() {
    return this.simulationModel.getState();
  }

  
  public dispose(): void {
    // Clean up visual components
    this.beakerNodes.forEach(node => {
      this.scene.removeChild(node);
      node.dispose();
    });
    
    this.thermometerNodes.forEach(node => {
      this.scene.removeChild(node);
      node.dispose();
    });
    
    // Clean up simulation model
    this.simulationModel.destroy();
    
    // Clear references
    this.beakerNodes.clear();
    this.thermometerNodes.clear();
    this.isInitialized = false;
  }
}

// Factory function for easy initialization
export function createMainSim(sessionId: string, studentId: string): MainSim {
  const scene = new MockScene(); // Replace with actual SceneryStack scene
  return new MainSim(scene, sessionId, studentId);
}
