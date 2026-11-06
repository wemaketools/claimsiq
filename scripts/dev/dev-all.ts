/**
 * `bun run dev`: the API server (`dev:api`) and the SPA (`dev:ui`) together, each with its output on this terminal.
 * Ctrl+C, or either one stopping, stops both.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const commands = [
  ['api', ['run', 'dev:api']],
  ['ui', ['run', 'dev:ui']],
] as const;

// Each command runs in its own process group: `bun run` does not pass a signal on to the server it started, so the
// whole group is signalled (and Ctrl+C reaches the groups through the handlers below, not the terminal).
const children: ChildProcess[] = commands.map(([, args]) => spawn(process.execPath, [...args], { stdio: 'inherit', detached: true }));
let stopping = false;

function stopAll(code: number): void {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid !== undefined) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {
        // The group already ended.
      }
    }
  }
  process.exitCode = code;
}

children.forEach((child, index) => {
  child.once('exit', (code) => {
    if (!stopping) process.stderr.write(`dev: ${commands[index]?.[0] ?? 'process'} stopped, stopping the rest.\n`);
    stopAll(code ?? 0);
  });
});
process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));
