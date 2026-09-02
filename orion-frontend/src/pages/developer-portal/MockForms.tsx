/**
 * Mock Rule Forms — CreateMockForm and EditMockForm extracted from DeveloperPortalPage.tsx
 */
import { Form, Input, Select, Row, Col, InputNumber } from 'antd';
import { spacing } from '@/tokens';
import { httpMethods } from './config';

interface MockFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
  isEdit?: boolean;
}

export function CreateMockForm({ formInstance }: MockFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
        <Input placeholder="如: 用户列表 Mock" />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input placeholder="规则描述" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={6}>
          <Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]}>
            <Select options={httpMethods.map((m) => ({ value: m, label: m }))} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="path" label="路径" rules={[{ required: true }]}>
            <Input placeholder="/api/v1/users" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="matchType" label="匹配类型" initialValue="exact">
            <Select
              options={[
                { value: 'exact', label: '精确' },
                { value: 'prefix', label: '前缀' },
                { value: 'regex', label: '正则' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <Form.Item name="statusCode" label="状态码" initialValue={200}>
            <InputNumber min={100} max={599} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="delay" label="延迟 (ms)" initialValue={0}>
            <InputNumber min={0} max={30000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="priority" label="优先级" initialValue={0}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="body" label="响应 Body (JSON)">
        <Input.TextArea rows={4} placeholder='{"data": []}' />
      </Form.Item>
    </Form>
  );
}

export function EditMockForm({ formInstance }: MockFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="description" label="描述">
        <Input />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={6}>
          <Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]}>
            <Select options={httpMethods.map((m) => ({ value: m, label: m }))} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="path" label="路径" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="matchType" label="匹配类型">
            <Select
              options={[
                { value: 'exact', label: '精确' },
                { value: 'prefix', label: '前缀' },
                { value: 'regex', label: '正则' },
              ]}
            />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <Form.Item name="statusCode" label="状态码">
            <InputNumber min={100} max={599} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="delay" label="延迟 (ms)">
            <InputNumber min={0} max={30000} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="priority" label="优先级">
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="body" label="响应 Body (JSON)">
        <Input.TextArea rows={4} />
      </Form.Item>
    </Form>
  );
}
