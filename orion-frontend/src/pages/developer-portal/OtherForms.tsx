/**
 * Other Forms — CreateSdkForm, CreateSubForm, RejectSubForm, PlaygroundForm
 */
import { Form, Input, Select, Row, Col, InputNumber, Button } from 'antd';
import { spacing } from '@/tokens';
import { SendOutlined } from '@ant-design/icons';
import { languageOptions, httpMethods } from './config';

type FormInstance = ReturnType<typeof Form.useForm>[0];

export function CreateSdkForm({ formInstance }: { formInstance: FormInstance }) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="name" label="任务名称" rules={[{ required: true }]}>
        <Input placeholder="如: Orion Pipeline SDK" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <Form.Item name="language" label="目标语言" rules={[{ required: true }]}>
            <Select options={languageOptions} />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="packageName" label="包名" rules={[{ required: true }]}>
            <Input placeholder="orion-pipeline-sdk" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="version" label="版本" initialValue="1.0.0">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item
        name="apiSpec"
        label="API 规范 (OpenAPI/Swagger JSON 或 YAML)"
        rules={[{ required: true }]}
      >
        <Input.TextArea rows={6} placeholder='{"openapi": "3.0.0", ...}' />
      </Form.Item>
    </Form>
  );
}

export function CreateSubForm({ formInstance }: { formInstance: FormInstance }) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="apiName" label="API 名称" rules={[{ required: true }]}>
        <Input placeholder="如: Pipeline API" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="planName" label="套餐" initialValue="standard">
            <Select
              options={[
                { value: 'free', label: '免费版' },
                { value: 'standard', label: '标准版' },
                { value: 'premium', label: '高级版' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="quotaPerDay" label="日配额" initialValue={1000}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item name="quotaPerMonth" label="月配额" initialValue={30000}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="reason" label="申请理由">
        <Input.TextArea rows={3} placeholder="请说明使用场景和目的" />
      </Form.Item>
    </Form>
  );
}

export function RejectSubForm({ formInstance }: { formInstance: FormInstance }) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="reason"
        label="拒绝原因"
        rules={[{ required: true, message: '请输入拒绝原因' }]}
      >
        <Input.TextArea rows={3} placeholder="请说明拒绝原因" />
      </Form.Item>
    </Form>
  );
}

interface PlaygroundFormProps {
  formInstance: FormInstance;
  pgExecuting: boolean;
}

export function PlaygroundForm({ formInstance, pgExecuting }: PlaygroundFormProps) {
  return (
    <Form
      form={formInstance}
      layout="vertical"
      initialValues={{ method: 'GET', bodyType: 'json' }}
    >
      <Row gutter={12}>
        <Col span={6}>
          <Form.Item name="method" label="方法" rules={[{ required: true }]}>
            <Select options={httpMethods.map((m) => ({ value: m, label: m }))} />
          </Form.Item>
        </Col>
        <Col span={18}>
          <Form.Item
            name="url"
            label="URL"
            rules={[{ required: true, message: '请输入 URL' }]}
          >
            <Input placeholder="https://api.example.com/v1/resource" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="headers" label="Headers (JSON)">
        <Input.TextArea rows={2} placeholder='{"Authorization": "Bearer xxx"}' />
      </Form.Item>
      <Form.Item name="queryParams" label="Query Params (JSON)">
        <Input.TextArea rows={2} placeholder='{"page": "1", "limit": "10"}' />
      </Form.Item>
      <Row gutter={12}>
        <Col span={6}>
          <Form.Item name="bodyType" label="Body 类型">
            <Select
              options={[
                { value: 'none', label: 'None' },
                { value: 'json', label: 'JSON' },
                { value: 'form', label: 'Form' },
                { value: 'raw', label: 'Raw' },
              ]}
            />
          </Form.Item>
        </Col>
        <Col span={18}>
          <Form.Item name="body" label="Body">
            <Input.TextArea rows={4} placeholder='{"key": "value"}' />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SendOutlined />}
          loading={pgExecuting}
          block
        >
          发送请求
        </Button>
      </Form.Item>
    </Form>
  );
}
