import React from "react";
import { SimulationStep, SimulationState } from "../simulation/model";

interface ProgressBarProps {
  currentStep: SimulationStep;
  simulationState?: SimulationState | null;
  stepProgress?: Record<SimulationStep, number>; // 0-100 for each step
  showLabels?: boolean;
  size?: "small" | "medium" | "large";
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  currentStep,
  simulationState,
  stepProgress = {},
  showLabels = true,
  size = "medium",
}) => {
  const steps = [
    { key: SimulationStep.SELECTION, label: "Selection", shortLabel: "Select" },
    { key: SimulationStep.HEATING, label: "Heating", shortLabel: "Heat" },
    {
      key: SimulationStep.EMULSIFICATION,
      label: "Emulsification",
      shortLabel: "Mix",
    },
    { key: SimulationStep.COOLING, label: "Cooling", shortLabel: "Cool" },
    { key: SimulationStep.EVALUATION, label: "Evaluation", shortLabel: "Eval" },
  ];

  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  const sizeClasses = {
    small: "h-2 text-xs",
    medium: "h-3 text-sm",
    large: "h-4 text-base",
  };

  const getStepStatus = (
    index: number,
  ): "completed" | "current" | "upcoming" => {
    if (index < currentIndex) return "completed";
    if (index === currentIndex) return "current";
    return "upcoming";
  };

  const getStepColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "current":
        return "bg-blue-500";
      case "upcoming":
        return "bg-gray-300";
      default:
        return "bg-gray-300";
    }
  };

  const getTextColor = (status: string): string => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "current":
        return "text-blue-600 font-semibold";
      case "upcoming":
        return "text-gray-500";
      default:
        return "text-gray-500";
    }
  };

  const overallProgress = ((currentIndex + 1) / steps.length) * 100;

  return (
    <div className="w-full">
      {/* Overall Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            Overall Progress
          </span>
          <span className="text-sm text-gray-600">
            {Math.round(overallProgress)}%
          </span>
        </div>
        <div className={`w-full bg-gray-200 rounded-full ${sizeClasses[size]}`}>
          <div
            className="bg-gradient-to-r from-blue-500 to-green-500 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${overallProgress}%` }}
          />
        </div>
      </div>

      {/* Step-by-Step Progress */}
      <div className="space-y-3">
        {showLabels && (
          <div className="text-sm font-medium text-gray-700">Step Details</div>
        )}

        <div className="space-y-2">
          {steps.map((step, index) => {
            const status = getStepStatus(index);
            const colorClass = getStepColor(status);
            const textClass = getTextColor(status);
            const progress =
              stepProgress[step.key] ||
              (status === "completed" ? 100 : status === "current" ? 50 : 0);

            return (
              <div key={step.key} className="flex items-center space-x-3">
                {/* Step Indicator */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                    status === "completed"
                      ? "bg-green-500 text-white"
                      : status === "current"
                        ? "bg-blue-500 text-white ring-2 ring-blue-300"
                        : "bg-gray-300 text-gray-600"
                  }`}
                >
                  {status === "completed" ? "✓" : index + 1}
                </div>

                {/* Step Progress Bar */}
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className={`text-sm ${textClass}`}>
                      {showLabels ? step.label : step.shortLabel}
                    </span>
                    {status === "current" && (
                      <span className="text-xs text-gray-500">{progress}%</span>
                    )}
                  </div>
                  <div
                    className={`w-full bg-gray-200 rounded-full ${size === "small" ? "h-1" : sizeClasses[size]}`}
                  >
                    <div
                      className={`${colorClass} h-full rounded-full transition-all duration-300 ease-out`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Step Highlight */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium text-blue-800">
            Current Step: {steps[currentIndex]?.label || "Unknown"}
          </span>
        </div>
      </div>
    </div>
  );
};
