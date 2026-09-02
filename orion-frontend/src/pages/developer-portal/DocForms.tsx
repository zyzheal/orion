/**
 * Document Forms — CreateDocForm and EditDocForm extracted from DeveloperPortalPage.tsx
 */
import { Form, Input, Select, Row, Col } from 'antd';
import { spacing } from '@/tokens';
import { documentTypeConfig } from './config';

interface DocFormProps {
  formInstance: ReturnType<typeof Form.useForm>[0];
  withVersion?: boolean;
  withContentFormat?: boolean;
  contentRows?: number;
}

export function CreateDocForm({
  formInstance,
  contentRows = 6,
}: DocFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="title"
        label="标题"
        rules={[{ required: true, message: '请输入标题' }]}
      >
        <Input placeholder="如: Orion Pipeline API 参考" />
      </Form.Item>
      <Form.Item
        name="slug"
        label="URL 别名"
        rules={[{ required: true, message: '请输入 URL 别名' }]}
      >
        <Input placeholder="如: pipeline-api-reference" />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={8}>
          <Form.Item name="documentType" label="文档类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(documentTypeConfig).map(([k, v]) => ({
                value: k,
                label: v.label,
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="category" label="分类">
            <Input placeholder="如: 持续集成" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item name="version" label="版本">
            <Input placeholder="v1.0.0" />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="contentFormat" label="内容格式" initialValue="markdown">
        <Select
          options={[
            { value: 'markdown', label: 'Markdown' },
            { value: 'html', label: 'HTML' },
            { value: 'plain', label: '纯文本' },
          ]}
        />
      </Form.Item>
      <Form.Item
        name="content"
        label="内容"
        rules={[{ required: true, message: '请输入内容' }]}
      >
        <Input.TextArea rows={contentRows} placeholder="输入文档内容（支持 Markdown）..." />
      </Form.Item>
      <Form.Item name="tags" label="标签">
        <Select mode="tags" placeholder="输入标签后回车" />
      </Form.Item>
    </Form>
  );
}

export function EditDocForm({ formInstance }: DocFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item name="title" label="标题" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Form.Item name="slug" label="URL 别名" rules={[{ required: true }]}>
        <Input />
      </Form.Item>
      <Row gutter={spacing.md}>
        <Col span={12}>
          <Form.Item name="documentType" label="文档类型" rules={[{ required: true }]}>
            <Select
              options={Object.entries(documentTypeConfig).map(([k, v]) => ({
                value: k,
                label: v.label,
              }))}
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="category" label="分类">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="content" label="内容" rules={[{ required: true }]}>
        <Input.TextArea rows={10} />
      </Form.Item>
      <Form.Item name="tags" label="标签">
        <Select mode="tags" />
      </Form.Item>
    </Form>
  );
}

export function NewVersionForm({ formInstance }: DocFormProps) {
  return (
    <Form form={formInstance} layout="vertical" style={{ marginTop: spacing.md }}>
      <Form.Item
        name="version"
        label="新版本号"
        rules={[{ required: true, message: '请输入版本号' }]}
      >
        <Input placeholder="如: 2.0.0" />
      </Form.Item>
    </Form>
  );
}
