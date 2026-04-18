import React, { useState, useEffect } from "react";
import { SimulationStep, SimulationState } from "./simulation/model/types";
import { ErrorPopup, StepCompletePopup, HelpPopup } from "./components/Popups";
import InteractiveLabCanvas from "./components/InteractiveLabCanvas";
import { MainSim } from "./MainSim";
import "./App.css";
import ProtocolSidebar from "./components/ProtocolSidebar";

function App() {
  const [simulation, setSimulation] = useState<MainSim | null>(null);
  const [simulationState, setSimulationState] =
    useState<SimulationState | null>(null);
  const [showError, setShowError] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
    const [showProtocolSidebar, setShowProtocolSidebar] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [currentError, setCurrentError] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<SimulationStep>(
    SimulationStep.SELECTION,
  );

  useEffect(() => {
    // Initialize simulation
    const initSimulation = async () => {
      try {
        const sim = new MainSim();
        await sim.initialize();

        // Set up event listeners
        sim.onStateChange((state) => {
          setSimulationState(state);
          setCurrentStep(state.currentStep);
        });

        sim.onError((error) => {
          setCurrentError(error.message);
          setShowError(true);
        });

        sim.onStepComplete((step, score, feedback) => {
          console.log(
            "Step completed:",
            step,
            "Score:",
            score,
            "Feedback:",
            feedback,
          );
          setCurrentStep(step);
          setShowComplete(true);
        });

        setSimulation(sim);
        setSimulationState(sim.getState());
      } catch (error) {
        console.error("Failed to initialize simulation:", error);
        setCurrentError(
          "Failed to initialize simulation. Please refresh the page.",
        );
        setShowError(true);
      }
    };

    initSimulation();
  }, []);

  const handleStartSimulation = async () => {
    if (!simulation) return;

    try {
      await simulation.start();
      setSimulationState(simulation.getState());
    } catch (error) {
      console.error("Failed to start simulation:", error);
      setCurrentError("Failed to start simulation.");
      setShowError(true);
    }
  };

  const handleResetSimulation = async () => {
    if (!simulation) return;

    try {
      await simulation.reset();
      setSimulationState(simulation.getState());
    } catch (error) {
      console.error("Failed to reset simulation:", error);
      setCurrentError("Failed to reset simulation.");
      setShowError(true);
    }
  };

  return (
    <div className="min-h-screen bg-blue-500 w-full overflow-hidden">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">
                Virtual Vanishing Cream Simulation
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowHelp(true)}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
                title="Help"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
              {/*!simulationState?.isStarted ? (
                <button
                  onClick={handleStartSimulation}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Start Simulation
                </button>
              ) : (
                <button
                  onClick={handleResetSimulation}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Reset
                </button>
              )*/}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Full Width Simulation Area */}
      <div className="h-[calc(100vh-4rem)] overflow-hidden">
        {/* Interactive Lab Canvas - Full Width */}
        <div className=" h-full relative overflow-auto">
          <InteractiveLabCanvas
            currentStep={currentStep}
            onApparatusClick={(apparatus) => {
              console.log("Apparatus clicked:", apparatus);
            }}
          />
        </div>
      </div>

      {/* Popups */}
      <ErrorPopup
        isOpen={showError}
        message={currentError}
        onClose={() => setShowError(false)}
      />

      <StepCompletePopup
        isOpen={showComplete}
        step={currentStep}
        score={simulationState?.score || 0}
        feedback={simulationState?.feedback || []}
        onClose={() => setShowComplete(false)}
      />

      <HelpPopup
        isOpen={showHelp}
        step={currentStep}
        onClose={() => setShowHelp(false)}
      />
    </div>
  );
}

export default App;
