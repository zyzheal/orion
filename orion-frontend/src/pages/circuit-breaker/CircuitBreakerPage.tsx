/**
 * Circuit Breaker Page (Workflow 6: Rate Limiting & Circuit Breaker)
 *
 * Features:
 * - Circuit breaker list with status visualization
 * - Create/edit/delete circuit breaker configs
 * - Reset circuit breaker to closed state
 * - Stats overview with state distribution
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
  InputNumber,
  Row,
  Col,
  Tooltip,
  Popconfirm,
  Alert,
  Progress,
  Descriptions,
  Select,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  RestOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import {
  getCircuitBreakers,
  createCircuitBreaker,
  updateCircuitBreaker,
  deleteCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerStats,
  type CircuitBreakerConfig,
  type CircuitBreakerStats,
  type CircuitState,
} from '@/api/circuit-breaker';

const { Title, Text } = Typography;

// ============================================================================
// Constants
// ============================================================================

const stateColor: Record<CircuitState, string> = {
  closed: colors.success[500],
  open: colors.error[500],
  'half-open': colors.warning[500],
};

const stateLabel: Record<CircuitState, string> = {
  closed: '正常',
  open: '熔断',
  'half-open': '半开',
};

const stateIcon: Record<CircuitState, React.ReactNode> = {
  closed: <CheckCircleOutlined />,
  open: <CloseCircleOutlined />,
  'half-open': <SyncOutlined spin />,
};

// ============================================================================
// Main Component
// ============================================================================

const CircuitBreakerPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [breakers, setBreakers] = useState<CircuitBreakerConfig[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingBreaker, setEditingBreaker] = useState<CircuitBreakerConfig | null>(null);
  const [selectedBreaker, setSelectedBreaker] = useState<CircuitBreakerConfig | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<CircuitBreakerStats | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Data Loading ----

  const loadBreakers = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await getCircuitBreakers();
      setBreakers(response.data?.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      setApiError(err.message);
      setBreakers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await getCircuitBreakerStats();
      setStats(response.data?.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadBreakers();
    loadStats();
  }, [loadBreakers, loadStats]);

  // ---- Filtering ----

  const filteredBreakers = breakers.filter((b) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!b.name.toLowerCase().includes(q) && !b.service.toLowerCase().includes(q)) return false;
    }
    if (stateFilter !== 'all' && b.state !== stateFilter) return false;
    return true;
  });

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createCircuitBreaker({
        name: values.name,
        service: values.service,
        endpoint: values.endpoint || undefined,
        failureThreshold: values.failureThreshold,
        successThreshold: values.successThreshold,
        timeoutSeconds: values.timeoutSeconds,
        halfOpenMaxRequests: values.halfOpenMaxRequests,
        enabled: values.enabled ?? true,
        state: 'closed',
      });
      message.success('熔断器创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`创建失败: ${error.message}`);
      } else {
        message.error('创建失败: 未知错误');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingBreaker) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateCircuitBreaker(editingBreaker.id, {
        name: values.name,
        service: values.service,
        endpoint: values.endpoint || undefined,
        failureThreshold: values.failureThreshold,
        successThreshold: values.successThreshold,
        timeoutSeconds: values.timeoutSeconds,
        halfOpenMaxRequests: values.halfOpenMaxRequests,
      });
      message.success('配置更新成功');
      setEditModalVisible(false);
      setEditingBreaker(null);
      editForm.resetFields();
      await loadBreakers();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`更新失败: ${error.message}`);
      } else {
        message.error('更新失败: 未知错误');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (breaker: CircuitBreakerConfig) => {
    try {
      await deleteCircuitBreaker(breaker.id);
      message.success('熔断器已删除');
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  const handleReset = async (breaker: CircuitBreakerConfig) => {
    try {
      await resetCircuitBreaker(breaker.id);
      message.success('熔断器已重置');
      await loadBreakers();
      await loadStats();
    } catch (error: unknown) {
      message.error(`重置失败: ${(error as Error).message}`);
    }
  };

  const openEdit = (breaker: CircuitBreakerConfig) => {
    setEditingBreaker(breaker);
    editForm.setFieldsValue({
      name: breaker.name,
      service: breaker.service,
      endpoint: breaker.endpoint || '',
      failureThreshold: breaker.failureThreshold,
      successThreshold: breaker.successThreshold,
      timeoutSeconds: breaker.timeoutSeconds,
      halfOpenMaxRequests: breaker.halfOpenMaxRequests,
    });
    setEditModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: ColumnsType<CircuitBreakerConfig> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '服务',
      dataIndex: 'service',
      key: 'service',
      width: 140,
      render: (text: string) => <Text code>{text}</Text>,
    },
    {
      title: '端点',
      dataIndex: 'endpoint',
      key: 'endpoint',
      width: 160,
      ellipsis: true,
      render: (text?: string) => (text ? <Text code style={{ fontSize: 12 }}>{text}</Text> : '-'),
    },
    {
      title: '状态',
      dataIndex: 'state',
      key: 'state',
      width: 100,
      filters: Object.entries(stateLabel).map(([value, text]) => ({ text, value })),
      onFilter: (value, record) => record.state === value,
      render: (state: CircuitState) => (
        <Tag color={stateColor[state]} icon={stateIcon[state]}>
          {stateLabel[state]}
        </Tag>
      ),
    },
    {
      title: '失败阈值',
      key: 'threshold',
      width: 100,
      render: (_: unknown, record) => (
        <Text>{record.failureThreshold} 次 / {record.timeoutSeconds}s</Text>
      ),
    },
    {
      title: '失败率',
      key: 'failureRate',
      width: 120,
      render: (_: unknown, record) => {
        const rate = record.totalRequests > 0
          ? Math.round((record.totalFailures / record.totalRequests) * 100)
          : 0;
        return (
          <Progress
            percent={rate}
            size="small"
            strokeColor={
              rate > 50 ? colors.error[500] : rate > 20 ? colors.warning[500] : colors.success[500]
            }
            format={() => `${rate}%`}
          />
        );
      },
    },
    {
      title: '启用',
      key: 'enabled',
      width: 80,
      render: (_: unknown, record) => (
        <Switch
          size="small"
          checked={record.enabled}
          checkedChildren="开"
          unCheckedChildren="关"
          onChange={(checked) => {
            setBreakers((prev) =>
              prev.map((b) => (b.id === record.id ? { ...b, enabled: checked } : b))
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedBreaker(record); setDetailModalVisible(true); }} />
          </Tooltip>
          <Tooltip title="重置">
            <Button type="link" size="small" icon={<RestOutlined />} onClick={() => handleReset(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} />
          </Tooltip>
          <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record)}>
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
      key: 'state',
      label: '熔断状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '正常', value: 'closed' },
        { label: '熔断', value: 'open' },
        { label: '半开', value: 'half-open' },
      ],
      placeholder: '按状态筛选',
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
          <Title level={2} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: spacing[2], color: colors.error[500] }} />
            熔断器管理
          </Title>
          <Text type="secondary">配置和管理服务熔断策略，防止级联故障</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadBreakers} loading={loading}>
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
            创建熔断器
          </Button>
        </Space>
      </div>

      {/* API Warning */}
      {apiError && (
        <Alert
          message="后端 API 尚未就绪"
          description={`熔断器管理功能的后端接口尚未实现 (${apiError})。页面已准备好，等待后端完成后启用。`}
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
            <Col span={4}>
              <MetricCard title="熔断器总数" value={stats.totalBreakers} />
            </Col>
            <Col span={4}>
              <MetricCard title="正常" value={stats.closedCount} color={colors.success[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="已熔断" value={stats.openCount} color={colors.error[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="半开" value={stats.halfOpenCount} color={colors.warning[500]} />
            </Col>
            <Col span={4}>
              <MetricCard title="总请求" value={stats.totalRequests} />
            </Col>
            <Col span={4}>
              <MetricCard title="总失败" value={stats.totalFailures} />
            </Col>
          </Row>
        </div>
      )}

      {/* Breaker Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索熔断器名称或服务..."
            onFilter={(filters) => {
              if (filters.state) setStateFilter(String(filters.state));
            }}
            initialFilters={{ state: 'all' }}
          />
        </div>

        <Table<CircuitBreakerConfig>
          columns={columns}
          dataSource={filteredBreakers}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 个熔断器` }}
          locale={{ emptyText: apiError ? 'API 不可用，暂无数据' : '暂无熔断器配置' }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建熔断器"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="熔断器名称" rules={[{ required: true }]}>
            <Input placeholder="如: 用户服务熔断器" />
          </Form.Item>
          <Form.Item name="service" label="服务名称" rules={[{ required: true }]}>
            <Input placeholder="user-service" />
          </Form.Item>
          <Form.Item name="endpoint" label="端点 (可选)">
            <Input placeholder="/api/users" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="failureThreshold" label="失败阈值" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="5" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="successThreshold" label="恢复阈值" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="timeoutSeconds" label="超时时间 (秒)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="30" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="halfOpenMaxRequests" label="半开最大请求" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="3" />
              </Form.Item>
            </Col>
          </Row>
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
        title="编辑熔断器"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingBreaker(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="熔断器名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="service" label="服务名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="endpoint" label="端点">
            <Input />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="failureThreshold" label="失败阈值" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="successThreshold" label="恢复阈值" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="timeoutSeconds" label="超时时间 (秒)" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="halfOpenMaxRequests" label="半开最大请求" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selectedBreaker ? `熔断器详情: ${selectedBreaker.name}` : '详情'}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedBreaker(null);
        }}
        footer={[
          <Button key="close" onClick={() => { setDetailModalVisible(false); setSelectedBreaker(null); }}>
            关闭
          </Button>,
        ]}
        width={650}
      >
        {selectedBreaker && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedBreaker.name}</Descriptions.Item>
            <Descriptions.Item label="服务">{selectedBreaker.service}</Descriptions.Item>
            <Descriptions.Item label="端点">{selectedBreaker.endpoint || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={stateColor[selectedBreaker.state]} icon={stateIcon[selectedBreaker.state]}>
                {stateLabel[selectedBreaker.state]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="失败阈值">{selectedBreaker.failureThreshold}</Descriptions.Item>
            <Descriptions.Item label="恢复阈值">{selectedBreaker.successThreshold}</Descriptions.Item>
            <Descriptions.Item label="超时时间">{selectedBreaker.timeoutSeconds}s</Descriptions.Item>
            <Descriptions.Item label="半开最大请求">{selectedBreaker.halfOpenMaxRequests}</Descriptions.Item>
            <Descriptions.Item label="当前失败数">{selectedBreaker.failureCount}</Descriptions.Item>
            <Descriptions.Item label="当前成功数">{selectedBreaker.successCount}</Descriptions.Item>
            <Descriptions.Item label="总请求数">{selectedBreaker.totalRequests}</Descriptions.Item>
            <Descriptions.Item label="总失败数">{selectedBreaker.totalFailures}</Descriptions.Item>
            <Descriptions.Item label="启用">{selectedBreaker.enabled ? '是' : '否'}</Descriptions.Item>
            <Descriptions.Item label="最后状态变更">
              {selectedBreaker.lastStateChange ? dayjs(selectedBreaker.lastStateChange).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default CircuitBreakerPage;
