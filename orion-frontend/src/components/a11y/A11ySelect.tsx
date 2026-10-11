/**
 * A11ySelect - accessible select dropdown with proper ARIA attributes
 */
import React from 'react';

export interface A11ySelectProps {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  error?: string;
  help?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
}

export const A11ySelect: React.FC<A11ySelectProps> = ({
  label,
  id,
  value,
  onChange,
  options,
  error,
  help,
  placeholder,
  disabled,
  required,
  style,
}) => {
  const describedBy = [
    error ? `${id}-error` : null,
    help ? `${id}-help` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label htmlFor={id} style={{ fontWeight: 500, fontSize: 14 }}>
        {label}
        {required && (
          <span style={{ color: 'var(--color-error-500, #f5222d)', marginLeft: 4 }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          border: `1px solid ${error ? 'var(--color-error-500, #f5222d)' : 'var(--border-default, #d9d9d9)'}`,
          fontSize: 14,
          background: 'var(--bg-primary, #fff)',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <div id={`${id}-error`} style={{ color: 'var(--color-error-500, #f5222d)', fontSize: 12 }} role="alert">
          {error}
        </div>
      )}
      {help && (
        <div id={`${id}-help`} style={{ color: 'var(--text-tertiary, #8c8c8c)', fontSize: 12 }}>
          {help}
        </div>
      )}
    </div>
  );
};

export default A11ySelect;
