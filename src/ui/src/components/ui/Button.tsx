/**
 * Buttons (`.ciq-btn` variants) and icon buttons (`.ciq-icon-btn`). Accent primary for the one main action;
 * `danger-soft` for repeated row-level destructive actions. `loading` disables the button while its request is in
 * flight and announces the busy state.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import type { LinkProps } from 'react-router';

import { buttonClassName } from './buttonClassName';
import type { ButtonVariant } from './buttonClassName';
import { Icon } from './Icon';
import type { IconName } from './Icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm';
  readonly icon?: IconName;
  readonly iconAfter?: IconName;
  /** Shows a spinner and disables the button. */
  readonly loading?: boolean;
  readonly block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon,
    iconAfter,
    loading = false,
    block = false,
    className,
    disabled,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClassName(variant, size, block, className)}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span className="ciq-btn-spinner" aria-hidden="true" />
      ) : (
        icon && <Icon name={icon} />
      )}
      {children}
      {iconAfter && !loading && <Icon name={iconAfter} />}
    </button>
  );
});

export interface ButtonLinkProps extends LinkProps {
  readonly variant?: ButtonVariant;
  readonly size?: 'md' | 'sm';
  readonly icon?: IconName;
  readonly iconAfter?: IconName;
}

/** A navigation link styled as a button. */
export function ButtonLink({
  variant = 'secondary',
  size = 'md',
  icon,
  iconAfter,
  className,
  children,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link className={buttonClassName(variant, size, false, className)} {...rest}>
      {icon && <Icon name={icon} />}
      {children as ReactNode}
      {iconAfter && <Icon name={iconAfter} />}
    </Link>
  );
}

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  readonly icon: IconName;
  /** Required accessible name (also the tooltip). */
  readonly label: string;
  /** Count badge (`.ciq-count`); hidden when null or zero. */
  readonly count?: number | null;
  readonly countTone?: 'danger' | 'muted';
  readonly variant?: 'default' | 'ghost';
  readonly size?: 'md' | 'sm';
}

function countText(count: number): string {
  return count > 99 ? '99+' : String(count);
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  {
    icon,
    label,
    count,
    countTone = 'danger',
    variant = 'default',
    size = 'md',
    className,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = ['ciq-icon-btn'];
  if (variant === 'ghost') classes.push('ciq-icon-btn--ghost');
  if (size === 'sm') classes.push('ciq-icon-btn--sm');
  if (className !== undefined) classes.push(className);
  return (
    <button
      ref={ref}
      type={type}
      className={classes.join(' ')}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
      {count !== undefined && count !== null && count > 0 && (
        <span
          className={countTone === 'muted' ? 'ciq-count ciq-count--muted' : 'ciq-count'}
          aria-hidden="true"
        >
          {countText(count)}
        </span>
      )}
    </button>
  );
});

export interface IconLinkProps extends Omit<LinkProps, 'children'> {
  readonly icon: IconName;
  readonly label: string;
  readonly count?: number | null;
}

/** An icon button that navigates (top bar bell, help). The count is part of the accessible name. */
export function IconLink({ icon, label, count, className, ...rest }: IconLinkProps) {
  const hasCount = count !== undefined && count !== null && count > 0;
  return (
    <Link
      className={className === undefined ? 'ciq-icon-btn' : `ciq-icon-btn ${className}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} />
      {hasCount && (
        <span className="ciq-count" aria-hidden="true">
          {countText(count)}
        </span>
      )}
    </Link>
  );
}
