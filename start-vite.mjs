import childProcess from 'node:child_process';
import { createRequire, syncBuiltinESMExports } from 'node:module';
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const viteCli = join(dirname(require.resolve('vite/package.json')), 'bin', 'vite.js');

// Vite 6 probes Windows network drives with `net use` on startup.
// Some managed Windows environments deny that child process and return EPERM.
const originalExec = childProcess.exec;
if (process.platform === 'win32') {
  childProcess.exec = function (command, ...args) {
    if (!/^\s*net\s+use(?:\s|$)/i.test(command)) return originalExec.call(this, command, ...args);
    const callback = args.findLast(value => typeof value === 'function');
    if (callback) queueMicrotask(() => callback(new Error('Windows network-drive probe skipped'), '', ''));
    return { on() { return this; }, kill() {} };
  };
  syncBuiltinESMExports();
}

await import(pathToFileURL(viteCli).href);
