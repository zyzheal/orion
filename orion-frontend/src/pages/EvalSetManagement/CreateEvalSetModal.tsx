/**
 * CreateEvalSetModal.tsx - 新建评测集 Modal
 * 抽取自 EvalSetManagement/index.tsx (P2-9 Phase 60)
 */
import React from 'react';
import { Modal, Form, Input } from 'antd';
import type { FormInstance } from 'antd';

const { TextArea } = Input;

export interface CreateEvalSetModalProps {
  open: boolean;
  onCancel: () => void;
  onOk: () => void;
  form: FormInstance<{ name: string; description?: string; cases: string }>;
}

export const CreateEvalSetModal: React.FC<CreateEvalSetModalProps> = ({
  open,
  onCancel,
  onOk,
  form,
}) => {
  return (
    <Modal
      title="新建评测集"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      okText="创建"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          label="评测集名称"
          name="name"
          rules={[{ required: true, message: '请输入评测集名称' }]}
        >
          <Input placeholder="例: RAG 检索质量评测 v2" />
        </Form.Item>
        <Form.Item label="描述" name="description">
          <Input.TextArea rows={2} placeholder="评测目的说明" />
        </Form.Item>
        <Form.Item
          label="评测用例"
          name="cases"
          rules={[{ required: true, message: '请至少输入一个评测用例' }]}
        >
          <TextArea
            rows={8}
            placeholder={
              '每行一个用例，格式: query ||| gold_answer\n' +
              '例:\nOrion Pipeline 是什么？ ||| Orion Pipeline 是基于 Tekton 的 CI/CD 流水线引擎\n' +
              '如何创建变更请求？ ||| 在变更管理页面点击「新建」按钮即可'
            }
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};
