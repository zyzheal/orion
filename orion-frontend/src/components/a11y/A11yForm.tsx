/**
 * A11yForm - accessible form wrapper with auto id generation
 */
import React, { useRef } from 'react';

export interface A11yFormProps {
  children: React.ReactNode;
  onSubmit?: (e: React.FormEvent) => void;
  ariaLabel: string;
  style?: React.CSSProperties;
}

export const A11yForm: React.FC<A11yFormProps> = ({ children, onSubmit, ariaLabel, style }) => {
  const idCounter = useRef(0);

  return (
    <form
      aria-label={ariaLabel}
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: 16, ...style }}
    >
      {children}
    </form>
  );
};

/**
 * Generate a unique id prefix for form fields.
 */
export function useIdPrefix(prefix = 'field') {
  const counter = React.useRef(0);
  return () => {
    counter.current += 1;
    return `${prefix}-${counter.current}`;
  };
}

export default A11yForm;
