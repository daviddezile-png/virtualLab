import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import os from 'node:os'

// Prints a clear "open on your network" banner with the machine's current LAN
// address — and re-prints automatically if the IP changes while the server runs
// (e.g. Wi‑Fi reconnect / DHCP renewal), so the link is always easy to grab.
function lanUrlBanner(): Plugin {
  let lastKey = ''
  let timer: ReturnType<typeof setInterval> | undefined

  const lanUrls = (port: number): string[] => {
    const urls: string[] = []
    for (const list of Object.values(os.networkInterfaces())) {
      for (const net of list ?? []) {
        const isV4 = net.family === 'IPv4' || (net.family as unknown as number) === 4
        if (isV4 && !net.internal) urls.push(`http://${net.address}:${port}`)
      }
    }
    return urls
  }

  return {
    name: 'lan-url-banner',
    apply: 'serve',
    configureServer(server) {
      const start = () => {
        const addr = server.httpServer?.address()
        const port = addr && typeof addr === 'object' ? addr.port : 3002
        const print = () => {
          const urls = lanUrls(port)
          const key = urls.join('|')
          if (!urls.length || key === lastKey) return
          lastKey = key
          const line = '═'.repeat(54)
          server.config.logger.info(
            `\n\x1b[36m${line}\n` +
            `  📱  Open the Virtual Lab on this network:\n` +
            urls.map(u => `       ➜  \x1b[1m${u}\x1b[0m\x1b[36m`).join('\n') +
            `\n${line}\x1b[0m\n`,
          )
        }
        setTimeout(print, 300)          // appear just below Vite's own URLs
        timer = setInterval(print, 10000) // auto re-print if the IP changes
      }
      server.httpServer?.once('listening', start)
      server.httpServer?.once('close', () => { if (timer) clearInterval(timer) })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), lanUrlBanner()],
  server: {
    port: 3002,
    host: true,        // listen on 0.0.0.0 so other devices on the LAN can reach it
    proxy: {
      '/api': {
        target: 'http://localhost:3543',
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
