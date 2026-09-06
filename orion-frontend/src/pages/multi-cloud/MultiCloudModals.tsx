/**
 * 多云管理页面 - 弹窗组件
 *
 * 从 MultiCloudPage.tsx 中提取的三个 Modal：
 * - CreateAccountModal      注册云账号
 * - EditAccountModal        编辑云账号
 * - CostComparisonModal     跨云成本对比
 */
import React from 'react';
import { Button, Modal, Form, Input, Select, Table } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { costColumns } from './MultiCloudColumns';
import { providerOptions } from './MultiCloudConfig';
import type { CostComparison } from '@/api/multi-cloud';
import { spacing } from '@/tokens';

// ============================================================================
// 注册云账号弹窗
// ============================================================================

export interface CreateAccountModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onFinish: (values: { name: string; provider: string; region: string; credentials_ref?: string }) => void;
}

export const CreateAccountModal: React.FC<CreateAccountModalProps> = ({
  open,
  form,
  onCancel,
  onFinish,
}) => (
  <Modal
    title="添加云账号"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="账号名称"
        name="name"
        rules={[{ required: true, message: '请输入账号名称' }]}
      >
        <Input placeholder="如: AWS Production" />
      </Form.Item>
      <Form.Item
        label="云厂商"
        name="provider"
        rules={[{ required: true, message: '请选择云厂商' }]}
      >
        <Select options={providerOptions} />
      </Form.Item>
      <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
        <Input placeholder="如: us-east-1" />
      </Form.Item>
      <Form.Item label="凭证引用" name="credentials_ref">
        <Input placeholder="如: IAM Role ARN 或 Service Account Path" />
      </Form.Item>
    </Form>
  </Modal>
);

// ============================================================================
// 编辑云账号弹窗
// ============================================================================

export interface EditAccountModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onFinish: (values: { name: string; provider: string; region: string }) => void;
}

export const EditAccountModal: React.FC<EditAccountModalProps> = ({
  open,
  form,
  onCancel,
  onFinish,
}) => (
  <Modal
    title="编辑云账号"
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    width={600}
  >
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="账号名称"
        name="name"
        rules={[{ required: true, message: '请输入账号名称' }]}
      >
        <Input placeholder="如: AWS Production" />
      </Form.Item>
      <Form.Item
        label="云厂商"
        name="provider"
        rules={[{ required: true, message: '请选择云厂商' }]}
      >
        <Select options={providerOptions} />
      </Form.Item>
      <Form.Item label="区域" name="region" rules={[{ required: true, message: '请输入区域' }]}>
        <Input placeholder="如: us-east-1" />
      </Form.Item>
    </Form>
  </Modal>
);

// ============================================================================
// 跨云成本对比弹窗
// ============================================================================

export interface CostComparisonModalProps {
  open: boolean;
  form: FormInstance;
  comparison: CostComparison[];
  loading: boolean;
  onCancel: () => void;
  onFinish: (values: {
    vm_count: number;
    vm_type: string;
    storage_gb: number;
    bandwidth_gb_month: number;
  }) => void;
}

export const CostComparisonModal: React.FC<CostComparisonModalProps> = ({
  open,
  form,
  comparison,
  loading,
  onCancel,
  onFinish,
}) => {
  return (
    <Modal title="跨云成本对比" open={open} onCancel={onCancel} footer={null} width={700}>
      <Form
        form={form}
        layout="inline"
        onFinish={onFinish}
        style={{ marginBottom: spacing.md }}
      >
        <Form.Item label="VM 数量" name="vm_count" initialValue={1}>
          <Input type="number" style={{ width: 80 }} />
        </Form.Item>
        <Form.Item label="VM 类型" name="vm_type" initialValue="medium">
          <Select
            style={{ width: 100 }}
            options={[
              { value: 'small', label: 'Small' },
              { value: 'medium', label: 'Medium' },
              { value: 'large', label: 'Large' },
            ]}
          />
        </Form.Item>
        <Form.Item label="存储(GB)" name="storage_gb" initialValue={100}>
          <Input type="number" style={{ width: 80 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading}>
            对比
          </Button>
        </Form.Item>
      </Form>

      {comparison.length > 0 && (
        <Table dataSource={comparison} rowKey="provider" pagination={false} size="small" columns={costColumns} />
      )}
    </Modal>
  );
};

