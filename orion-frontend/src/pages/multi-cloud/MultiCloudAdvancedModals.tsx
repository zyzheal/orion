/**
 * Multi-Cloud Advanced Page - Modals / Drawers
 * 多云进阶管理 - 弹窗组件抽取
 *
 * 从 MultiCloudAdvancedPage.tsx 拆分而来，保持交互与字段不变。
 */
import React, { type FormInstance } from 'react';
import { Modal, Form, Select, Input } from 'antd';
import { ACCOUNT_PROVIDER_OPTIONS } from './MultiCloudAdvancedConfig';

export interface RegisterCloudAccountModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  onSubmit: (values: {
    provider: string;
    name: string;
    region: string;
    credentials?: { accessKeyId?: string; secretAccessKey?: string };
  }) => void;
  title?: string;
}

/** 注册云账号弹窗 */
export const RegisterCloudAccountModal: React.FC<RegisterCloudAccountModalProps> = ({
  open,
  form,
  onCancel,
  onSubmit,
  title = 'Register Cloud Account',
}) => (
  <Modal title={title} open={open} onCancel={onCancel} onOk={() => form.submit()}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item label="Provider" name="provider" rules={[{ required: true }]}>
        <Select options={ACCOUNT_PROVIDER_OPTIONS} />
      </Form.Item>
      <Form.Item label="Account Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="aws-production" />
      </Form.Item>
      <Form.Item label="Region" name="region" rules={[{ required: true }]}>
        <Input placeholder="us-east-1" />
      </Form.Item>
      <Form.Item label="Access Key ID" name={['credentials', 'accessKeyId']}>
        <Input.Password />
      </Form.Item>
      <Form.Item label="Secret Access Key" name={['credentials', 'secretAccessKey']}>
        <Input.Password />
      </Form.Item>
    </Form>
  </Modal>
);

export interface CreateDrPlanModalProps {
  open: boolean;
  form: FormInstance;
  onCancel: () => void;
  title?: string;
}

/** 创建容灾计划弹窗（表单仅用于交互占位，当前无落库动作） */
export const CreateDrPlanModal: React.FC<CreateDrPlanModalProps> = ({
  open,
  form,
  onCancel,
  title = 'Create DR Plan',
}) => (
  <Modal title={title} open={open} onCancel={onCancel} onOk={() => form.submit()}>
    <Form form={form} layout="vertical">
      <Form.Item label="Plan Name" name="name" rules={[{ required: true }]}>
        <Input placeholder="primary-dr-plan" />
      </Form.Item>
      <Form.Item label="Primary Region" name="primary_region" rules={[{ required: true }]}>
        <Input placeholder="us-east-1" />
      </Form.Item>
      <Form.Item label="Failover Region" name="failover_region" rules={[{ required: true }]}>
        <Input placeholder="ap-northeast-1" />
      </Form.Item>
      <Form.Item label="RPO Target (minutes)" name="rpo_target">
        <Input type="number" defaultValue={10} />
      </Form.Item>
      <Form.Item label="RTO Target (minutes)" name="rto_target">
        <Input type="number" defaultValue={30} />
      </Form.Item>
    </Form>
  </Modal>
);
