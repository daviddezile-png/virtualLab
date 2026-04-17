import React, { useEffect, useState } from "react";
import { SimulationError, SimulationStep } from "../simulation/model";

interface ErrorPopupProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const ErrorPopup: React.FC<ErrorPopupProps> = ({
  isOpen,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 5000,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isOpen);

    if (isOpen && autoClose) {
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isOpen, autoClose, autoCloseDelay]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300); // Allow animation to complete
  };

  if (!isOpen || !isVisible) return null;

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "bg-red-100 border-red-400 text-red-800";
      case "error":
        return "bg-orange-100 border-orange-400 text-orange-800";
      case "warning":
        return "bg-yellow-100 border-yellow-400 text-yellow-800";
      default:
        return "bg-gray-100 border-gray-400 text-gray-800";
    }
  };

  const getIcon = (severity: string): string => {
    switch (severity) {
      case "critical":
        return "🚨";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4 border-2 border-red-400 transform transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } bg-red-50 text-red-800`}
      >
        <div className="flex items-start space-x-3">
          <div className="text-2xl flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-2">Error</h3>
            <p className="text-sm mb-3">{message}</p>
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-red-200 text-red-800 rounded hover:bg-red-300 transition-colors text-sm font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface StepCompletePopupProps {
  isOpen: boolean;
  step: SimulationStep;
  score?: number;
  feedback?: string[];
  onClose: () => void;
}

export const StepCompletePopup: React.FC<StepCompletePopupProps> = ({
  isOpen,
  step,
  score,
  feedback = [],
  onClose,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(isOpen);
  }, [isOpen]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(), 300);
  };

  const stepLabels: Record<SimulationStep, string> = {
    [SimulationStep.SELECTION]: "Ingredient Selection",
    [SimulationStep.HEATING]: "Heating Phase",
    [SimulationStep.EMULSIFICATION]: "Emulsification",
    [SimulationStep.COOLING]: "Cooling Phase",
    [SimulationStep.EVALUATION]: "Final Evaluation",
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 transform transition-all duration-300 ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Step Complete!
          </h2>
          <p className="text-gray-600">
            {stepLabels[step]} has been completed successfully.
          </p>
        </div>

        {score !== undefined && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <div className="text-center">
              <div className="text-sm text-blue-600 font-medium mb-1">
                Current Score
              </div>
              <div className="text-3xl font-bold text-blue-700">{score}%</div>
            </div>
          </div>
        )}

        {feedback.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">Feedback:</h3>
            <ul className="space-y-1 text-sm text-gray-600">
              {feedback.map((item, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-center">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Continue to Next Step
          </button>
        </div>
      </div>
    </div>
  );
};

interface HelpPopupProps {
  isOpen: boolean;
  step: SimulationStep;
  onClose: () => void;
}

export const HelpPopup: React.FC<HelpPopupProps> = ({
  isOpen,
  onClose,
  step,
}) => {
  if (!isOpen) return null;

  const helpContent: Record<
    SimulationStep,
    { title: string; content: string[]; tips: string[] }
  > = {
    [SimulationStep.SELECTION]: {
      title: "Ingredient Selection",
      content: [
        "Select appropriate ingredients for your vanishing cream formulation.",
        "You need oil phase ingredients, water phase ingredients, and an emulsifier.",
        "Consider the melting points and properties of each ingredient.",
      ],
      tips: [
        "Stearic acid and cetyl alcohol are common oil phase ingredients.",
        "Water and glycerin form the water phase.",
        "Triethanolamine is a common emulsifier for cream formulations.",
      ],
    },
    [SimulationStep.HEATING]: {
      title: "Heating Phase",
      content: [
        "Heat both oil and water phases separately to their target temperatures.",
        "Typical target temperature is around 75°C for both phases.",
        "Monitor temperatures closely to ensure proper heating.",
      ],
      tips: [
        "Oil phase heats slower than water phase.",
        "Temperature difference between phases must be ±5°C before mixing.",
        "Use the thermometers to track real-time temperatures.",
      ],
    },
    [SimulationStep.EMULSIFICATION]: {
      title: "Emulsification",
      content: [
        "Mix the heated oil and water phases together.",
        "This creates the emulsion base for your vanishing cream.",
        "Proper temperature matching is crucial for successful emulsification.",
      ],
      tips: [
        "Pour oil phase into water phase slowly while stirring.",
        "Continue mixing until the emulsion is uniform.",
        "The mixture should appear creamy and homogeneous.",
      ],
    },
    [SimulationStep.COOLING]: {
      title: "Cooling Phase",
      content: [
        "Cool the emulsion to room temperature or target temperature.",
        "Typical final temperature is around 45°C for vanishing cream.",
        "Cooling affects the final texture and consistency.",
      ],
      tips: [
        "Cool slowly to prevent phase separation.",
        "Stir gently during cooling to maintain uniformity.",
        "Monitor for any changes in appearance or texture.",
      ],
    },
    [SimulationStep.EVALUATION]: {
      title: "Product Evaluation",
      content: [
        "Evaluate your final vanishing cream product.",
        "Check temperature, pH, viscosity, and overall quality.",
        "Your score is based on how well you followed the process.",
      ],
      tips: [
        "Optimal pH range for skin products is 6.0-7.0.",
        "Viscosity should be between 2000-5000 cP for vanishing cream.",
        "Final temperature should be around 45°C for proper consistency.",
      ],
    },
  };

  const content = helpContent[step];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-800">{content.title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Instructions:</h3>
            <ul className="space-y-2 text-gray-600">
              {content.content.map((item, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-blue-500 mt-1 flex-shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-gray-700 mb-2">Tips:</h3>
            <ul className="space-y-2 text-gray-600">
              {content.tips.map((tip, index) => (
                <li key={index} className="flex items-start space-x-2">
                  <span className="text-green-500 mt-1 flex-shrink-0">💡</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};
