/**
 * RDM create/edit form modal
 */
import React from 'react';
import { Form, Input, Modal, Select } from 'antd';
import type { FormInstance } from 'antd';
import type { User } from '@/api/users';
import type { EntityType } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface RDMFormModalProps {
  open: boolean;
  editingItem: any;
  entityName: EntityType;
  form: FormInstance;
  users: User[];
  onOk: () => void;
  onCancel: () => void;
}

export const RDMFormModal: React.FC<RDMFormModalProps> = ({
  open,
  editingItem,
  entityName,
  form,
  users,
  onOk,
  onCancel,
}) => (
  <Modal
    title={editingItem ? '编辑' : '新建'}
    open={open}
    onOk={onOk}
    onCancel={onCancel}
    destroyOnClose
  >
    <Form form={form} layout="vertical">
      <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <TextArea rows={4} />
      </Form.Item>
      {entityName !== 'task' && (
        <Form.Item name="priority" label="优先级" rules={[{ required: true }]}>
          <Select>
            <Option value="critical">Critical</Option>
            <Option value="high">High</Option>
            <Option value="medium">Medium</Option>
            <Option value="low">Low</Option>
          </Select>
        </Form.Item>
      )}
      {entityName === 'requirement' && (
        <Form.Item name="storyPoints" label="Story Points">
          <Input type="number" />
        </Form.Item>
      )}
      {entityName === 'sprint' && (
        <>
          <Form.Item name="startDate" label="开始日期">
            <Input type="date" />
          </Form.Item>
          <Form.Item name="endDate" label="结束日期">
            <Input type="date" />
          </Form.Item>
        </>
      )}
      <Form.Item name="assignee" label="经办人">
        <Select
          showSearch
          allowClear
          placeholder="搜索并选择经办人"
          optionFilterProp="children"
        >
          {users.map((u) => (
            <Option key={u.id} value={u.id}>
              {u.name || u.username}
            </Option>
          ))}
        </Select>
      </Form.Item>
    </Form>
  </Modal>
);

