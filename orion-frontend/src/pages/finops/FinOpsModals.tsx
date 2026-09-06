/**
 * FinOps 页面的弹窗组件集合
 *
 * 目前仅包含预算创建/编辑弹窗。后续新增弹窗（如成本预测参数弹窗）
 * 也应集中于此文件，避免主页面继续膨胀。
 */
import React from 'react';
import { Form, Input, InputNumber, Modal, Select } from 'antd';
import { entityTypeOptions, periodOptions } from './config';
import { spacing } from '@/tokens';

export interface BudgetModalProps {
  open: boolean;
  /** 非空表示编辑模式，为空表示创建模式 */
  editing: boolean;
  confirmLoading: boolean;
  form: ReturnType<typeof Form.useForm>[0];
  onOk: () => void;
  onCancel: () => void;
}

/**
 * 预算创建/编辑弹窗
 *
 * 表单实例由父组件通过 useForm() 创建并注入，
 * 以便父组件在打开弹窗时预填字段、在成功后 resetFields。
 */
export const BudgetModal: React.FC<BudgetModalProps> = ({
  open,
  editing,
  confirmLoading,
  form,
  onOk,
  onCancel,
}) => (
  <Modal
    title={editing ? '编辑预算' : '创建预算'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    confirmLoading={confirmLoading}
    okText="保存"
    cancelText="取消"
    width={600}
  >
    <Form form={form} layout="vertical" style={{ marginTop: spacing.lg }}>
      <Form.Item
        name="entityType"
        label="实体类型"
        rules={[{ required: true, message: '请选择实体类型' }]}
      >
        <Select options={entityTypeOptions} />
      </Form.Item>

      <Form.Item
        name="entityId"
        label="实体 ID"
        rules={[{ required: true, message: '请输入实体 ID' }]}
      >
        <Input placeholder="输入项目/租户/团队 ID" />
      </Form.Item>

      <Form.Item
        name="amount"
        label="预算金额 (¥)"
        rules={[{ required: true, message: '请输入预算金额' }]}
      >
        <InputNumber
          style={{ width: '100%' }}
          min={0}
          precision={2}
          placeholder="输入预算金额"
          prefix="¥"
        />
      </Form.Item>

      <Form.Item
        name="period"
        label="预算周期"
        rules={[{ required: true, message: '请选择预算周期' }]}
      >
        <Select options={periodOptions} />
      </Form.Item>

      <Form.Item name="environment" label="环境">
        <Input placeholder="例如: production, staging" />
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="预算用途说明" />
      </Form.Item>
    </Form>
  </Modal>
);
