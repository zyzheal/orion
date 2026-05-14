/**
 * Rate Limiting Page (Workflow 6: Rate Limiting & Circuit Breaker)
 *
 * Features:
 * - Rate limit rule list with CRUD operations
 * - Enable/disable toggle
 * - Create/edit rule with strategy selection
 * - Stats overview
 *
 * Backend API: Not yet available - uses graceful fallback
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Switch,
  message,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import {
  getRateLimits,
  createRateLimit,
  updateRateLimit,
  deleteRateLimit,
  toggleRateLimit,
  getRateLimitStats,
  type RateLimitRule,
  type RateLimitStats,
} from '@/api/rate-limiting';

const { Title, Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const METHOD_OPTIONS = [
  { label: 'ALL', value: 'ALL' },
  { label: 'GET', value: 'GET' },
  { label: 'POST', value: 'POST' },
  { label: 'PUT', value: 'PUT' },
  { label: 'DELETE', value: 'DELETE' },
  { label: 'PATCH', value: 'PATCH' },
];

const STRATEGY_OPTIONS = [
  { label: '固定窗口', value: 'fixed' },
  { label: '滑动窗口', value: 'sliding' },
  { label: '令牌桶', value: 'token-bucket' },
];

const strategyColor: Record<string, string> = {
  fixed: colors.info[500],
  sliding: colors.purple[500],
  'token-bucket': colors.success[500],
};

const strategyLabel: Record<string, string> = {
  fixed: '固定窗口',
  sliding: '滑动窗口',
  'token-bucket': '令牌桶',
};

// ============================================================================
// Main Component
// ============================================================================

const RateLimitingPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rules, setRules] = useState<RateLimitRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<RateLimitRule | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<RateLimitStats | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Data Loading ----

  const loadRules = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await getRateLimits();
      setRules(response.data?.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      setApiError(err.message);
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await getRateLimitStats();
      setStats(response.data?.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadRules();
    loadStats();
  }, [loadRules, loadStats]);

  // ---- Filtering ----

  const filteredRules = rules.filter((r) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.endpoint.toLowerCase().includes(q)) return false;
    }
    if (methodFilter !== 'all' && r.method !== methodFilter) return false;
    return true;
  });

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createRateLimit({
        name: values.name,
        endpoint: values.endpoint,
        method: values.method || 'ALL',
        maxRequests: values.maxRequests,
        windowSeconds: values.windowSeconds,
        strategy: values.strategy || 'fixed',
        enabled: values.enabled ?? true,
      });
      message.success('限流规则创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadRules();
      await loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && (error as any).errorFields)) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingRule) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateRateLimit(editingRule.id, {
        name: values.name,
        endpoint: values.endpoint,
        method: values.method,
        maxRequests: values.maxRequests,
        windowSeconds: values.windowSeconds,
        strategy: values.strategy,
      });
      message.success('规则更新成功');
      setEditModalVisible(false);
      setEditingRule(null);
      editForm.resetFields();
      await loadRules();
    } catch (error: unknown) {
      if (!(error instanceof Error && (error as any).errorFields)) {
        message.error(`更新失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (rule: RateLimitRule) => {
    try {
      await deleteRateLimit(rule.id);
      message.success('规则已删除');
      await loadRules();
      await loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleToggle = async (rule: RateLimitRule, enabled: boolean) => {
    try {
      await toggleRateLimit(rule.id, enabled);
      setRules((prev) => prev.map((r) => (r.id === rule.id ? { ...r, enabled } : r)));
      message.success(`规则 "${rule.name}" 已${enabled ? '启用' : '禁用'}`);
    } catch (error: unknown) {
      message.error(`操作失败: ${(error as Error).message}`);
    }
  };

  const openEdit = (rule: RateLimitRule) => {
    setEditingRule(rule);
    editForm.setFieldsValue({
      name: rule.name,
      endpoint: rule.endpoint,
      method: rule.method,
      maxRequests: rule.maxRequests,
      windowSeconds: rule.windowSeconds,
      strategy: rule.strategy,
    });
    setEditModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: ColumnsType<RateLimitRule> = [
    {
      title: '规则名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      width: 200,
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: '方法',
      dataIndex: 'method',
      key: 'method',
      width: 80,
      filters: METHOD_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.method === value,
      render: (method: string) => <Tag>{method}</Tag>,
    },
    {
      title: '限制',
      key: 'limit',
      width: 120,
      render: (_: unknown, record) => (
        <Text>{record.maxRequests} 次 / {record.windowSeconds}s</Text>
      ),
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 100,
      render: (strategy: string) => (
        <Tag color={strategyColor[strategy]}>{strategyLabel[strategy]}</Tag>
      ),
    },
    {
      title: '启用',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record) => (
        <Switch
          size="small"
          checked={record.enabled}
          onChange={(checked) => handleToggle(record, checked)}
          checkedChildren="开"
          unCheckedChildren="关"
        />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 140,
      render: (value: string) => <Text type="secondary">{dayjs(value).fromNow()}</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除该规则?" onConfirm={() => handleDelete(record)}>
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const filterDefinitions: FilterDefinition[] = [
    {
      key: 'method',
      label: 'HTTP 方法',
      options: [{ label: '全部', value: 'all' }, ...METHOD_OPTIONS],
      placeholder: '按方法筛选',
    },
  ];

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ThunderboltOutlined style={{ marginRight: spacing[2], color: colors.warning[500] }} />
            限流管理
          </Title>
          <Text type="secondary">配置和管理 API 速率限制规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadRules} loading={loading}>
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              createForm.resetFields();
              setCreateModalVisible(true);
            }}
          >
            创建规则
          </Button>
        </Space>
      </div>

      {/* API Warning */}
      {apiError && (
        <Alert
          message="后端 API 尚未就绪"
          description={`限流管理功能的后端接口尚未实现 (${apiError})。页面已准备好，等待后端完成后启用。`}
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: spacing[4] }}
        />
      )}

      {/* Stats Cards */}
      {stats && (
        <div style={{ marginBottom: spacing[6] }}>
          <Row gutter={spacing[4]}>
            <Col span={6}>
              <MetricCard title="规则总数" value={stats.totalRules} />
            </Col>
            <Col span={6}>
              <MetricCard title="活跃规则" value={stats.activeRules} color={colors.success[500]} />
            </Col>
            <Col span={6}>
              <MetricCard title="总请求数" value={stats.totalRequests} />
            </Col>
            <Col span={6}>
              <MetricCard title="拒绝率" value={`${(stats.rejectionRate * 100).toFixed(2)}%`} />
            </Col>
          </Row>
        </div>
      )}

      {/* Rule Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索规则名称或端点..."
            onFilter={(filters) => {
              if (filters.method) setMethodFilter(String(filters.method));
            }}
            initialFilters={{ method: 'all' }}
          />
        </div>

        <Table<RateLimitRule>
          columns={columns}
          dataSource={filteredRules}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 条规则` }}
          locale={{ emptyText: apiError ? 'API 不可用，暂无数据' : '暂无限流规则' }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建限流规则"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input placeholder="如: API 全局限流" />
          </Form.Item>
          <Form.Item name="endpoint" label="端点路径" rules={[{ required: true }]}>
            <Input placeholder="/api/v1/..." />
          </Form.Item>
          <Form.Item name="method" label="HTTP 方法" initialValue="ALL">
            <Select>
              {METHOD_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="maxRequests" label="最大请求数" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="100" />
          </Form.Item>
          <Form.Item name="windowSeconds" label="时间窗口 (秒)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} placeholder="60" />
          </Form.Item>
          <Form.Item name="strategy" label="限流策略" initialValue="fixed">
            <Select>
              {STRATEGY_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="enabled" label="启用状态" valuePropName="checked" initialValue={true}>
            <Select>
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑限流规则"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingRule(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="endpoint" label="端点路径" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="method" label="HTTP 方法" rules={[{ required: true }]}>
            <Select>
              {METHOD_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="maxRequests" label="最大请求数" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="windowSeconds" label="时间窗口 (秒)" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="strategy" label="限流策略" rules={[{ required: true }]}>
            <Select>
              {STRATEGY_OPTIONS.map((o) => (
                <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RateLimitingPage;
