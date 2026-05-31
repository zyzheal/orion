/**
 * Feature Flags Page (Workflow 10: Feature Flag Enhancement)
 *
 * Features:
 * - Feature flag list with toggle controls
 * - Per-tenant/user-group grayscale configuration
 * - Create/edit/delete flags
 * - Evaluate flag for specific context
 * - Evaluation statistics
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
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  WarningOutlined,
  EyeOutlined,
  FlagOutlined,} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import MetricCard from '@/components/MetricCard';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { colors, spacing } from '@/tokens';
import {
  getFeatureFlags,
  createFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
  toggleFeatureFlag,
  evaluateFeatureFlag,
  getFeatureFlagStats,
  type FeatureFlag,
  type FeatureFlagStats,
  type FlagType,
  type FlagStrategy,
} from '@/api/feature-flags';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Constants
// ============================================================================

const FLAG_TYPE_OPTIONS = [
  { label: '布尔值', value: 'boolean' },
  { label: '百分比', value: 'percentage' },
  { label: '字符串', value: 'string' },
  { label: '数值', value: 'number' },
];

const STRATEGY_OPTIONS = [
  { label: '默认', value: 'default' },
  { label: '按租户', value: 'tenant' },
  { label: '按用户组', value: 'user-group' },
  { label: '百分比灰度', value: 'percentage' },
];

const typeColor: Record<FlagType, string> = {
  boolean: colors.info[500],
  percentage: colors.purple[500],
  string: colors.success[500],
  number: colors.warning[500],
};

const typeLabel: Record<FlagType, string> = {
  boolean: '布尔',
  percentage: '百分比',
  string: '字符串',
  number: '数值',
};

const strategyLabel: Record<FlagStrategy, string> = {
  default: '默认',
  tenant: '租户',
  'user-group': '用户组',
  percentage: '百分比',
};

// ============================================================================
// Main Component
// ============================================================================

const FeatureFlagsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);
  const [evaluatingFlag, setEvaluatingFlag] = useState<FeatureFlag | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [evaluateForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState<FeatureFlagStats | null>(null);
  const [evaluationResult, setEvaluationResult] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  // ---- Data Loading ----

  const loadFlags = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const response = await getFeatureFlags();
      setFlags(response.data || []);
    } catch (error: unknown) {
      const err = error as Error;
      setApiError(err.message);
      setFlags([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const response = await getFeatureFlagStats();
      setStats(response.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadFlags();
    loadStats();
  }, [loadFlags, loadStats]);

  // ---- Filtering ----

  const filteredFlags = flags.filter((f) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!f.name.toLowerCase().includes(q) && !f.key.toLowerCase().includes(q)) return false;
    }
    if (typeFilter !== 'all' && f.type !== typeFilter) return false;
    if (strategyFilter !== 'all' && f.strategy !== strategyFilter) return false;
    return true;
  });

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createFeatureFlag({
        name: values.name,
        key: values.key,
        description: values.description || '',
        type: values.type,
        defaultValue: String(values.defaultValue),
        strategy: values.strategy || 'default',
        enabled: values.enabled ?? true,
        tenantId: values.tenantId || undefined,
        userGroups: values.userGroups
          ? values.userGroups.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        percentage: values.percentage || undefined,
      });
      message.success('特性开关创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      await loadFlags();
      await loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error)) {
        message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingFlag) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      await updateFeatureFlag(editingFlag.id, {
        name: values.name,
        key: values.key,
        description: values.description,
        type: values.type,
        defaultValue: String(values.defaultValue),
        strategy: values.strategy,
        tenantId: values.tenantId || undefined,
        userGroups: values.userGroups
          ? values.userGroups.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
        percentage: values.percentage || undefined,
      });
      message.success('特性开关更新成功');
      setEditModalVisible(false);
      setEditingFlag(null);
      editForm.resetFields();
      await loadFlags();
    } catch (error: unknown) {
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (flag: FeatureFlag) => {
    try {
      await deleteFeatureFlag(flag.id);
      message.success('特性开关已删除');
      await loadFlags();
      await loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggle = async (flag: FeatureFlag, enabled: boolean) => {
    try {
      await toggleFeatureFlag(flag.id, enabled);
      setFlags((prev) => prev.map((f) => (f.id === flag.id ? { ...f, enabled } : f)));
      message.success(`"${flag.name}" 已${enabled ? '启用' : '禁用'}`);
      await loadStats();
    } catch (error: unknown) {
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleEvaluate = async () => {
    if (!evaluatingFlag) return;
    try {
      const values = await evaluateForm.validateFields();
      setSubmitting(true);
      const result = await evaluateFeatureFlag(evaluatingFlag.id, {
        tenantId: values.tenantId || undefined,
        userId: values.userId || undefined,
        userGroups: values.userGroups
          ? values.userGroups.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      });
      setEvaluationResult(String(result.data?.result ?? '未知'));
      message.success('评估完成');
    } catch (error: unknown) {
      message.error(`评估失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    editForm.setFieldsValue({
      name: flag.name,
      key: flag.key,
      description: flag.description,
      type: flag.type,
      defaultValue: flag.defaultValue,
      strategy: flag.strategy,
      tenantId: flag.tenantId || '',
      userGroups: (flag.userGroups || []).join(', '),
      percentage: flag.percentage || undefined,
    });
    setEditModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: ColumnsType<FeatureFlag> = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      width: 160,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Key',
      dataIndex: 'key',
      key: 'key',
      width: 180,
      render: (text: string) => <Text code style={{ fontSize: 12 }}>{text}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      filters: FLAG_TYPE_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.type === value,
      render: (type: FlagType) => <Tag color={typeColor[type]}>{typeLabel[type]}</Tag>,
    },
    {
      title: '策略',
      dataIndex: 'strategy',
      key: 'strategy',
      width: 100,
      filters: STRATEGY_OPTIONS.map((o) => ({ text: o.label, value: o.value })),
      onFilter: (value, record) => record.strategy === value,
      render: (strategy: FlagStrategy) => <Tag>{strategyLabel[strategy]}</Tag>,
    },
    {
      title: '默认值',
      dataIndex: 'defaultValue',
      key: 'defaultValue',
      width: 100,
      ellipsis: true,
    },
    {
      title: '灰度',
      key: 'scope',
      width: 100,
      render: (_: unknown, record) => {
        if (record.percentage !== undefined) {
          return <Tag color="purple">{record.percentage}%</Tag>;
        }
        if (record.tenantId) return <Tag color="blue">租户</Tag>;
        if (record.userGroups && record.userGroups.length > 0) return <Tag color="green">用户组</Tag>;
        return <Tag color="default">全局</Tag>;
      },
    },
    {
      title: '评估次数',
      dataIndex: 'evaluationCount',
      key: 'evaluationCount',
      width: 90,
      sorter: (a, b) => a.evaluationCount - b.evaluationCount,
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
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: unknown, record) => (
        <Space size="small">
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedFlag(record); setDetailModalVisible(true); }} />
          </Tooltip>
          <Tooltip title="评估">
            <Button type="link" size="small" icon={<ExperimentOutlined />} onClick={() => { setEvaluatingFlag(record); setEvaluationResult(null); evaluateForm.resetFields(); setEvaluateModalVisible(true); }} />
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
      key: 'type',
      label: '类型',
      options: [{ label: '全部', value: 'all' }, ...FLAG_TYPE_OPTIONS],
      placeholder: '按类型筛选',
    },
    {
      key: 'strategy',
      label: '策略',
      options: [{ label: '全部', value: 'all' }, ...STRATEGY_OPTIONS],
      placeholder: '按策略筛选',
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
            <FlagOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            特性开关管理
          </Title>
          <Text type="secondary">按租户/用户组的灰度发布和特性开关控制</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadFlags} loading={loading}>
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
            创建开关
          </Button>
        </Space>
      </div>

      {/* API Warning */}
      {apiError && (
        <Alert
          message="后端 API 尚未就绪"
          description={`特性开关管理功能的后端接口尚未实现 (${apiError})。页面已准备好，等待后端完成后启用。`}
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
              <MetricCard title="开关总数" value={stats.totalFlags} />
            </Col>
            <Col span={6}>
              <MetricCard title="已启用" value={stats.enabledFlags} color={colors.success[500]} />
            </Col>
            <Col span={6}>
              <MetricCard title="总评估次数" value={stats.totalEvaluations} />
            </Col>
            <Col span={6}>
              <MetricCard title="租户级开关" value={stats.tenantScopedFlags} />
            </Col>
          </Row>
        </div>
      )}

      {/* Flag Table */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            filters={filterDefinitions}
            searchPlaceholder="搜索开关名称或 Key..."
            onFilter={(filters) => {
              if (filters.type) setTypeFilter(String(filters.type));
              if (filters.strategy) setStrategyFilter(String(filters.strategy));
            }}
            initialFilters={{ type: 'all', strategy: 'all' }}
          />
        </div>

        <Table<FeatureFlag>
          columns={columns}
          dataSource={filteredFlags}
          rowKey="id"
          loading={loading}
          size="middle"
          pagination={{ pageSize: 15, showTotal: (total) => `共 ${total} 个开关` }}
          locale={{ emptyText: apiError ? 'API 不可用，暂无数据' : '暂无特性开关' }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建特性开关"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={650}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="name" label="开关名称" rules={[{ required: true }]}>
            <Input placeholder="如: 新功能预览" />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input placeholder="new_feature_preview" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]} initialValue="boolean">
                <Select>
                  {FLAG_TYPE_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="strategy" label="策略" rules={[{ required: true }]} initialValue="default">
                <Select>
                  {STRATEGY_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defaultValue" label="默认值" rules={[{ required: true }]} initialValue="false">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tenantId" label="租户 ID (租户策略时填写)">
                <Input placeholder="tenant-xxx" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="percentage" label="灰度百分比 (百分比策略时填写)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} placeholder="0-100" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input placeholder="admin, beta-tester" />
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
        title="编辑特性开关"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingFlag(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={650}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="name" label="开关名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="key" label="Key" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="类型" rules={[{ required: true }]}>
                <Select>
                  {FLAG_TYPE_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="strategy" label="策略" rules={[{ required: true }]}>
                <Select>
                  {STRATEGY_OPTIONS.map((o) => (
                    <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="defaultValue" label="默认值" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="tenantId" label="租户 ID">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="percentage" label="灰度百分比">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      {/* Evaluate Modal */}
      <Modal
        title={`评估特性开关: ${evaluatingFlag?.name || ''}`}
        open={evaluateModalVisible}
        onCancel={() => {
          setEvaluateModalVisible(false);
          setEvaluatingFlag(null);
          setEvaluationResult(null);
        }}
        onOk={handleEvaluate}
        confirmLoading={submitting}
        width={500}
      >
        <Form form={evaluateForm} layout="vertical">
          <Form.Item name="tenantId" label="租户 ID">
            <Input placeholder="tenant-xxx" />
          </Form.Item>
          <Form.Item name="userId" label="用户 ID">
            <Input placeholder="user-xxx" />
          </Form.Item>
          <Form.Item name="userGroups" label="用户组 (逗号分隔)">
            <Input placeholder="admin, beta-tester" />
          </Form.Item>
        </Form>
        {evaluationResult !== null && (
          <Alert
            message="评估结果"
            description={evaluationResult}
            type="info"
            showIcon
            style={{ marginTop: spacing[4] }}
          />
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={selectedFlag ? `特性开关详情: ${selectedFlag.name}` : '详情'}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedFlag(null);
        }}
        footer={[
          <Button key="close" onClick={() => { setDetailModalVisible(false); setSelectedFlag(null); }}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedFlag && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="名称">{selectedFlag.name}</Descriptions.Item>
            <Descriptions.Item label="Key">{selectedFlag.key}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={typeColor[selectedFlag.type]}>{typeLabel[selectedFlag.type]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="策略">{strategyLabel[selectedFlag.strategy]}</Descriptions.Item>
            <Descriptions.Item label="默认值">{selectedFlag.defaultValue}</Descriptions.Item>
            <Descriptions.Item label="启用">{selectedFlag.enabled ? '是' : '否'}</Descriptions.Item>
            {selectedFlag.tenantId && <Descriptions.Item label="租户 ID">{selectedFlag.tenantId}</Descriptions.Item>}
            {selectedFlag.percentage !== undefined && <Descriptions.Item label="灰度百分比">{selectedFlag.percentage}%</Descriptions.Item>}
            <Descriptions.Item label="评估次数">{selectedFlag.evaluationCount}</Descriptions.Item>
            <Descriptions.Item label="最后评估">
              {selectedFlag.lastEvaluatedAt ? dayjs(selectedFlag.lastEvaluatedAt).format('YYYY-MM-DD HH:mm') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="描述" span={2}>{selectedFlag.description || '-'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default FeatureFlagsPage;
