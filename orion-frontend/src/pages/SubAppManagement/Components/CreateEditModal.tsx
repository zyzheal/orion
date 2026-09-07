/**
 * CreateEditModal - 创建/编辑子应用弹窗
 * 抽取自 index.tsx (P2-9 Phase 127)
 */
import React from 'react';
import { Modal, Form, Input, Space, Switch } from 'antd';
import { spacing } from '@/tokens';
import type { SubAppManagementState } from '../useSubAppManagementState';

const { TextArea } = Input;

interface CreateEditModalProps {
  state: SubAppManagementState;
}

export const CreateEditModal: React.FC<CreateEditModalProps> = ({ state }) => {
  const { drawerOpen, isEditing, form, submitting, handleSubmit, setDrawerOpen } = state;

  return (
    <Modal
      title={isEditing ? '编辑子应用' : '新增子应用'}
      open={drawerOpen}
      onCancel={() => {
        setDrawerOpen(false);
        form.resetFields();
      }}
      onOk={handleSubmit}
      confirmLoading={submitting}
      width={600}
      okText={isEditing ? '保存' : '创建'}
      cancelText="取消"
    >
      <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
        <Form.Item
          name="name"
          label="显示名称"
          rules={[{ required: true, message: '请输入显示名称' }]}
        >
          <Input placeholder="例如：数据库管理" />
        </Form.Item>

        <Form.Item
          name="key"
          label="唯一标识"
          rules={[
            { required: true, message: '请输入唯一标识' },
            {
              pattern: /^[a-z][a-z0-9-]*$/,
              message: '必须以小写字母开头，只包含小写字母、数字、中划线',
            },
          ]}
          extra="用于路由路径，例如：dba → /dba"
        >
          <Input placeholder="例如：dba" disabled={isEditing} />
        </Form.Item>

        <Form.Item
          name="version"
          label="版本号"
          rules={[{ required: true, message: '请输入版本号' }]}
          initialValue="1.0.0"
        >
          <Input placeholder="1.0.0" />
        </Form.Item>

        <Form.Item
          name="entry_dev"
          label="开发环境入口"
          rules={[{ required: true, message: '请输入开发环境入口' }]}
          extra="本地开发时的访问地址"
        >
          <Input placeholder="http://localhost:3030/orion-dba/" />
        </Form.Item>

        <Form.Item
          name="entry_prod"
          label="生产环境入口"
          rules={[{ required: true, message: '请输入生产环境入口' }]}
          extra="部署后的访问路径（以 / 开头）"
        >
          <Input placeholder="/orion-dba/index.html" />
        </Form.Item>

        <Form.Item
          name="routes"
          label="路由路径"
          rules={[{ required: true, message: '请输入路由路径' }]}
          extra="主应用访问路径，多个用逗号分隔"
        >
          <Input placeholder="/dba" />
        </Form.Item>

        <Space>
          <Form.Item name="keep_alive" valuePropName="checked" initialValue={false}>
            <Switch />
            保持存活
          </Form.Item>
          <Form.Item name="preload" valuePropName="checked" initialValue={false}>
            <Switch />
            预加载
          </Form.Item>
        </Space>

        <Form.Item name="description" label="描述">
          <TextArea rows={2} placeholder="简要描述此子应用的功能" />
        </Form.Item>

        <Form.Item
          name="api_domain"
          label="API 路由域"
          extra="子应用后端 API 的路由前缀，例如 'dba' 对应 /api/v1/dba/*"
          rules={[
            {
              pattern: /^[a-z][a-z0-9-]*$/,
              message: '必须以小写字母开头，只包含小写字母、数字、中划线',
            },
          ]}
        >
          <Input placeholder="例如：dba（留空则使用 key）" />
        </Form.Item>
      </Form>
    </Modal>
  );
};
