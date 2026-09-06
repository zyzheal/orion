/**
 * Developer Portal — Online Playground tab: request builder + response viewer.
 */
import type { ReactNode } from 'react';
import {
  Card,
  Form,
  Row,
  Col,
  Input,
  Select,
  Space,
  Tag,
  Tooltip,
  Spin,
  Divider,
  Button,
  Typography,
  Empty,
} from 'antd';
import {
  SendOutlined,
  ThunderboltOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { FormInstance } from 'antd';
import { spacing, themeVars } from '@/tokens';
import { EMPTY_STATES, httpMethods, playgroundBodyTypes } from './constants';
import type { PlaygroundExecuteResult } from './types';

const { TextArea } = Input;
const { Text } = Typography;

interface PlaygroundPanelProps {
  form: FormInstance;
  pgExecuting: boolean;
  result: PlaygroundExecuteResult | null;
  onSubmit: (values: unknown) => void;
  onCopy: (text: string) => void;
}

/** Status tag color bucket for a response status code. */
function statusTagColor(code: number): string {
  if (code < 300) return 'green';
  if (code < 400) return 'blue';
  return 'red';
}

export function PlaygroundPanel({
  form,
  pgExecuting,
  result,
  onSubmit,
  onCopy,
}: PlaygroundPanelProps) {
  return (
    <Row gutter={16}>
      {/* Request Form */}
      <Col span={12}>
        <Card
          title={
            <>
              <SendOutlined style={{ marginRight: spacing.sm }} />
              请求构建器
            </>
          }
          style={{ marginBottom: spacing.md }}
        >
          <PlaygroundRequestForm form={form} pgExecuting={pgExecuting} onSubmit={onSubmit} />
        </Card>
      </Col>

      {/* Response */}
      <Col span={12}>
        <Card
          title={
            <>
              <ThunderboltOutlined style={{ marginRight: spacing.sm }} />
              响应结果
            </>
          }
          style={{ marginBottom: spacing.md }}
          extra={
            result && (
              <Space>
                <Tag color={statusTagColor(result.response.statusCode)}>
                  {result.response.statusCode} {result.response.statusText}
                </Tag>
                <Tag>{result.response.latencyMs}ms</Tag>
                <Tooltip title="复制响应">
                  <Button
                    type="link"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => onCopy(result.response.body)}
                  />
                </Tooltip>
              </Space>
            )
          }
        >
          <PlaygroundResponse result={result} pgExecuting={pgExecuting} />
        </Card>
      </Col>
    </Row>
  );
}

interface RequestFormProps {
  form: FormInstance;
  pgExecuting: boolean;
  onSubmit: (values: unknown) => void;
}

export function PlaygroundRequestForm({ form, pgExecuting, onSubmit }: RequestFormProps) {
  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={(values) => onSubmit(values)}
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
        <TextArea rows={2} placeholder='{"Authorization": "Bearer xxx"}' />
      </Form.Item>
      <Form.Item name="queryParams" label="Query Params (JSON)">
        <TextArea rows={2} placeholder='{"page": "1", "limit": "10"}' />
      </Form.Item>
      <Row gutter={12}>
        <Col span={6}>
          <Form.Item name="bodyType" label="Body 类型">
            <Select options={playgroundBodyTypes} />
          </Form.Item>
        </Col>
        <Col span={18}>
          <Form.Item name="body" label="Body">
            <TextArea rows={4} placeholder='{"key": "value"}' />
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

interface ResponseProps {
  result: PlaygroundExecuteResult | null;
  pgExecuting: boolean;
}

export function PlaygroundResponse({ result, pgExecuting }: ResponseProps): ReactNode {
  if (pgExecuting) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin tip="请求中..." />
      </div>
    );
  }

  if (!result) {
    return <Empty description={EMPTY_STATES.playground} />;
  }

  return (
    <div>
      <Divider style={{ margin: '8px 0' }}>响应 Headers</Divider>
      <div style={{ marginBottom: spacing.sm }}>
        {Object.entries(result.response.headers).map(([k, v]) => (
          <Tag key={String(k)} style={{ marginBottom: 4 }}>
            <Text code style={{ fontSize: 11 }}>
              {k}: {v}
            </Text>
          </Tag>
        ))}
      </div>
      <Divider style={{ margin: '8px 0' }}>响应 Body</Divider>
      <pre
        style={{
          background: themeVars.bgTertiary,
          padding: spacing[3],
          borderRadius: 8,
          maxHeight: 300,
          overflow: 'auto',
          fontSize: 12,
        }}
      >
        {result.response.body}
      </pre>
    </div>
  );
}
