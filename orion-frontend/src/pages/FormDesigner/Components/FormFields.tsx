/**
 * FormDesigner form field render
 * 抽取自 index.tsx (P2-9 Phase 161)
 */
import { Form, Input, Select, Switch } from 'antd';

const { TextArea } = Input;
const { Option } = Select;

export const FormFields = ({ activeTab }: { activeTab: 'forms' | 'conditions' }) => {
  if (activeTab === 'forms') {
    return (
      <>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入表单名称' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="description" label="描述">
          <TextArea rows={2} />
        </Form.Item>
        <Form.Item name="version" label="版本" rules={[{ required: true }]}>
          <Input placeholder="1.0.0" />
        </Form.Item>
        <Form.Item
          name="schema"
          label="JSON Schema"
          rules={[{ required: true, message: '请输入 JSON Schema' }]}
        >
          <TextArea
            rows={8}
            placeholder='{"type":"object","properties":{"field1":{"type":"string"}}}'
          />
        </Form.Item>
        <Form.Item name="status" label="状态" initialValue="draft">
          <Select>
            <Option value="draft">草稿</Option>
            <Option value="published">已发布</Option>
            <Option value="archived">已归档</Option>
          </Select>
        </Form.Item>
      </>
    );
  }
  return (
    <>
      <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入条件名称' }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <TextArea rows={2} />
      </Form.Item>
      <Form.Item
        name="condition"
        label="条件表达式"
        rules={[{ required: true, message: '请输入条件表达式' }]}
      >
        <Input placeholder='field1 == "value1" && field2 > 10' />
      </Form.Item>
      <Form.Item name="enabled" label="启用" valuePropName="checked" initialValue={true}>
        <Switch />
      </Form.Item>
    </>
  );
};
