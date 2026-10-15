import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

process.env.ESBUILD_BINARY_PATH = join(dirname(fileURLToPath(import.meta.url)), 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');

// Vite 6 probes Windows network drives with `net use` on startup.
// Some managed Windows environments deny that child process and return EPERM.
const originalExec = childProcess.exec;
childProcess.exec = (command, callback) => {
  if (typeof callback === 'function') {
    queueMicrotask(() => callback(new Error('Windows network-drive probe skipped'), '', ''));
  }
  return { on() { return this; }, kill() {} };
};

await import('./node_modules/vite/bin/vite.js');

childProcess.exec = originalExec;
