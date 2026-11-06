/**
 * `bun run dev`: the API server (`dev:api`) and the SPA (`dev:ui`) together, each with its output on this terminal.
 * Ctrl+C, or either one stopping, stops both.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';

const commands = [
  ['api', ['run', 'dev:api']],
  ['ui', ['run', 'dev:ui']],
] as const;

const onWindows = process.platform === 'win32';

// `bun run` does not pass a signal on to the server it started, so the whole tree is stopped: on POSIX each command
// runs in its own process group, which is signalled as one (so Ctrl+C reaches it through the handlers below, not the
// terminal); on Windows `taskkill /T` ends the tree.
const children: ChildProcess[] = commands.map(([, args]) =>
  spawn(process.execPath, [...args], { stdio: 'inherit', detached: !onWindows }),
);
let stopping = false;

function stopTree(child: ChildProcess): void {
  if (child.pid === undefined) return;
  if (onWindows) {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    // The group already ended.
  }
}

function stopAll(code: number): void {
  if (stopping) return;
  stopping = true;
  children.forEach(stopTree);
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
