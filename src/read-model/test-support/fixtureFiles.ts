/** The fixture readers of the server (tests read the same files the seed does), and an edit helper for tests that need a broken file. */
import type { FixtureFiles } from '../fixtures/index.js';

export { readFixtureFiles, readFixtureJson } from '../../server/lib/seed/fixtureFiles.js';

/** The files with one of them replaced by `change(text)`. */
export function withEdit(files: FixtureFiles, file: string, change: (text: string) => string): FixtureFiles {
  return { ...files, [file]: change(files[file] ?? '') };
}
