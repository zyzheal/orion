/**
 * Pipeline Parameter Modal
 * Form for adding/editing individual pipeline parameters.
 *
 * Supported types: string, number, boolean, select, secret
 * Features: default value, required flag, description, validation regex, select options
 */

import React, { useEffect } from 'react';
import { Modal, Form, Input, Select, Switch, InputNumber, Button, Space, message } from 'antd';
import { colors, spacing, componentRadius } from '@/tokens';
import { PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { PipelineParameter } from '@/api/pipelines';

const { TextArea } = Input;

interface PipelineParamModalProps {
  visible: boolean;
  param?: PipelineParameter | null; // null = add mode, defined = edit mode
  onSave: (param: PipelineParameter) => void;
  onCancel: () => void;
}

const PARAM_TYPES = [
  { label: '字符串 (String)', value: 'string' },
  { label: '数字 (Number)', value: 'number' },
  { label: '布尔值 (Boolean)', value: 'boolean' },
  { label: '枚举选择 (Select)', value: 'select' },
  { label: '密钥 (Secret)', value: 'secret' },
] as const;

const PipelineParamModal: React.FC<PipelineParamModalProps> = ({
  visible,
  param,
  onSave,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const paramType = Form.useWatch('type', form) || 'string';

  // Reset or populate form when modal opens/changes
  useEffect(() => {
    if (visible) {
      if (param) {
        // Edit mode: populate form
        form.setFieldsValue({
          name: param.name,
          type: param.type,
          defaultValue: param.defaultValue,
          required: param.required,
          description: param.description || '',
          validationRegex: param.validationRegex || '',
          options: param.options || [],
        });
      } else {
        // Add mode: reset form
        form.resetFields();
        form.setFieldsValue({
          type: 'string',
          required: false,
          options: [],
        });
      }
    }
  }, [visible, param, form]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();

      // Validate select type has options
      if (values.type === 'select' && (!values.options || values.options.length === 0)) {
        message.error('枚举类型必须至少配置一个选项');
        return;
      }

      // Validate regex format
      if (values.validationRegex) {
        try {
          new RegExp(values.validationRegex);
        } catch {
          message.error('正则表达式格式无效');
          return;
        }
      }

      const result: PipelineParameter = {
        name: values.name.trim(),
        type: values.type,
        required: values.required || false,
        defaultValue: values.defaultValue || '',
        description: values.description?.trim() || undefined,
        validationRegex: values.validationRegex?.trim() || undefined,
        options: values.type === 'select' ? values.options : undefined,
      };

      onSave(result);
      form.resetFields();
    } catch {
      // Validation failed - Ant Design will show errors
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onCancel();
  };

  return (
    <Modal
      title={
        <span style={{ fontWeight: 600 }}>
          {param ? '编辑参数' : '添加参数'}
        </span>
      }
      open={visible}
      onOk={handleOk}
      onCancel={handleCancel}
      okText="保存"
      cancelText="取消"
      width={560}
      destroyOnClose
      styles={{
        body: { padding: `${spacing.lg}px ${spacing.xl}px` },
      }}
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        style={{ marginTop: spacing.md }}
      >
        {/* Parameter Name */}
        <Form.Item
          label="参数名称"
          name="name"
          rules={[
            { required: true, message: '请输入参数名称' },
            { pattern: /^[a-zA-Z_][a-zA-Z0-9_.]*$/, message: '名称须以字母/下划线开头，可含字母、数字、下划线、点' },
          ]}
          extra="如: build.env, image.tag, deploy.enabled"
        >
          <Input
            placeholder="输入参数名称"
            disabled={!!param} // Can't rename existing parameters
            style={{ borderRadius: componentRadius.input }}
          />
        </Form.Item>

        {/* Parameter Type */}
        <Form.Item
          label="参数类型"
          name="type"
          rules={[{ required: true, message: '请选择参数类型' }]}
        >
          <Select
            placeholder="选择类型"
            options={PARAM_TYPES.map(t => ({ label: t.label, value: t.value }))}
            style={{ borderRadius: componentRadius.input }}
          />
        </Form.Item>

        {/* Default Value */}
        <Form.Item
          label="默认值"
          name="defaultValue"
          rules={[{ required: true, message: '请输入默认值' }]}
          extra="参数未显式指定时使用的值"
        >
          {paramType === 'boolean' ? (
            <Select
              placeholder="选择默认值"
              options={[
                { label: 'true', value: 'true' },
                { label: 'false', value: 'false' },
              ]}
              style={{ borderRadius: componentRadius.input }}
            />
          ) : paramType === 'number' ? (
            <InputNumber
              placeholder="输入默认数值"
              style={{ width: '100%', borderRadius: componentRadius.input }}
            />
          ) : paramType === 'secret' ? (
            <Input.Password
              placeholder="输入密钥值（将被加密存储）"
              style={{ borderRadius: componentRadius.input }}
            />
          ) : (
            <Input
              placeholder="输入默认值"
              style={{ borderRadius: componentRadius.input }}
            />
          )}
        </Form.Item>

        {/* Select Options (only for select type) */}
        {paramType === 'select' && (
          <Form.Item
            label="枚举选项"
            name="options"
            rules={[{ required: true, message: '请至少添加一个选项' }]}
            extra="用户只能从以下选项中选择一个值"
          >
            <Select
              mode="tags"
              placeholder="输入选项后按回车添加"
              style={{ borderRadius: componentRadius.input }}
              tokenSeparators={[',']}
            />
          </Form.Item>
        )}

        {/* Required Flag + Validation Regex row */}
        <Space size="large" style={{ width: '100%' }}>
          <Form.Item
            label="必填"
            name="required"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            label="校验正则"
            name="validationRegex"
            style={{ flex: 1, marginBottom: 0 }}
            extra="可选：用于运行时验证参数值格式"
          >
            <Input
              placeholder="如: ^[a-z0-9-]+$"
              style={{ borderRadius: componentRadius.input }}
            />
          </Form.Item>
        </Space>

        {/* Description */}
        <Form.Item
          label="描述"
          name="description"
        >
          <TextArea
            rows={2}
            placeholder="参数用途说明（可选）"
            style={{ borderRadius: componentRadius.input }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default PipelineParamModal;
