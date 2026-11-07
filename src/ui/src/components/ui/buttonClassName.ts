/** Class names of the `.ciq-btn` variants, shared by Button, ButtonLink and other button-styled elements. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'danger-soft' | 'ghost' | 'link';

export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: 'md' | 'sm' = 'md',
  block = false,
  extra?: string,
): string {
  const classes = ['ciq-btn'];
  if (variant !== 'secondary') {
    classes.push(`ciq-btn--${variant}`);
  }
  if (size === 'sm') {
    classes.push('ciq-btn--sm');
  }
  if (block) {
    classes.push('ciq-btn--block');
  }
  if (extra !== undefined) {
    classes.push(extra);
  }
  return classes.join(' ');
}
