import React, { useState } from "react";
import { SimulationStep, SimulationState } from "../simulation/model";

interface SidebarProps {
  currentStep: SimulationStep;
  onStepSelect?: (step: SimulationStep) => void;
  simulationState: SimulationState | null;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentStep,
  onStepSelect,
  simulationState,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const steps = [
    { key: SimulationStep.SELECTION, label: "Selection", icon: "🧪" },
    { key: SimulationStep.HEATING, label: "Heating", icon: "🔥" },
    { key: SimulationStep.EMULSIFICATION, label: "Emulsification", icon: "🔄" },
    { key: SimulationStep.COOLING, label: "Cooling", icon: "❄️" },
    { key: SimulationStep.EVALUATION, label: "Evaluation", icon: "📊" },
  ];

  const getStepStatus = (
    step: SimulationStep,
  ): "completed" | "current" | "upcoming" => {
    const currentIndex = steps.findIndex((s) => s.key === currentStep);
    const stepIndex = steps.findIndex((s) => s.key === step);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  const getStepColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "bg-green-500 text-white";
      case "current":
        return "bg-blue-500 text-white";
      case "upcoming":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-gray-200 text-gray-600";
    }
  };

  return (
    <div
      className={`bg-white shadow-lg transition-all duration-300 ${isExpanded ? "w-64" : "w-16"}`}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full p-4 hover:bg-gray-100 transition-colors"
      >
        <svg
          className="w-6 h-6 mx-auto"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d={
              isExpanded
                ? "M11 19l-7-7 7-7m8 14l-7-7 7-7"
                : "M13 5l7 7-7 7M5 5l7 7-7 7"
            }
          />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4">
          {/* Progress Indicator */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">
              Progress
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${((steps.findIndex((s) => s.key === currentStep) + 1) / steps.length) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-600 mb-3">
              Process Steps
            </h3>
            {steps.map((step) => {
              const status = getStepStatus(step.key);
              const colorClass = getStepColor(status);

              return (
                <button
                  key={step.key}
                  onClick={() => onStepSelect?.(step.key)}
                  className={`w-full p-3 rounded-lg flex items-center space-x-3 transition-all duration-200 ${
                    status === "current" ? "ring-2 ring-blue-300" : ""
                  } ${onStepSelect ? "hover:opacity-80 cursor-pointer" : "cursor-default"}`}
                  style={{
                    backgroundColor: colorClass.includes("bg-")
                      ? undefined
                      : "#f3f4f6",
                  }}
                >
                  <span className="text-xl">{step.icon}</span>
                  <div className="flex-1 text-left">
                    <div
                      className={`font-medium ${colorClass.includes("text-") ? "" : "text-gray-700"}`}
                    >
                      {step.label}
                    </div>
                    {status === "completed" && (
                      <div className="text-xs opacity-75">✓ Completed</div>
                    )}
                    {status === "current" && (
                      <div className="text-xs opacity-75">In Progress</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Score Display */}
          {simulationState && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-600 mb-2">
                Score
              </h3>
              <div className="text-2xl font-bold text-blue-600">
                {simulationState.score}%
              </div>
            </div>
          )}

          {/* Errors Summary */}
          {simulationState && simulationState.errors.length > 0 && (
            <div className="mt-4 p-4 bg-red-50 rounded-lg">
              <h3 className="text-sm font-semibold text-red-600 mb-2">
                Errors
              </h3>
              <div className="text-sm text-red-700">
                {simulationState.errors.length} error(s) encountered
              </div>
            </div>
          )}

          {/* Completion Status */}
          {simulationState && simulationState.isCompleted && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <h3 className="text-sm font-semibold text-green-600 mb-1">
                Simulation Complete!
              </h3>
              <div className="text-sm text-green-700">
                Final score: {simulationState.score}%
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
