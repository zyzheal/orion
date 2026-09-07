/**
 * CreateSecretModal - 创建 Secret 弹窗
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { SecretsManagementState } from '../useSecretsManagementState';

const { Password } = Input;

interface CreateSecretModalProps {
  state: SecretsManagementState;
}

export const CreateSecretModal: React.FC<CreateSecretModalProps> = ({ state }) => {
  const { createModalVisible, createForm, submitting, handleCreate, setCreateModalVisible } =
    state;

  return (
    <Modal
      title="创建 Secret"
      open={createModalVisible}
      onCancel={() => {
        setCreateModalVisible(false);
        createForm.resetFields();
      }}
      onOk={handleCreate}
      confirmLoading={submitting}
      width={560}
      destroyOnClose
    >
      <Form form={createForm} layout="vertical" autoComplete="off">
        <Form.Item
          name="name"
          label="名称"
          rules={[
            { required: true, message: '请输入 Secret 名称' },
            {
              pattern: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
              message: '名称只能包含字母、数字和下划线，且不能以数字开头',
            },
          ]}
          tooltip="用于 Pipeline 中引用，格式: ${secrets.NAME}"
        >
          <Input placeholder="如: DB_PASSWORD" maxLength={255} />
        </Form.Item>

        <Form.Item
          name="value"
          label="Secret 值"
          rules={[{ required: true, message: '请输入 Secret 值' }]}
        >
          <Password
            placeholder="输入密钥值（将加密存储）"
            autoComplete="new-password"
            visibilityToggle={false}
          />
        </Form.Item>

        <Form.Item
          name="scope"
          label="作用域"
          rules={[{ required: true, message: '请选择作用域' }]}
          initialValue="project"
        >
          <Select
            options={[
              { label: '项目 (project) — 仅当前项目可用', value: 'project' },
              { label: '环境 (environment) — 指定环境可用', value: 'environment' },
              { label: '组织 (org) — 整个组织可用', value: 'org' },
            ]}
            placeholder="选择作用域"
          />
        </Form.Item>

        <Form.Item name="description" label="描述">
          <Input.TextArea rows={2} placeholder="可选，描述此 Secret 的用途..." />
        </Form.Item>
      </Form>
    </Modal>
  );
};
