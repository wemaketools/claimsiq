/** One directive of a Content-Security-Policy ("script-src 'self'"), or undefined when the policy has none. */
export function directiveOf(policy: string, name: string): string | undefined {
  return policy
    .split(';')
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith(`${name} `));
}
