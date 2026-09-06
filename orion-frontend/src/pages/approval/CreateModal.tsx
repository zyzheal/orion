/**
 * CreateModal - 创建审批请求（含模板快速选择）
 * 抽取自 ApprovalPage.tsx (P2-9 Phase 40)
 */
import React from 'react';
import type { FormInstance } from 'antd';
import { Modal, Form, Input, Select, Space, Button, Typography } from 'antd';
import { spacing } from '@/tokens';
import { APPROVAL_TEMPLATES } from './constants';
import type { ApprovalTemplate } from './constants';

const { Text } = Typography;

export interface CreateModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: () => void;
  confirmLoading: boolean;
  form: FormInstance;
  onTemplateSelect: (t: ApprovalTemplate) => void;
}

export const CreateModal: React.FC<CreateModalProps> = ({
  visible,
  onCancel,
  onOk,
  confirmLoading,
  form,
  onTemplateSelect,
}) => (
  <Modal
    title="创建审批请求"
    open={visible}
    onCancel={onCancel}
    onOk={onOk}
    confirmLoading={confirmLoading}
    width={600}
    destroyOnClose
  >
    <div style={{ marginBottom: spacing.md }} >
      <Text type="secondary">快速选择模板：</Text>
      <Space style={{ marginTop: spacing.sm }} wrap>
        {APPROVAL_TEMPLATES.map((t) => (
          <Button key={t.id} size="small" onClick={() => onTemplateSelect(t)}>
            {t.name}
          </Button>
        ))}
      </Space>
    </div>
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="审批标题" rules={[{ required: true }]}>
        <Input placeholder="如: 生产环境部署审批" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={3} placeholder="详细说明审批原因和背景..." />
      </Form.Item>
      <Form.Item name="requesterId" label="申请人">
        <Input placeholder="申请人 ID (默认当前用户)" />
      </Form.Item>
      <Form.Item name="approverIds" label="审批人列表 (逗号分隔)" rules={[{ required: true }]}>
        <Input placeholder="如: tech-lead, ops-manager, security-lead" />
      </Form.Item>
      <Form.Item name="requiredApprovals" label="所需通过数">
        <Input type="number" placeholder="默认 1" min={1} />
      </Form.Item>
      <Form.Item name="metadata" label="资源类型">
        <Select
          placeholder="选择关联资源类型"
          options={[
            { label: '部署 (deployment)', value: 'deployment' },
            { label: '数据库 (database)', value: 'database' },
            { label: '服务 (service)', value: 'service' },
            { label: '安全 (security)', value: 'security' },
            { label: '基础设施 (infrastructure)', value: 'infrastructure' },
            { label: '通用 (generic)', value: 'generic' },
          ]}
        />
      </Form.Item>
    </Form>
  </Modal>
);
