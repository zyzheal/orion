/**
 * Prompt Canary Management Page (TR-06)
 *
 * RAG Prompt 灰度发布管理 — 发布 Prompt 新版本为 Canary，
 * 按 callerID 稳定散列分流，支持灰度状态查看和版本管理。
 * 后端 /api/v1/knowledge/rag/prompt/canary 已实现。
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Table,
  Statistic,
  message,
  Empty,
  Row,
  Col,
  Descriptions,
  Slider,
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  CodeOutlined,
  ReloadOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;

// --- Types ---

interface PromptVersionInfo {
  id: string;
  name: string;
  version: string;
  is_active: boolean;
  is_canary: boolean;
  traffic_percent: number;
  content_preview?: string;
  created_at?: string;
}

interface PromptCanaryStatus {
  name: string;
  active_version: string;
  canary_version?: string;
  traffic_percent: number;
  versions: PromptVersionInfo[];
}

// --- API Client ---

async function apiCall<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`/api/v1/knowledge${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      ...options?.headers,
    },
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${resp.status}`);
  }
  const json = await resp.json();
  return json.data as T;
}

// --- Page Component ---

const PromptCanary: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<PromptCanaryStatus[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptCanaryStatus | null>(null);
  const [createForm] = Form.useForm<{
    name: string;
    content: string;
    version: string;
    traffic_percent: number;
  }>();

  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      // Query a set of known prompt names
      const knownPrompts = ['rag-retrieve', 'rag-summarize', 'rag-question-answer', 'incident-rca'];
      const results = await Promise.allSettled(
        knownPrompts.map((name) => apiCall<PromptCanaryStatus>(`/rag/prompt/canary/${name}`))
      );
      const loaded = results
        .filter((r): r is PromiseFulfilledResult<PromptCanaryStatus> => r.status === 'fulfilled')
        .map((r) => r.value);
      setStatuses(loaded);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePublishCanary = async () => {
    const values = await createForm.validateFields();
    try {
      await apiCall<PromptVersionInfo>('/rag/prompt/canary', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          content: values.content,
          version: values.version,
          traffic_percent: values.traffic_percent,
        }),
      });
      message.success(`Prompt "${values.name}" 已发布为 Canary (v${values.version})`);
      setCreateModalOpen(false);
      createForm.resetFields();
      loadPrompts();
    } catch (error: unknown) {
      message.error(`发布失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleViewDetail = async (name: string) => {
    try {
      const status = await apiCall<PromptCanaryStatus>(`/rag/prompt/canary/${name}`);
      setSelectedPrompt(status);
      setDetailModalOpen(true);
    } catch (error: unknown) {
      message.error(`加载失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const versionColumns: ColumnsType<PromptVersionInfo> = useMemo(
    () => [
      {
        title: '版本 ID',
        dataIndex: 'version',
        key: 'version',
        render: (val: string) => <Tag>v{val}</Tag>,
      },
      {
        title: '角色',
        key: 'role',
        width: 120,
        render: (_, record: PromptVersionInfo) => {
          if (record.is_active) return <Tag color="green">Active</Tag>;
          if (record.is_canary) return <Tag color="orange">Canary</Tag>;
          return <Tag>历史</Tag>;
        },
      },
      {
        title: '流量占比',
        dataIndex: 'traffic_percent',
        key: 'traffic_percent',
        width: 100,
        render: (val: number) => `${val}%`,
      },
      {
        title: '内容预览',
        dataIndex: 'content_preview',
        key: 'content_preview',
        ellipsis: { showTitle: true },
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        key: 'created_at',
        width: 160,
      },
    ],
    []
  );

  const promptColumns: ColumnsType<PromptCanaryStatus> = useMemo(
    () => [
      {
        title: 'Prompt 名称',
        dataIndex: 'name',
        key: 'name',
        render: (val: string) => (
          <Space>
            <CodeOutlined />
            <Text strong>{val}</Text>
          </Space>
        ),
      },
      {
        title: 'Active 版本',
        dataIndex: 'active_version',
        key: 'active_version',
        render: (val: string) => <Tag color="green">v{val}</Tag>,
      },
      {
        title: 'Canary 版本',
        key: 'canary_version',
        render: (_, record: PromptCanaryStatus) =>
          record.canary_version ? (
            <Tag color="orange">
              v{record.canary_version} ({record.traffic_percent}%)
            </Tag>
          ) : (
            <Tag>-</Tag>
          ),
      },
      {
        title: '版本总数',
        key: 'version_count',
        render: (_, record: PromptCanaryStatus) => record.versions?.length || 0,
        width: 100,
      },
      {
        title: '操作',
        key: 'actions',
        width: 100,
        render: (_, record: PromptCanaryStatus) => (
          <Button
            size="small"
            type="primary"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.name)}
          >
            详情
          </Button>
        ),
      },
    ],
    []
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <BranchesOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        Prompt Canary 管理
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        管理 RAG Prompt 的灰度发布。发布新版本为 Canary 后，按 callerID 稳定散列分流，支持逐步放量。
      </Text>

      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="Prompt 数量" value={statuses.length} prefix={<CodeOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="活跃 Canary"
              value={statuses.filter((s) => s.canary_version).length}
              valueStyle={{ color: colors.purple[500] }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="版本总数"
              value={statuses.reduce((sum, s) => sum + (s.versions?.length || 0), 0)}
              prefix={<PlusOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="平均灰度流量"
              value={
                statuses.length > 0
                  ? `${(statuses.reduce((sum, s) => sum + (s.traffic_percent || 0), 0) / statuses.length).toFixed(0)}%`
                  : '0%'
              }
              valueStyle={{ color: colors.success[500] }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="Prompt 列表"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={loadPrompts}>
              刷新
            </Button>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setCreateModalOpen(true)}
            >
              发布 Canary
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={statuses}
          columns={promptColumns}
          rowKey="name"
          loading={loading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无 Prompt 配置" /> }}
        />
      </Card>

      {/* Publish Canary Modal */}
      <Modal
        title="发布 Prompt Canary"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={handlePublishCanary}
        okText="发布"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            label="Prompt 名称"
            name="name"
            rules={[{ required: true, message: '请输入 Prompt 名称' }]}
          >
            <Input placeholder="例: rag-retrieve" />
          </Form.Item>
          <Form.Item
            label="新版本内容"
            name="content"
            rules={[{ required: true, message: '请输入 Prompt 内容' }]}
          >
            <TextArea rows={6} placeholder="输入新的 Prompt 模板内容..." />
          </Form.Item>
          <Form.Item
            label="版本号"
            name="version"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例: 2.0" />
          </Form.Item>
          <Form.Item
            label="灰度流量占比 (%)"
            name="traffic_percent"
            initialValue={10}
            rules={[{ required: true, message: '请设置流量占比' }]}
          >
            <Slider min={1} max={100} marks={{ 10: '10%', 50: '50%', 100: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      {selectedPrompt && (
        <Modal
          title={
            <span>
              <CodeOutlined />
              {' Prompt 详情: '}
              {selectedPrompt.name}
            </span>
          }
          open={detailModalOpen}
          onCancel={() => setDetailModalOpen(false)}
          footer={null}
          width={800}
        >
          <Descriptions column={2} bordered size="small" style={{ marginBottom: spacing.md }}>
            <Descriptions.Item label="Prompt 名称">{selectedPrompt.name}</Descriptions.Item>
            <Descriptions.Item label="Active 版本">
              <Tag color="green">v{selectedPrompt.active_version}</Tag>
            </Descriptions.Item>
            {selectedPrompt.canary_version && (
              <Descriptions.Item label="Canary 版本">
                <Tag color="orange">
                  v{selectedPrompt.canary_version} ({selectedPrompt.traffic_percent}%)
                </Tag>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="版本总数">
              {selectedPrompt.versions?.length || 0}
            </Descriptions.Item>
          </Descriptions>

          {selectedPrompt.versions && selectedPrompt.versions.length > 0 ? (
            <Table
              dataSource={selectedPrompt.versions}
              columns={versionColumns}
              rowKey="id"
              size="small"
              pagination={false}
            />
          ) : (
            <Empty description="暂无版本" />
          )}
        </Modal>
      )}
    </div>
  );
};

export default PromptCanary;
