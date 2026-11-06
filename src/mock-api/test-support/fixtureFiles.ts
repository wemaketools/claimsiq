/** Reads the committed CSV fixtures from disk, for tests. The SPA bundles the same files with Vite instead. */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { FixtureFiles } from '../fixtures/index.js';

const FIXTURE_ROOT = fileURLToPath(new URL('../../../fixtures/v1/', import.meta.url));

export function readFixtureFiles(folder: 'test' | 'demo'): FixtureFiles {
  const dir = `${FIXTURE_ROOT}${folder}/`;
  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => name.endsWith('.csv'))
      .map((name) => [name, readFileSync(`${dir}${name}`, 'utf8')]),
  );
}

export function readFixtureJson(name: string): unknown {
  return JSON.parse(readFileSync(`${FIXTURE_ROOT}${name}`, 'utf8')) as unknown;
}

/** The files with one of them replaced by `change(text)`. */
export function withEdit(files: FixtureFiles, file: string, change: (text: string) => string): FixtureFiles {
  return { ...files, [file]: change(files[file] ?? '') };
}
