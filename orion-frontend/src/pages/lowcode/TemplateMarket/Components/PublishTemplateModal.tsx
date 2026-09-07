/**
 * PublishTemplateModal - 发布为模板弹窗
 * 抽取自 index.tsx (P2-9 Phase 141)
 */
import React from 'react';
import { Modal, Form, Input, Button, Select } from 'antd';
import { ExportOutlined } from '@ant-design/icons';
import type { LowcodeFlow } from '@/api/lowcode';
import { CATEGORY_OPTIONS } from '../constants';
import type { PublishFormValues } from '../types';

const { Option } = Select;
const { TextArea } = Input;

interface PublishTemplateModalProps {
  visible: boolean;
  publishing: boolean;
  flows: LowcodeFlow[];
  form: import('antd').FormInstance<PublishFormValues>;
  onClose: () => void;
  onSubmit: (values: PublishFormValues) => void | Promise<void>;
}

export const PublishTemplateModal: React.FC<PublishTemplateModalProps> = ({
  visible,
  publishing,
  flows,
  form,
  onClose,
  onSubmit,
}) => (
  <Modal title="发布为模板" open={visible} onCancel={onClose} footer={null}>
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="flowId"
        label="选择流程"
        rules={[{ required: true, message: '请选择要发布为模板的流程' }]}
      >
        <Select placeholder="选择一个已有流程" loading={flows.length === 0}>
          {flows.map((flow) => (
            <Option key={flow.id} value={flow.id}>
              {flow.name} (v{flow.version})
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item
        name="name"
        label="模板名称"
        rules={[{ required: true, message: '请输入模板名称' }]}
      >
        <Input placeholder="模板名称" />
      </Form.Item>
      <Form.Item name="description" label="模板描述">
        <TextArea placeholder="描述模板的用途和适用场景" rows={3} />
      </Form.Item>
      <Form.Item name="category" label="分类" initialValue="custom">
        <Select>
          {CATEGORY_OPTIONS.map((o) => (
            <Option key={o.value} value={o.value}>
              {o.label}
            </Option>
          ))}
        </Select>
      </Form.Item>
      <Form.Item name="tags" label="标签">
        <Select mode="tags" placeholder="输入标签后按回车" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block icon={<ExportOutlined />} loading={publishing}>
          发布模板
        </Button>
      </Form.Item>
    </Form>
  </Modal>
);
