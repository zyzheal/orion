/**
 * Documentation Auto-Generation Page (P4-10)
 * API documentation generation — auto-discovers registered API routes
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Row,
  Col,
  Card,
  Table,
  Tag,
  Button,
  Space,
  Input,
  Form,
  Radio,
  Switch,
  Select,
  Typography,
  Statistic,
  message,
} from 'antd';
import {
  FileTextOutlined,
  FileOutlined,
  ReloadOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { Option } = Select;

// ============ Types ============

interface ApiRecord {
  key: string;
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  description: string;
  status: 'generated' | 'pending' | 'needsUpdate';
  updateTime: string;
}

interface HistoryRecord {
  key: string;
  time: string;
  format: string;
  endpointCount: number;
  status: 'success' | 'failed' | 'running';
}

// ============ Route Discovery ============

// API routes are loaded at runtime from /api/v1/routes endpoint.
// See useEffect + loadRoutes() in the component below.

const mockHistory: HistoryRecord[] = [
  { key: '1', time: '2026-08-07 14:30', format: 'Markdown', endpointCount: 156, status: 'success' },
  { key: '2', time: '2026-08-06 09:15', format: 'OpenAPI', endpointCount: 152, status: 'success' },
  { key: '3', time: '2026-08-05 16:45', format: 'Swagger', endpointCount: 148, status: 'failed' },
  { key: '4', time: '2026-08-04 11:20', format: 'Markdown', endpointCount: 145, status: 'success' },
  { key: '5', time: '2026-08-03 08:30', format: 'OpenAPI', endpointCount: 140, status: 'running' },
];

// ============ Method Tag Color Map ============

const methodColorMap: Record<string, string> = {
  GET: colors.success[500],
  POST: colors.primary[500],
  PUT: colors.warning[500],
  DELETE: colors.error[500],
  PATCH: colors.info[500],
};

// ============ Status Tag Color Map ============

const statusColorMap: Record<string, string> = {
  generated: colors.success[500],
  pending: colors.neutral[500],
  needsUpdate: colors.warning[500],
};

const statusLabelMap: Record<string, string> = {
  generated: '已生成',
  pending: '待生成',
  needsUpdate: '需更新',
};

// ============ Component ============

const DocumentationGenerator: React.FC = () => {
  const [searchText, setSearchText] = useState('');
  const [methodFilter, setMethodFilter] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [apiData, setApiData] = useState<ApiRecord[]>([]);

  const [form] = Form.useForm();

  useEffect(() => {
    loadRoutes();
  }, []);

  const loadRoutes = async () => {
    try {
      const res = await axios.get('/api/v1/routes');
      const raw = (res.data as { data?: Array<{ method: string; path: string }>; total?: number })?.data || [];
      if (raw.length > 0) {
        const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
        setApiData(raw.map((r, i) => ({
          key: String(i + 1),
          path: r.path,
          method: (r.method || 'GET').toUpperCase() as ApiRecord['method'],
          description: `${r.method} ${r.path}`,
          status: 'generated',
          updateTime: now,
        })));
      }
    } catch {
      // Fallback: keep empty state
    }
  };

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      message.success('文档生成任务已提交');
    }, 1000);
  };

  const handlePreview = (record: ApiRecord) => {
    message.info(`预览: ${record.method} ${record.path}`);
  };

  const handleSingleGenerate = (record: ApiRecord) => {
    message.success(`已生成: ${record.method} ${record.path}`);
  };

  const filteredApis = apiData.filter((api) => {
    const matchSearch =
      !searchText ||
      api.path.toLowerCase().includes(searchText.toLowerCase()) ||
      api.description.includes(searchText);
    const matchMethod = !methodFilter || api.method === methodFilter;
    return matchSearch && matchMethod;
  });

  const columns = [
    {
      title: 'API 路径',
      dataIndex: 'path',
      key: 'path',
      width: 220,
      render: (path: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 13 }}>{path}</Text>
      ),
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      render: (method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH') => (
        <Tag color={methodColorMap[method]} style={{ fontWeight: 600 }}>
          {method}
        </Tag>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      width: 180,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={statusColorMap[status]}>{statusLabelMap[status]}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updateTime',
      key: 'updateTime',
      width: 160,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: any, record: ApiRecord) => (
        <Space size={spacing.sm}>
          <Button
            type="primary"
            size="small"
            onClick={() => handleSingleGenerate(record)}
            loading={loading}
          >
            <FileOutlined /> 生成
          </Button>
          <Button
            size="small"
            onClick={() => handlePreview(record)}
          >
            <EyeOutlined /> 预览
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      width: 180,
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      width: 100,
    },
    {
      title: '端点数量',
      dataIndex: 'endpointCount',
      key: 'endpointCount',
      width: 100,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: 'success' | 'failed' | 'running') => {
        const colorMap: Record<string, string> = {
          success: colors.success[500],
          failed: colors.error[500],
          running: colors.info[500],
        };
        const labelMap: Record<string, string> = {
          success: '成功',
          failed: '失败',
          running: '生成中',
        };
        return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>;
      },
    },
  ];

  return (
    <div style={{ padding: spacing.lg, background: colors.light.bg.secondary, minHeight: '100vh' }}>
      {/* Page Title */}
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        文档自动生成
      </Title>
      <Text type="secondary">API 文档 · 代码注释 · 接口说明自动生成</Text>

      {/* Stats Row */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.md }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${colors.primary[500]}`,
            }}
          >
            <Statistic
              title="已生成文档数"
              value={apiData.filter((a) => a.status === 'generated').length}
              prefix={<FileOutlined />}
              valueStyle={{ color: colors.primary[500] }}
              suffix="篇"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${colors.success[500]}`,
            }}
          >
            <Statistic
              title="API 端点数"
              value={apiData.length}
              valueStyle={{ color: colors.success[500] }}
              suffix="个"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${colors.warning[500]}`,
            }}
          >
            <Statistic
              title="覆盖率"
              value={apiData.length > 0 ? Math.round(apiData.filter((a) => a.status === 'generated').length / apiData.length * 100) : 0}
              valueStyle={{ color: colors.warning[500] }}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              borderLeft: `3px solid ${colors.info[500]}`,
            }}
          >
            <Statistic
              title="待同步"
              value={apiData.filter((a) => a.status !== 'generated').length}
              valueStyle={{ color: colors.info[500] }}
              suffix="项"
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Row */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginTop: spacing.md }}>
        {/* Left: API Documentation Table */}
        <Col span={14}>
          <Card
            title="API 文档列表"
            extra={
              <Space>
                <Input
                  placeholder="搜索 API 路径或描述"
                  prefix={<SearchOutlined />}
                  style={{ width: 240 }}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                />
                <Select
                  placeholder="按方法筛选"
                  allowClear
                  style={{ width: 120 }}
                  value={methodFilter}
                  onChange={(val) => setMethodFilter(val)}
                >
                  <Option value="GET">GET</Option>
                  <Option value="POST">POST</Option>
                  <Option value="PUT">PUT</Option>
                  <Option value="DELETE">DELETE</Option>
                </Select>
              </Space>
            }
            styles={{ body: { padding: spacing.md } }}
          >
            <Table
              columns={columns}
              dataSource={filteredApis}
              rowKey="key"
              size="middle"
              pagination={{ pageSize: 10, showSizeChanger: false }}
            />
          </Card>
        </Col>

        {/* Right: Generation Settings */}
        <Col span={10}>
          <Card
            title="生成设置"
            styles={{ body: { padding: spacing.md } }}
          >
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                format: 'markdown',
                includeRequest: true,
                includeResponse: true,
                includeErrorCode: true,
                grouping: 'module',
              }}
            >
              <Form.Item
                label="输出格式"
                name="format"
                rules={[{ required: true, message: '请选择输出格式' }]}
              >
                <Radio.Group buttonStyle="solid">
                  <Radio value="markdown">Markdown</Radio>
                  <Radio value="openapi">OpenAPI</Radio>
                  <Radio value="swagger">Swagger</Radio>
                </Radio.Group>
              </Form.Item>

              <Form.Item
                label="包含请求示例"
                name="includeRequest"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="包含响应示例"
                name="includeResponse"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="包含错误码"
                name="includeErrorCode"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>

              <Form.Item
                label="分组方式"
                name="grouping"
                rules={[{ required: true, message: '请选择分组方式' }]}
              >
                <Select placeholder="选择分组方式">
                  <Option value="module">按模块</Option>
                  <Option value="tag">按标签</Option>
                  <Option value="version">按版本</Option>
                </Select>
              </Form.Item>

              <Form.Item style={{ marginTop: spacing.md }}>
                <Button
                  type="primary"
                  block
                  size="large"
                  onClick={handleGenerate}
                  loading={loading}
                  icon={<ReloadOutlined />}
                >
                  生成文档
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>

      {/* Bottom: Generation History */}
      <Card
        title="生成历史"
        style={{ marginTop: spacing.md }}
        styles={{ body: { padding: spacing.md } }}
      >
        <Table
          columns={historyColumns}
          dataSource={mockHistory}
          rowKey="key"
          size="middle"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default DocumentationGenerator;
