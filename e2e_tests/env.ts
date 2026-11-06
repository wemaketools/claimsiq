/** The trimmed value of an environment variable; empty or whitespace counts as unset. Every env read goes through it. */
export function envValue(name: string): string | undefined {
  const raw = process.env[name]?.trim();
  return raw === undefined || raw === '' ? undefined : raw;
}
