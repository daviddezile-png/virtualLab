import React from 'react';
import { SimulationStep } from '../simulation/model';

interface ProtocolSidebarProps {
  currentStep: SimulationStep;
  isOpen: boolean;
  onClose: () => void;
}

const ProtocolSidebar: React.FC<ProtocolSidebarProps> = ({ currentStep, isOpen, onClose }) => {
  const protocolSteps = [
    {
      step: SimulationStep.SELECTION,
      title: "Step 1: Ingredient Selection",
      description: "Select the correct ingredients for vanishing cream preparation",
      details: [
        "Choose distilled water (60% of total volume)",
        "Select appropriate oil phase (30% of total volume)",
        "Pick emulsifying agent (5% of total volume)",
        "Add preservative (3% of total volume)",
        "Include fragrance (2% of total volume)",
        "Ensure all ingredients are laboratory grade"
      ],
      safety: [
        "Wear safety goggles and gloves",
        "Work in well-ventilated area",
        "Check ingredient expiration dates",
        "Use clean, dry measuring equipment"
      ],
      duration: "5-10 minutes",
      criticalPoints: [
        "Accurate measurement is crucial",
        "Contamination will affect final product",
        "Temperature of ingredients should be room temperature"
      ]
    },
    {
      step: SimulationStep.HEATING,
      title: "Step 2: Heating Phase",
      description: "Heat water and oil phases separately to specified temperatures",
      details: [
        "Heat water phase to 75°C ± 2°C",
        "Heat oil phase to 75°C ± 2°C",
        "Maintain temperature for 5 minutes",
        "Stir gently to ensure uniform heating",
        "Monitor temperature continuously",
        "Prepare emulsifier for addition"
      ],
      safety: [
        "Use heat-resistant gloves",
        "Be cautious of hot surfaces",
        "Use appropriate heating equipment",
        "Never leave heating unattended"
      ],
      duration: "10-15 minutes",
      criticalPoints: [
        "Temperature must be precise",
        "Overheating can degrade ingredients",
        "Both phases must be same temperature before mixing"
      ]
    },
    {
      step: SimulationStep.EMULSIFICATION,
      title: "Step 3: Emulsification",
      description: "Combine oil and water phases with emulsifier to create stable emulsion",
      details: [
        "Add emulsifier to oil phase while stirring",
        "Slowly add water phase to oil phase",
        "Stir at 500-800 rpm for 10 minutes",
        "Monitor for phase separation",
        "Check emulsion stability",
        "Adjust stirring speed if needed"
      ],
      safety: [
        "Add liquids slowly to avoid splashing",
        "Maintain consistent stirring speed",
        "Watch for overheating from friction"
      ],
      duration: "15-20 minutes",
      criticalPoints: [
        "Stirring speed is critical for proper emulsion",
        "Temperature must be maintained",
        "Phase separation indicates failure"
      ]
    },
    {
      step: SimulationStep.COOLING,
      title: "Step 4: Cooling Phase",
      description: "Cool the emulsion while maintaining stability",
      details: [
        "Cool to 40°C while stirring slowly",
        "Add preservative and fragrance at 40°C",
        "Continue stirring until room temperature",
        "Monitor for crystallization",
        "Check viscosity development",
        "Ensure uniform cooling"
      ],
      safety: [
        "Handle hot equipment carefully",
        "Add heat-sensitive ingredients at correct temperature",
        "Monitor for unexpected reactions"
      ],
      duration: "20-30 minutes",
      criticalPoints: [
        "Cooling rate affects final texture",
        "Additives must be added at specific temperatures",
        "Too fast cooling can cause instability"
      ]
    },
    {
      step: SimulationStep.EVALUATION,
      title: "Step 5: Quality Evaluation",
      description: "Test and evaluate the final vanishing cream product",
      details: [
        "Check pH level (should be 5.5-6.5)",
        "Test viscosity and texture",
        "Evaluate appearance and color",
        "Assess stability over 24 hours",
        "Check for phase separation",
        "Document all measurements"
      ],
      safety: [
        "Use proper testing equipment",
        "Follow laboratory testing protocols",
        "Dispose of test samples properly"
      ],
      duration: "10-15 minutes",
      criticalPoints: [
        "pH must be within specified range",
        "Viscosity should be consistent",
        "No phase separation should occur"
      ]
    }
  ];

  const currentProtocol = protocolSteps.find(p => p.step === currentStep);

  if (!isOpen || !currentProtocol) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Protocol Details</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="text-sm opacity-90">
            {currentProtocol.title}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Overview</h3>
            <p className="text-blue-800 text-sm">{currentProtocol.description}</p>
          </div>

          {/* Duration */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-semibold text-gray-700">Estimated Time:</span>
              <span className="text-gray-600">{currentProtocol.duration}</span>
            </div>
          </div>

          {/* Detailed Steps */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Procedure</h3>
            <ul className="space-y-2">
              {currentProtocol.details.map((detail, index) => (
                <li key={index} className="flex items-start space-x-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-semibold">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 text-sm">{detail}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Critical Points */}
          <div>
            <h3 className="font-semibold text-orange-900 mb-3">Critical Points</h3>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <ul className="space-y-2">
                {currentProtocol.criticalPoints.map((point, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-orange-800 text-sm">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Safety Instructions */}
          <div>
            <h3 className="font-semibold text-red-900 mb-3">Safety Precautions</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <ul className="space-y-2">
                {currentProtocol.safety.map((safety, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <span className="text-red-800 text-sm">{safety}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Step {protocolSteps.findIndex(p => p.step === currentStep) + 1} of {protocolSteps.length}
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProtocolSidebar;
