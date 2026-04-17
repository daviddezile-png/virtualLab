# Virtual Vanishing Cream Simulation - Frontend

A modern React-based frontend for the Virtual Vanishing Cream Chemistry Simulation, built with TypeScript, Vite, and Tailwind CSS.

## Features

- **Interactive Simulation**: 5-step vanishing cream formulation process
- **Real-time Visualization**: SceneryStack-based beaker and thermometer components
- **Telemetry Integration**: Comprehensive error tracking and performance metrics
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Modern Stack**: React 18, TypeScript, Vite for fast development

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React UI components
│   │   ├── Sidebar.tsx     # Navigation and step tracking
│   │   ├── ProgressBar.tsx # Progress visualization
│   │   ├── Popups.tsx      # Error and completion dialogs
│   │   └── index.ts        # Component exports
│   ├── simulation/         # Core simulation logic
│   │   ├── model/          # Data models and business logic
│   │   │   ├── types.ts           # TypeScript interfaces
│   │   │   ├── AxonProperties.ts  # Temperature tracking
│   │   │   ├── SimulationModel.ts  # Main simulation controller
│   │   │   └── index.ts           # Model exports
│   │   ├── view/           # Visual components (SceneryStack)
│   │   │   ├── BeakerNode.ts       # Beaker visualization
│   │   │   ├── ThermometerNode.ts  # Temperature display
│   │   │   └── index.ts           # View exports
│   │   ├── telemetry/      # Logging and analytics
│   │   │   ├── TelemetryManager.ts # Event tracking
│   │   │   └── index.ts           # Telemetry exports
│   │   └── example-usage.ts # Demonstration code
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   ├── index.css           # Global styles
│   └── tailwind.config.js  # Tailwind configuration
├── public/                 # Static assets
├── package.json           # Dependencies and scripts
├── vite.config.ts         # Vite configuration
├── tsconfig.json          # TypeScript configuration
└── README.md              # This file
```

## Getting Started

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint issues automatically

## Simulation Features

### 5-Step Process

1. **Selection** - Choose ingredients for vanishing cream formulation
2. **Heating** - Heat mixture to target temperature with real-time monitoring
3. **Emulsification** - Mix phases with temperature validation (≤5°C difference)
4. **Cooling** - Controlled cooling process
5. **Evaluation** - Final product quality assessment

### Key Components

- **AxonProperties**: Temperature tracking with history and constraint enforcement
- **TelemetryManager**: Automatic error logging to backend API
- **BeakerNode**: Interactive beaker with liquid simulation and temperature-based visuals
- **ThermometerNode**: Real-time temperature display with target indicators

### UI Components

- **Sidebar**: Step navigation, progress tracking, and score display
- **ProgressBar**: Visual progress indicators for overall and step completion
- **Popups**: Contextual dialogs for errors, completion, and help

## Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
VITE_API_BASE_URL=http://localhost:3001
VITE_SIMULATION_CONFIG={"maxErrors":10,"timeLimits":{"selection":300,"heating":600,"emulsification":450,"cooling":400,"evaluation":300}}
```

### Tailwind CSS

The project uses Tailwind CSS with custom configuration in `tailwind.config.js`. Custom utilities and components are defined in `src/index.css`.

## API Integration

The frontend communicates with the backend API for:

- **Authentication**: Student login and session management
- **Telemetry**: Real-time error logging and performance tracking
- **Reports**: Student and class performance analytics

### API Endpoints

- `POST /api/auth/login` - Student authentication
- `POST /api/auth/session` - Create simulation session
- `POST /api/log` - Log telemetry events
- `GET /api/reports/student/:id` - Student performance report

## Development Notes

### TypeScript Configuration

- Strict mode enabled for type safety
- Path aliases configured for clean imports (`@/components`, `@/simulation`, etc.)
- JSX support with React 18

### Mock Implementations

The current implementation includes mock SceneryStack components for development. These can be replaced with actual SceneryStack library imports when available.

### Performance Optimizations

- Code splitting for vendor and simulation chunks
- Lazy loading of heavy components
- Optimized bundle configuration in Vite

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Contributing

1. Follow the existing code style and TypeScript conventions
2. Use meaningful commit messages
3. Test thoroughly before submitting changes
4. Update documentation as needed

## License

MIT License - see LICENSE file for details
