import React from "react";

interface ApparatusDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  apparatusType: string;
  apparatusName: string;
  currentData?: any;
}

const ApparatusDetailModal: React.FC<ApparatusDetailModalProps> = ({
  isOpen,
  onClose,
  apparatusType,
  apparatusName,
  currentData,
}) => {
  if (!isOpen) return null;

  const renderApparatusContent = () => {
    switch (apparatusType) {
      case "beaker":
        return (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Beaker Status
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Current Volume:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.volume || "0"} ml
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Temperature:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.temperature || "25"}°C
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Contents:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.contents || "Empty"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">pH Level:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.ph || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                Visual Analysis
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                  <span>Color: {currentData?.color || "Clear"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                  <span>Clarity: {currentData?.clarity || "Clear"}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                  <span>Phase: {currentData?.phase || "Liquid"}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-50 p-4 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">
                Actions Available
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <button className="px-3 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-sm">
                  Heat
                </button>
                <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                  Cool
                </button>
                <button className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm">
                  Stir
                </button>
                <button className="px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm">
                  Measure
                </button>
              </div>
            </div>
          </div>
        );

      case "thermometer":
        return (
          <div className="space-y-6">
            <div className="bg-red-50 p-4 rounded-lg">
              <h3 className="font-semibold text-red-900 mb-2">
                Temperature Reading
              </h3>
              <div className="text-center">
                <div className="text-4xl font-bold text-red-600">
                  {currentData?.temperature || "25"}°C
                </div>
                <div className="text-sm text-gray-600 mt-2">
                  {currentData?.fahrenheit
                    ? `${currentData.fahrenheit}°F`
                    : "77°F"}
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                Temperature History
              </h3>
              <div className="space-y-2 text-sm">
                {currentData?.history
                  ?.slice(-5)
                  .map((temp: any, index: number) => (
                    <div key={index} className="flex justify-between">
                      <span>{temp.time}</span>
                      <span className="font-semibold">{temp.value}°C</span>
                    </div>
                  )) || (
                  <div className="text-gray-500">No history available</div>
                )}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Calibration</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Last Calibration:</span>
                  <span className="font-semibold">
                    {currentData?.lastCalibration || "Never"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Accuracy:</span>
                  <span className="font-semibold">±0.1°C</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "hotplate":
        return (
          <div className="space-y-6">
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900 mb-2">
                Hot Plate Status
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`ml-2 font-semibold ${currentData?.isOn ? "text-red-600" : "text-gray-600"}`}
                  >
                    {currentData?.isOn ? "ON" : "OFF"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Set Temperature:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.setTemp || "75"}°C
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Current Temp:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.currentTemp || "25"}°C
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Stirring Speed:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.stirSpeed || "0"} rpm
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Controls</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Temperature Control
                  </label>
                  <input
                    type="range"
                    min="25"
                    max="100"
                    value={currentData?.setTemp || 75}
                    className="w-full"
                    readOnly
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>25°C</span>
                    <span>100°C</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Stirring Speed
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1000"
                    value={currentData?.stirSpeed || 0}
                    className="w-full"
                    readOnly
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0 rpm</span>
                    <span>1000 rpm</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900 mb-2">
                Safety Features
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Auto-shutoff at 110°C</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Overheat protection</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span>Stirring safety lock</span>
                </div>
              </div>
            </div>
          </div>
        );

      case "table":
        return (
          <div className="space-y-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">Table Status</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Material:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.material || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Surface:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.surface || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Dimensions:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.dimensions
                      ? `${currentData.dimensions.length}×${currentData.dimensions.width}×${currentData.dimensions.height}mm`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Cleanliness:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.cleanliness || "Unknown"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Table Features
              </h3>
              <div className="space-y-2 text-sm">
                {currentData?.features?.map(
                  (feature: string, index: number) => (
                    <div key={index} className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                      <span className="font-medium">{feature}</span>
                    </div>
                  ),
                ) || (
                  <span className="text-gray-500">No features available</span>
                )}
              </div>
            </div>

            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">
                Table Controls
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <button className="px-3 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors">
                  Adjust Height
                </button>
                <button className="px-3 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors">
                  Open Drawer
                </button>
                <button className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                  Clean Surface
                </button>
                <button className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors">
                  Sanitize
                </button>
              </div>
            </div>
          </div>
        );

      case "microscope":
        return (
          <div className="space-y-6">
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900 mb-2">
                Microscope View
              </h3>
              <div className="bg-black rounded-lg h-48 flex items-center justify-center">
                <div className="text-white text-center">
                  <svg
                    className="w-16 h-16 mx-auto mb-2"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path
                      fillRule="evenodd"
                      d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <p className="text-sm">Microscopic View</p>
                  <p className="text-xs opacity-75">400x Magnification</p>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">
                Analysis Results
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Sample Type:</span>
                  <span className="font-semibold">
                    {currentData?.sampleType || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Particle Size:</span>
                  <span className="font-semibold">
                    {currentData?.particleSize || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Phase Structure:</span>
                  <span className="font-semibold">
                    {currentData?.phaseStructure || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Emulsion Quality:</span>
                  <span className="font-semibold">
                    {currentData?.emulsionQuality || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                Microscope Settings
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Magnification:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.magnification || "400x"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Light Intensity:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.lightIntensity || "75%"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Focus:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.focus || "Auto"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Filter:</span>
                  <span className="ml-2 font-semibold">
                    {currentData?.filter || "None"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-gray-600">
              No detailed information available for {apparatusName}.
            </p>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">{apparatusName}</h2>
              <p className="text-indigo-100 mt-1">Detailed Analysis View</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-indigo-200 transition-colors"
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
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {renderApparatusContent()}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Last updated: {new Date().toLocaleTimeString()}
            </div>
            <div className="space-x-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors text-sm"
              >
                Close
              </button>
              <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm">
                Export Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApparatusDetailModal;
