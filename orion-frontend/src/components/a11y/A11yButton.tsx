/**
 * A11yButton - accessible button component
 * Supports native button and div with role="button" patterns.
 */
import React from 'react';
import { colors } from '@/tokens/colors';

export interface A11yButtonProps {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent | React.KeyboardEvent) => void;
  /** aria-label for screen readers */
  ariaLabel: string;
  /** Use native <button> instead of <div role="button"> */
  asButton?: boolean;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  ariaPressed?: boolean;
  ariaExpanded?: boolean;
}

export const A11yButton: React.FC<A11yButtonProps> = ({
  children,
  onClick,
  ariaLabel,
  asButton = false,
  disabled = false,
  style,
  className,
  ariaPressed,
  ariaExpanded,
}) => {
  const handleInteraction = (
    e: React.MouseEvent | React.KeyboardEvent,
  ) => {
    if (disabled) return;
    if (e instanceof KeyboardEvent) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
    }
    onClick(e);
  };

  const sharedProps = {
    'aria-label': ariaLabel,
    'aria-pressed': ariaPressed,
    'aria-expanded': ariaExpanded,
    disabled,
    style: {
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : undefined,
      ...style,
    },
  };

  if (asButton) {
    return (
      <button
        type="button"
        className={className}
        {...sharedProps}
        onClick={handleInteraction as React.MouseEventHandler<HTMLButtonElement>}
      >
        {children}
      </button>
    );
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      className={className}
      {...sharedProps}
      onClick={handleInteraction}
      onKeyDown={handleInteraction}
    >
      {children}
    </div>
  );
};

export default A11yButton;
