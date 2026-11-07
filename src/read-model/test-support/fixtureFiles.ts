/** The fixture files with one of them replaced by `change(text)`, for tests that need a broken file. */
import type { FixtureFiles } from '../fixtures/index.js';

export function withEdit(files: FixtureFiles, file: string, change: (text: string) => string): FixtureFiles {
  return { ...files, [file]: change(files[file] ?? '') };
}
