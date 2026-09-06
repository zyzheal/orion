/**
 * CreateArtifactModal.tsx - 创建制品 Modal
 * 抽取自 Artifacts/index.tsx (P2-9 Phase 75)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { FormInstance } from 'antd';
import { typeLabelMap } from './constants';

interface CreateArtifactModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  namespaces: string[];
  onCancel: () => void;
  onOk: () => void;
}

export const CreateArtifactModal: React.FC<CreateArtifactModalProps> = ({
  visible,
  form,
  submitting,
  namespaces,
  onCancel,
  onOk,
}) => {
  return (
    <Modal
      title="创建制品"
      open={visible}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={submitting}
      width={640}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="名称 (唯一标识)"
          rules={[{ required: true, message: '请输入名称' }]}
        >
          <Input placeholder="如: orion-core" />
        </Form.Item>
        <Form.Item
          name="namespace"
          label="命名空间"
          rules={[{ required: true, message: '请选择命名空间' }]}
        >
          <Select
            options={namespaces.map((n) => ({ label: n, value: n }))}
            placeholder="选择命名空间"
          />
        </Form.Item>
        <Form.Item
          name="version"
          label="版本"
          rules={[{ required: true, message: '请输入版本号' }]}
        >
          <Input placeholder="如: 1.0.0" />
        </Form.Item>
        <Form.Item
          name="type"
          label="类型"
          rules={[{ required: true, message: '请选择类型' }]}
        >
          <Select
            options={Object.entries(typeLabelMap).map(([v, l]) => ({ label: l, value: v }))}
          />
        </Form.Item>
        <Form.Item name="displayName" label="显示名称">
          <Input placeholder="制品显示名称" />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="制品描述..." />
        </Form.Item>
        <Form.Item name="storagePath" label="存储路径">
          <Input placeholder="/storage/path" />
        </Form.Item>
        <Form.Item name="storageBackend" label="存储后端">
          <Select
            options={[
              { label: 'Local', value: 'local' },
              { label: 'Harbor', value: 'harbor' },
              { label: 'Nexus', value: 'nexus' },
              { label: 'S3', value: 's3' },
            ]}
          />
        </Form.Item>
        <Form.Item name="labels" label="标签 (key:value, 逗号分隔)">
          <Input placeholder="team:platform, tier:core" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
