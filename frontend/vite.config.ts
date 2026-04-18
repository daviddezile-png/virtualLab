import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          simulation: ['./src/simulation/model/SimulationModel', './src/simulation/telemetry/TelemetryManager']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src',
      '@components': '/src/components',
      '@simulation': '/src/simulation',
      '@models': '/src/simulation/model',
      '@views': '/src/simulation/view',
      '@telemetry': '/src/simulation/telemetry'
    }
  }
})
