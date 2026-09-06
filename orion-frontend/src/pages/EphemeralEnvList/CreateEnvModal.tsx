/**
 * CreateEnvModal.tsx - 创建环境弹窗（自包含）
 * 抽取自 EphemeralEnvList/index.tsx (P2-9 Phase 69)
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Select, Space, message } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import {
  createEphemeralEnv,
  getEnvironmentTemplates,
  type EnvironmentTemplate,
} from '@/api/ephemeral-envs';
import type { CreateEnvFormValues } from './types';

interface CreateEnvModalProps {
  open: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export const CreateEnvModal: React.FC<CreateEnvModalProps> = ({ open, onCancel, onSuccess }) => {
  const [form] = Form.useForm<CreateEnvFormValues>();
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState<EnvironmentTemplate[]>([]);

  useEffect(() => {
    if (open) {
      getEnvironmentTemplates()
        .then((res) => {
          setTemplates(Array.isArray(res) ? res : []);
        })
        .catch(() => setTemplates([]));
    }
  }, [open]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);

      await createEphemeralEnv({
        prId: values.prId,
        repoId: values.repoId,
        branchName: values.branchName,
        templateId: values.templateId || undefined,
        commitSha: values.commitSha,
      });

      message.success('临时环境创建成功');
      form.resetFields();
      setCreating(false);
      onSuccess();
    } catch (err: unknown) {
      setCreating(false);
      const errObj = err as { errorFields?: unknown; message?: string };
      if (errObj.errorFields) return;
      const msg = err instanceof Error ? err.message : '创建失败';
      message.error(`创建失败：${msg}`);
    }
  };

  return (
    <Modal
      title={
        <Space>
          <PlusOutlined />
          创建临时环境
        </Space>
      }
      open={open}
      onCancel={onCancel}
      onOk={handleCreate}
      confirmLoading={creating}
      okText="创建"
      cancelText="取消"
      width={600}
      data-testid="create-env-modal"
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item label="PR ID" name="prId" rules={[{ required: true, message: '请输入 PR ID' }]}>
          <Input placeholder="例如：123" />
        </Form.Item>

        <Form.Item
          label="仓库 ID"
          name="repoId"
          rules={[{ required: true, message: '请输入仓库 ID' }]}
        >
          <Input placeholder="例如：org/repo" />
        </Form.Item>

        <Form.Item
          label="分支名称"
          name="branchName"
          rules={[{ required: true, message: '请输入分支名称' }]}
        >
          <Input placeholder="例如：feature/my-feature" />
        </Form.Item>

        <Form.Item
          label="Commit SHA"
          name="commitSha"
          rules={[{ required: true, message: '请输入 Commit SHA' }]}
        >
          <Input placeholder="例如：abc1234" />
        </Form.Item>

        <Form.Item label="环境模板" name="templateId">
          <Select placeholder="选择模板 (可选)" allowClear>
            {templates.map((t) => (
              <Select.Option key={t.id} value={t.id}>
                {t.name}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};
