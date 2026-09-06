/**
 * ItemModal - 配置项新增/编辑 Modal
 */
import React from 'react';
import { Modal, Form, Input, Select } from 'antd';
import type { ConfigItem } from '@/api/distributedConfig';

const { TextArea } = Input;
const { Option } = Select;

export interface ItemModalProps {
  open: boolean;
  editingItem: ConfigItem | null;
  form: ReturnType<typeof Form.useForm>[0];
  onOk: (values: any) => void;
  onCancel: () => void;
}

export const ItemModal: React.FC<ItemModalProps> = ({
  open,
  editingItem,
  form,
  onOk,
  onCancel,
}) => (
  <Modal
    title={editingItem ? '编辑配置项' : '新增配置项'}
    open={open}
    onCancel={onCancel}
    onOk={() => form.submit()}
    width={600}
  >
    <Form
      form={form}
      layout="vertical"
      onFinish={editingItem ? (v) => onOk({ id: editingItem.id, ...v }) : onOk}
    >
      {!editingItem && (
        <Form.Item name="keyName" label="配置键名" rules={[{ required: true }]}>
          <Input placeholder="config.key.name" />
        </Form.Item>
      )}
      <Form.Item name="value" label="配置值" rules={[{ required: true }]}>
        <TextArea rows={3} placeholder="配置值" />
      </Form.Item>
      <Form.Item name="valueType" label="值类型" initialValue="string">
        <Select>
          <Option value="string">string</Option>
          <Option value="int">int</Option>
          <Option value="float">float</Option>
          <Option value="bool">bool</Option>
          <Option value="json">json</Option>
          <Option value="secret">secret</Option>
        </Select>
      </Form.Item>
      <Form.Item name="encrypted" label="加密" valuePropName="checked">
        <Input type="hidden" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input placeholder="配置说明" />
      </Form.Item>
    </Form>
  </Modal>
);
