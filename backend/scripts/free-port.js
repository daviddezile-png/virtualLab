#!/usr/bin/env node
// Cross-platform "free the port" helper.
// Kills whatever process is listening on the given port (default 3543)
// on Windows, macOS and Linux, then exits 0 regardless — it's best-effort.
const { execSync } = require('child_process');

const port = process.argv[2] || process.env.PORT || '3543';
const isWin = process.platform === 'win32';

function run(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString();
}

try {
  if (isWin) {
    // Find PIDs listening on the port, then taskkill each.
    const out = run(`netstat -ano -p tcp`);
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      // e.g.  TCP    0.0.0.0:3543   0.0.0.0:0   LISTENING   12345
      const m = line.match(new RegExp(`[:.]${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)`));
      if (m) pids.add(m[1]);
    }
    for (const pid of pids) {
      try { run(`taskkill /PID ${pid} /F`); } catch (_) { /* already gone */ }
    }
  } else {
    run(`lsof -ti:${port} | xargs kill -9`);
  }
} catch (_) {
  // Nothing was listening, or the tool is unavailable — that's fine.
}
