/**
 * WorkflowTriggers Create/Edit Modal
 * 抽取自 index.tsx (P2-9 Phase 131)
 */
import React from 'react';
import { Modal, Form, Input, Select, Switch, Tag } from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  ApiOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { WorkflowTrigger, CreateWorkflowTriggerInput } from '@/api/workflow-trigger';
import type { WorkflowDefinition } from '@/api/workflow';

interface CreateEditModalProps {
  open: boolean;
  submitting: boolean;
  editingTrigger: WorkflowTrigger | null;
  workflows: WorkflowDefinition[];
  form: import('antd').FormInstance;
  onCancel: () => void;
  handleCreate: (values: CreateWorkflowTriggerInput) => void;
  handleUpdate: (values: CreateWorkflowTriggerInput) => void;
}

export const CreateEditModal: React.FC<CreateEditModalProps> = ({
  open,
  submitting,
  editingTrigger,
  workflows,
  form,
  onCancel,
  handleCreate,
  handleUpdate,
}) => (
  <Modal
    title={editingTrigger ? '编辑触发器' : '新建触发器'}
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    confirmLoading={submitting}
    okText={editingTrigger ? '保存' : '创建'}
    cancelText="取消"
    width={600}
  >
    <Form
      form={form}
      layout="vertical"
      onFinish={editingTrigger ? handleUpdate : handleCreate}
      initialValues={{ type: 'event', enabled: true, timezone: 'Asia/Shanghai' }}
    >
      <Form.Item
        name="name"
        label="名称"
        rules={[{ required: true, message: '请输入触发器名称' }]}
      >
        <Input placeholder="e.g. daily-trigger" />
      </Form.Item>

      <Form.Item
        name="type"
        label="类型"
        rules={[{ required: true, message: '请选择触发器类型' }]}
      >
        <Select placeholder="选择触发器类型">
          <Select.Option value="event">
            <Tag color="blue">
              <ThunderboltOutlined /> 事件触发
            </Tag>
          </Select.Option>
          <Select.Option value="cron">
            <Tag color="orange">
              <ClockCircleOutlined /> 定时触发
            </Tag>
          </Select.Option>
          <Select.Option value="webhook">
            <Tag color="purple">
              <ApiOutlined /> Webhook
            </Tag>
          </Select.Option>
          <Select.Option value="manual">
            <Tag>
              <GlobalOutlined /> 手动触发
            </Tag>
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item
        name="workflowId"
        label="关联工作流"
        rules={[{ required: true, message: '请选择关联工作流' }]}
      >
        <Select
          placeholder="选择工作流"
          showSearch
          optionFilterProp="children"
          filterOption={(input, option) =>
            String(option?.label ?? '')
              .toLowerCase()
              .includes(input.toLowerCase())
          }
        >
          {workflows.map((wf) => (
            <Select.Option key={wf.id} value={wf.id} label={wf.name}>
              {wf.name}
            </Select.Option>
          ))}
        </Select>
      </Form.Item>

      <Form.Item noStyle dependencies={['type']}>
        {({ getFieldValue }) => {
          const type = getFieldValue('type');
          return (
            <>
              {type === 'event' && (
                <Form.Item
                  name="eventType"
                  label="事件类型"
                  rules={[{ required: true, message: '请输入事件类型' }]}
                >
                  <Input placeholder="e.g. pipeline.completed, deployment.success" />
                </Form.Item>
              )}
              {type === 'cron' && (
                <Form.Item
                  name="cronExpression"
                  label="Cron 表达式"
                  rules={[{ required: true, message: '请输入 Cron 表达式' }]}
                >
                  <Input placeholder="e.g. 0 0 * * * (每天零点)" />
                </Form.Item>
              )}
              {type === 'webhook' && (
                <Form.Item name="webhookPath" label="Webhook 路径">
                  <Input placeholder="e.g. /webhook/trigger-xxx" />
                </Form.Item>
              )}
            </>
          );
        }}
      </Form.Item>

      <Form.Item name="description" label="描述">
        <Input.TextArea rows={2} placeholder="可选描述信息" />
      </Form.Item>

      <Form.Item name="enabled" label="启用" valuePropName="checked">
        <Switch checkedChildren="启用" unCheckedChildren="禁用" />
      </Form.Item>
    </Form>
  </Modal>
);
