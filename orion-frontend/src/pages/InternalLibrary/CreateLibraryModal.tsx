/**
 * Create Library Modal - Form for creating a new internal library
 */
import React from 'react';
import { Modal, Form, Input, Select, Switch } from 'antd';
import type { FormInstance } from 'antd';

const languageOptions = [
  { label: 'Java', value: 'java' },
  { label: 'Node.js', value: 'node' },
  { label: 'Python', value: 'python' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' },
  { label: '.NET', value: 'dotnet' },
];

interface CreateLibraryModalProps {
  visible: boolean;
  form: FormInstance;
  submitting: boolean;
  onCancel: () => void;
  onOk: () => void;
}

const CreateLibraryModal: React.FC<CreateLibraryModalProps> = ({
  visible, form, submitting, onCancel, onOk,
}) => (
  <Modal
    title="创建二方库" open={visible} onCancel={onCancel}
    onOk={onOk} confirmLoading={submitting} width={640} destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="name" label="名称 (唯一标识)" rules={[{ required: true, message: '请输入名称' }]}>
        <Input placeholder="如: @orion/auth 或 orion-db-core" />
      </Form.Item>
      <Form.Item name="displayName" label="显示名称" rules={[{ required: true, message: '请输入显示名称' }]}>
        <Input placeholder="如: Orion 认证库" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="二方库描述..." />
      </Form.Item>
      <Form.Item name="language" label="语言" rules={[{ required: true, message: '请选择语言' }]}>
        <Select options={languageOptions} placeholder="选择编程语言" />
      </Form.Item>
      <Form.Item name="owner" label="所属团队" rules={[{ required: true, message: '请输入团队名称' }]}>
        <Input placeholder="如: platform-team" />
      </Form.Item>
      <Form.Item name="maintainers" label="维护者 (逗号分隔)">
        <Input placeholder="如: heal, alice" />
      </Form.Item>
      <Form.Item name="repository" label="Git 仓库地址" rules={[{ required: true, message: '请输入仓库地址' }]}>
        <Input placeholder="https://github.com/org/repo" />
      </Form.Item>
      <Form.Item name="documentation" label="文档地址">
        <Input placeholder="https://docs.example.com" />
      </Form.Item>
      <Form.Item name="sla" label="SLA 等级">
        <Select options={[{ label: 'P0 - 核心', value: 'p0' }, { label: 'P1 - 重要', value: 'p1' }, { label: 'P2 - 普通', value: 'p2' }]} placeholder="选择 SLA" />
      </Form.Item>
      <Form.Item name="requireApproval" label="发布需要审批" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item name="approvers" label="审批人 (逗号分隔)">
        <Input placeholder="如: tech-lead, qa-lead" />
      </Form.Item>
    </Form>
  </Modal>
);

export default CreateLibraryModal;
