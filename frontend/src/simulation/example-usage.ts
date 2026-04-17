// Example usage of the Virtual Vanishing Cream Simulation
import { SimulationModel, SimulationStep, IngredientType } from './model';
import { TelemetryManager } from './telemetry';

// Initialize the simulation
const simulation = new SimulationModel({
  sessionId: 'session_12345',
  studentId: 'student_67890',
  telemetryEndpoint: '/api/log',
  maxErrors: 5,
  timeLimits: {
    [SimulationStep.SELECTION]: 300, // 5 minutes
    [SimulationStep.HEATING]: 600,   // 10 minutes
    [SimulationStep.EMULSIFICATION]: 300, // 5 minutes
    [SimulationStep.COOLING]: 600,   // 10 minutes
    [SimulationStep.EVALUATION]: 180 // 3 minutes
  }
});

// Example: Select ingredients for vanishing cream
const ingredients = [
  {
    id: 'stearic_acid',
    name: 'Stearic Acid',
    type: IngredientType.OIL_PHASE,
    quantity: 15, // grams
    meltingPoint: 69,
    density: 0.85
  },
  {
    id: 'cetyl_alcohol',
    name: 'Cetyl Alcohol',
    type: IngredientType.OIL_PHASE,
    quantity: 10,
    meltingPoint: 49,
    density: 0.81
  },
  {
    id: 'water',
    name: 'Distilled Water',
    type: IngredientType.WATER_PHASE,
    quantity: 70,
    meltingPoint: 0,
    density: 1.0
  },
  {
    id: 'glycerin',
    name: 'Glycerin',
    type: IngredientType.WATER_PHASE,
    quantity: 5,
    meltingPoint: 17.9,
    density: 1.26
  },
  {
    id: 'triethanolamine',
    name: 'Triethanolamine',
    type: IngredientType.EMULSIFIER,
    quantity: 2,
    meltingPoint: 20,
    density: 1.12
  }
];

// Run the simulation steps
async function runSimulation() {
  try {
    console.log('Starting Vanishing Cream Simulation...');
    
    // Step 1: Selection
    console.log('Step 1: Selecting ingredients...');
    const selectionSuccess = simulation.selectIngredients(ingredients);
    if (!selectionSuccess) {
      console.error('Failed to select ingredients');
      return;
    }
    
    // Step 2: Heating
    console.log('Step 2: Heating phases...');
    simulation.startHeating('oil_phase');
    simulation.startHeating('water_phase');
    
    // Simulate heating process
    await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    
    simulation.stopHeating('oil_phase');
    simulation.stopHeating('water_phase');
    
    // Step 3: Emulsification
    console.log('Step 3: Starting emulsification...');
    const emulsificationSuccess = simulation.startEmulsification();
    if (!emulsificationSuccess) {
      console.error('Failed to start emulsification - temperature mismatch');
      return;
    }
    
    // Step 4: Cooling
    console.log('Step 4: Cooling the emulsion...');
    simulation.startCooling();
    
    // Simulate cooling process
    await new Promise(resolve => setTimeout(resolve, 8000)); // 8 seconds
    
    simulation.stopCooling();
    
    // Step 5: Evaluation
    console.log('Step 5: Evaluating final product...');
    const evaluation = simulation.evaluateProduct();
    
    console.log(`Final Score: ${evaluation.score}`);
    console.log('Feedback:');
    evaluation.feedback.forEach(feedback => console.log(`- ${feedback}`));
    
    // Get final state
    const finalState = simulation.getState();
    console.log(`Simulation completed with ${finalState.errors.length} errors`);
    
  } catch (error) {
    console.error('Simulation error:', error);
  } finally {
    // Clean up
    simulation.destroy();
  }
}

// Export for use in components
export { simulation, runSimulation };
