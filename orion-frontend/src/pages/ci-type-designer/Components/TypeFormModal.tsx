/**
 * TypeFormModal - 创建/编辑 CI 类型弹窗
 * 抽取自 index.tsx (P2-9 Phase 106)
 */
import React from 'react';
import { Modal, Form, Input, Select, Switch } from 'antd';
import { CATEGORY_OPTIONS } from '../constants';
import type { CITypeDesignerState } from '../useCITypeDesignerState';

interface TypeFormModalProps {
  state: CITypeDesignerState;
}

export const TypeFormModal: React.FC<TypeFormModalProps> = ({ state }) => (
  <Modal
    title={state.editingType ? '编辑 CI 类型' : '新建 CI 类型'}
    open={state.modalOpen}
    onOk={state.handleSubmit}
    onCancel={() => state.setModalOpen(false)}
    confirmLoading={state.submitting}
    destroyOnClose
    okText={state.editingType ? '保存' : '创建'}
    cancelText="取消"
    width={560}
  >
    <Form form={state.form} layout="vertical" initialValues={{ enabled: true }}>
      <Form.Item
        name="name"
        label="名称"
        rules={[
          { required: true, message: '请输入 CI 类型名称' },
          {
            pattern: /^[a-zA-Z0-9_-]+$/,
            message: '名称只能包含英文字母、数字、下划线或连字符',
          },
          { min: 2, message: '名称至少 2 个字符' },
          { max: 50, message: '名称不超过 50 个字符' },
        ]}
      >
        <Input placeholder="如:server, database, app" />
      </Form.Item>
      <Form.Item name="displayName" label="显示名称">
        <Input placeholder="如:服务器, 数据库, 应用" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="类型描述(可选)" />
      </Form.Item>
      <Form.Item name="icon" label="图标">
        <Input placeholder="图标名称(可选)" />
      </Form.Item>
      <Form.Item name="category" label="分类">
        <Select placeholder="选择分类" allowClear options={CATEGORY_OPTIONS} />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="停用" />
      </Form.Item>
    </Form>
  </Modal>
);
