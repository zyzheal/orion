/**
 * Enhanced Form Component
 * - Dynamic field generation from schema
 * - Validation (required, pattern, custom)
 * - Submit handling
 *
 * Wraps Ant Design Form with schema-driven configuration.
 */
import React, { useCallback } from 'react';
import {
  Form as AntForm,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Switch,
  Button,
  Space,
} from 'antd';
import type { FormInstance, Rule } from 'antd/es/form';

// ============================================================================
// Types
// ============================================================================

export type FieldType =
  | 'text'
  | 'password'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'switch'
  | 'custom';

export interface FormField {
  /** Unique field name */
  name: string;
  /** Display label */
  label: string;
  /** Field type */
  type: FieldType;
  /** Whether the field is required */
  required?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Validation rules (in addition to required) */
  rules?: Rule[];
  /** Options for select type */
  options?: Array<{ label: string; value: string | number }>;
  /** Custom validation function */
  validate?: (value: unknown) => string | undefined;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is hidden */
  hidden?: boolean;
  /** Additional props passed to the input component */
  inputProps?: Record<string, unknown>;
  /** Custom render function for 'custom' type */
  render?: (form: FormInstance) => React.ReactNode;
  /** Initial value for this field */
  initialValue?: unknown;
  /** Help text */
  help?: string;
  /** Extra text below the field */
  extra?: string;
}

export interface OrionFormProps {
  /** Field definitions */
  fields: FormField[];
  /** Initial form values */
  initialValues?: Record<string, unknown>;
  /** Submit handler */
  onSubmit: (values: Record<string, unknown>) => void | Promise<void>;
  /** Submit button text */
  submitText?: string;
  /** Cancel button text (shows cancel button) */
  cancelText?: string;
  /** Cancel handler */
  onCancel?: () => void;
  /** Form instance from Ant Design */
  form?: FormInstance;
  /** Loading state for submit button */
  submitting?: boolean;
  /** Layout: 'horizontal' | 'vertical' | 'inline' */
  layout?: 'horizontal' | 'vertical' | 'inline';
  /** Label width (for horizontal layout) */
  labelWidth?: number | string;
  /** Whether to show submit button */
  showSubmit?: boolean;
  /** Additional form props */
  formProps?: Record<string, unknown>;
  /** Size of form controls */
  size?: 'small' | 'middle' | 'large';
}

// ============================================================================
// Helper: Build validation rules
// ============================================================================

function buildRules(field: FormField): Rule[] {
  const rules: Rule[] = [...(field.rules || [])];

  if (field.required) {
    rules.unshift({
      required: true,
      message: `${field.label} is required`,
    });
  }

  if (field.validate) {
    rules.push({
      validator: async (_rule: Rule, value: unknown) => {
        const error = field.validate!(value);
        if (error) {
          return Promise.reject(new Error(error));
        }
        return Promise.resolve();
      },
    });
  }

  return rules;
}

// ============================================================================
// Helper: Render field input
// ============================================================================

function renderField(field: FormField, form: FormInstance): React.ReactNode {
  const commonProps = {
    placeholder: field.placeholder || `Please enter ${field.label.toLowerCase()}`,
    disabled: field.disabled,
    size: undefined as 'small' | 'middle' | 'large' | undefined,
    ...field.inputProps,
  };

  switch (field.type) {
    case 'text':
      return <Input {...commonProps} />;
    case 'password':
      return <Input.Password {...commonProps} />;
    case 'textarea':
      return <Input.TextArea {...commonProps} rows={4} />;
    case 'number':
      return <InputNumber {...commonProps} style={{ width: '100%' }} />;
    case 'select':
      return (
        <Select
          {...commonProps}
          options={field.options}
          allowClear
          placeholder={commonProps.placeholder}
        />
      );
    case 'date':
      return <DatePicker {...commonProps} style={{ width: '100%' }} />;
    case 'switch':
      return <Switch disabled={field.disabled} {...field.inputProps} />;
    case 'custom':
      return field.render?.(form);
    default:
      return <Input {...commonProps} />;
  }
}

// ============================================================================
// Component
// ============================================================================

function OrionForm({
  fields,
  initialValues = {},
  onSubmit,
  submitText = 'Submit',
  cancelText,
  onCancel,
  form: externalForm,
  submitting = false,
  layout = 'vertical',
  labelWidth,
  showSubmit = true,
  formProps = {},
  size = 'middle',
}: OrionFormProps) {
  const [form] = AntForm.useForm();
  const activeForm = externalForm || form;

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      await onSubmit(values);
    },
    [onSubmit]
  );

  const handleCancel = useCallback(() => {
    activeForm.resetFields();
    onCancel?.();
  }, [activeForm, onCancel]);

  const labelCol = labelWidth ? { style: { width: labelWidth } } : undefined;

  return (
    <AntForm
      form={activeForm}
      layout={layout}
      initialValues={initialValues}
      onFinish={handleSubmit}
      labelCol={labelCol}
      size={size}
      {...formProps}
      data-testid="orion-form"
    >
      {fields
        .filter((f) => !f.hidden)
        .map((field) => (
          <AntForm.Item
            key={field.name}
            name={field.name}
            label={field.label}
            rules={buildRules(field)}
            initialValue={field.initialValue}
            help={field.help}
            extra={field.extra}
            valuePropName={field.type === 'switch' ? 'checked' : 'value'}
          >
            {renderField(field, activeForm)}
          </AntForm.Item>
        ))}

      {showSubmit && (
        <AntForm.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={submitting} aria-busy={submitting || undefined}>
              {submitText}
            </Button>
            {cancelText && onCancel && (
              <Button onClick={handleCancel} disabled={submitting}>
                {cancelText}
              </Button>
            )}
          </Space>
        </AntForm.Item>
      )}
    </AntForm>
  );
}

export default OrionForm;
