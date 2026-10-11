/**
 * A11yInput - accessible input with aria-describedby and aria-invalid
 */
import React from 'react';

export interface A11yInputProps {
  label: string;
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  help?: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'search';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  style?: React.CSSProperties;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
}

export const A11yInput: React.FC<A11yInputProps> = ({
  label,
  id,
  value,
  onChange,
  error,
  help,
  type = 'text',
  placeholder,
  disabled,
  required,
  autoComplete,
  style,
  inputProps,
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
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error || undefined}
        aria-describedby={describedBy || undefined}
        placeholder={placeholder}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          border: `1px solid ${error ? 'var(--color-error-500, #f5222d)' : 'var(--border-default, #d9d9d9)'}`,
          outline: 'none',
          fontSize: 14,
          ...inputProps?.style,
        }}
        onFocus={(e) => {
          if (!error) {
            e.currentTarget.style.borderColor = 'var(--color-primary-500, #3370E6)';
          }
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error
            ? 'var(--color-error-500, #f5222d)'
            : 'var(--border-default, #d9d9d9)';
        }}
        {...inputProps}
      />
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

export default A11yInput;
