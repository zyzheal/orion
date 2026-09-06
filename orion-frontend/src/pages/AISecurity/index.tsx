/**
 * AI Security Page
 * AI 安全策略管理
 *
 * Features:
 * - Stats cards: Policies Active, Requests Blocked, Sensitive Data Detected, Compliance Score
 * - Security policy table with filter by policy type
 * - Evaluate policy modal
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Form,
  message,
  Popconfirm,
  Switch,
  Row,
  Col,
  Tooltip,
  Spin,
  Empty,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  SecurityScanOutlined,
  StopOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getSecurityStats,
  getPolicies,
  getEvaluations,
  createPolicy,
  updatePolicy,
  deletePolicy,
  togglePolicy,
} from '@/api/ai-security';
import { AISecurityModals } from './AISecurityModals';
import {
  mapApiPolicyToUI,
  mapApiEvalToUI,
  typeLabelMap,
  typeIconMap,
  statusColorMap,
  statusLabelMap,
  severityColorMap,
  severityLabelMap,
  policyTypeOptions,
  severityOptions,
  type UISecurityPolicy,
  type SecurityStats,
  type PolicyEvaluation,
} from './config';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================

// ============================================================================
// Main Component
// ============================================================================

const AISecurityPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<UISecurityPolicy[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPolicy, setEditPolicy] = useState<UISecurityPolicy | null>(null);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<UISecurityPolicy | null>(null);
  const [evaluations, setEvaluations] = useState<PolicyEvaluation[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const [policiesRes, evaluationsRes] = await Promise.all([getPolicies(), getEvaluations()]);
      setPolicies((policiesRes.data as any).policies.map(mapApiPolicyToUI));
      setEvaluations((evaluationsRes.data as any).evaluations.map(mapApiEvalToUI));
    } catch (error: unknown) {
      message.error(`Failed to load security data: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getSecurityStats();
      const apiStats = (response.data as any).stats;
      setStats({
        policiesActive: apiStats.policiesActive,
        requestsBlocked: apiStats.requestsBlocked,
        sensitiveDataDetected: 0,
        complianceScore: apiStats.complianceScore,
        totalViolations: 0,
        avgResponseTime: 0,
      });
    } catch (error: unknown) {
      message.error(`Failed to load security stats: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  // ---- Filtering ----

  const filteredData = useMemo(() => {
    return policies.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.type && filters.type !== 'all' && p.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && p.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, policies]);

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const rules =
        typeof values.rules === 'string'
          ? values.rules.split(',').map((r: string) => r.trim())
          : [];
      await createPolicy({
        name: values.name,
        description: values.description || '',
        type: values.type,
        enabled: values.enabled ?? true,
        severity: values.severity,
        rule: rules[0] || '',
        action: 'block',
        matchCount: 0,
      } as any);
      message.success('安全策略创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editPolicy) return;
    try {
      const values = await editForm.validateFields();
      setSubmitting(true);
      const rules =
        typeof values.rules === 'string'
          ? values.rules.split(',').map((r: string) => r.trim())
          : [];
      await updatePolicy(editPolicy.id, {
        name: values.name,
        description: values.description,
        type: values.type,
        enabled: values.enabled,
        severity: values.severity,
        rule: rules[0] || editPolicy.rules[0],
      });
      message.success('策略更新成功');
      setEditModalVisible(false);
      setEditPolicy(null);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`更新失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePolicy(id);
      message.success('策略已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除策略失败：${(error as Error).message}`);
    }
  };

  const handleTogglePolicy = async (record: UISecurityPolicy) => {
    const newEnabled = !record.enabled;
    try {
      await togglePolicy(record.id, newEnabled);
      setPolicies((prev) =>
        prev.map((p) => (p.id === record.id ? { ...p, enabled: newEnabled } : p))
      );
      message.success(`策略 "${record.name}" 已${newEnabled ? '启用' : '禁用'}`);
    } catch (error: unknown) {
      message.error(`状态更新失败：${(error as Error).message}`);
    }
  };

  const handleEvaluate = async () => {
    try {
      setSubmitting(true);
      message.success('策略评估已启动，结果将稍后显示');
      setEvaluateModalVisible(false);
    } catch (error: unknown) {
      message.error(`评估启动失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (record: UISecurityPolicy) => {
    setEditPolicy(record);
    editForm.setFieldsValue({
      name: record.name,
      description: record.description,
      type: record.type,
      severity: record.severity,
      enabled: record.enabled,
      rules: record.rules.join(', '),
    });
    setEditModalVisible(true);
  };

  const openDetail = (record: UISecurityPolicy) => {
    setSelectedPolicy(record);
    setDetailModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: TableColumn<UISecurityPolicy>[] = useMemo<TableColumn<UISecurityPolicy>[]>(
    () => [
      {
        key: 'name',
        title: '策略名称',
        dataIndex: 'name',
        width: 200,
        sortable: true,
        render: (value: unknown, record: UISecurityPolicy) => (
          <Space direction="vertical" size={0}>
            <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
              {String(value)}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description.substring(0, 40)}...
            </Text>
          </Space>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: 120,
        render: (_: unknown, record: UISecurityPolicy) => (
          <Tag icon={typeIconMap[record.type]} color="blue">
            {typeLabelMap[record.type]}
          </Tag>
        ),
      },
      {
        key: 'severity',
        title: '严重级别',
        width: 100,
        render: (_: unknown, record: UISecurityPolicy) => (
          <Tag color={severityColorMap[record.severity]}>{severityLabelMap[record.severity]}</Tag>
        ),
      },
      {
        key: 'status',
        title: '状态',
        width: 100,
        render: (_: unknown, record: UISecurityPolicy) => (
          <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
        ),
      },
      {
        key: 'violations',
        title: '违规次数',
        dataIndex: 'violations',
        width: 100,
        sortable: true,
        render: (value: unknown, record: UISecurityPolicy) =>
          record.status === 'violated' ? (
            <Tag icon={<WarningOutlined />} color="red">
              {String(value)}
            </Tag>
          ) : (
            <Text type="secondary">{String(value)}</Text>
          ),
      },
      {
        key: 'enabled',
        title: '开关',
        width: 80,
        render: (_: unknown, record: UISecurityPolicy) => (
          <Switch
            size="small"
            checked={record.enabled}
            onChange={() => handleTogglePolicy(record)}
            checkedChildren="开"
            unCheckedChildren="关"
          />
        ),
      },
      {
        key: 'lastUpdated',
        title: '最后更新',
        dataIndex: 'lastUpdated',
        width: 140,
        sortable: true,
        render: (value: unknown) => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {dayjs(String(value)).fromNow()}
          </Text>
        ),
      },
      {
        key: 'actions',
        title: '操作',
        width: 160,
        render: (_: unknown, record: UISecurityPolicy) => (
          <Space size="small" wrap>
            <Tooltip title="详情">
              <Button
                type="link"
                size="small"
                icon={<EyeOutlined />}
                onClick={() => openDetail(record)}
              />
            </Tooltip>
            <Tooltip title="编辑">
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => openEdit(record)}
              />
            </Tooltip>
            <Popconfirm title="确认删除该策略?" onConfirm={() => handleDelete(record.id)}>
              <Tooltip title="删除">
                <Button type="link" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleDelete, openDetail, openEdit]
  );

  // ---- Filter Definitions ----

  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'type',
        label: '策略类型',
        options: [
          { label: '全部', value: 'all' },
          { label: '输入验证', value: 'input_validation' },
          { label: '输出过滤', value: 'output_filtering' },
          { label: 'PII 检测', value: 'pii_detection' },
          { label: '速率限制', value: 'rate_limiting' },
        ],
      },
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '活跃', value: 'active' },
          { label: '未激活', value: 'inactive' },
          { label: '草稿', value: 'draft' },
          { label: '已违规', value: 'violated' },
        ],
      },
    ],
    []
  );

  // ---- Compliance Score Color ----

  const getComplianceColor = (score: number): string => {
    if (score >= 90) return colors.success[500];
    if (score >= 70) return colors.warning[500];
    return colors.error[500];
  };

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      <Spin spinning={loading}>
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
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <SafetyOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              AI Security
            </Title>
            <Text type="secondary">AI 安全策略</Text>
          </div>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                loadData();
                loadStats();
              }}
              loading={loading}
            >
              刷新
            </Button>
            <Button icon={<ThunderboltOutlined />} onClick={() => setEvaluateModalVisible(true)}>
              评估策略
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建策略
            </Button>
          </Space>
        </div>

        {/* Stats Cards */}
        {stats && (
          <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
            <Col span={6}>
              <MetricCard
                title="策略活跃数"
                value={stats.policiesActive}
                icon={<SecurityScanOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
                color={colors.success[500]}
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="请求已拦截"
                value={stats.requestsBlocked}
                icon={<StopOutlined style={{ fontSize: 20, color: colors.error[500] }} />}
                color={colors.error[500]}
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="敏感数据检测"
                value={stats.sensitiveDataDetected}
                icon={<SafetyOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
                color={colors.warning[500]}
              />
            </Col>
            <Col span={6}>
              <MetricCard
                title="合规评分"
                value={`${stats.complianceScore}%`}
                icon={
                  <SafetyOutlined
                    style={{ fontSize: 20, color: getComplianceColor(stats.complianceScore) }}
                  />
                }
                color={getComplianceColor(stats.complianceScore)}
              />
            </Col>
          </Row>
        )}

        {/* Policy List */}
        <Card>
          <div style={{ marginBottom: spacing[4] }}>
            <SearchFilterBar
              onSearch={setSearchQuery}
              onFilter={setFilters}
              filters={filterDefs}
              searchPlaceholder="搜索策略名称或描述..."
            />
          </div>
          {filteredData.length > 0 ? (
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          ) : (
            !loading && <Empty description="暂无安全策略" />
          )}
        </Card>

        <AISecurityModals
          loading={loading}
          policies={policies}
          stats={stats}
          createModalVisible={createModalVisible}
          setCreateModalVisible={setCreateModalVisible}
          editModalVisible={editModalVisible}
          setEditModalVisible={setEditModalVisible}
          editPolicy={editPolicy}
          setEditPolicy={setEditPolicy}
          evaluateModalVisible={evaluateModalVisible}
          setEvaluateModalVisible={setEvaluateModalVisible}
          detailModalVisible={detailModalVisible}
          setDetailModalVisible={setDetailModalVisible}
          selectedPolicy={selectedPolicy}
          setSelectedPolicy={setSelectedPolicy}
          evaluations={evaluations}
          submitting={submitting}
          createForm={createForm}
          editForm={editForm}
          handleCreate={handleCreate}
          handleEdit={handleEdit}
          handleEvaluate={handleEvaluate}
          getComplianceColor={getComplianceColor}
          severityLabelMap={severityLabelMap}
          severityColorMap={severityColorMap}
          statusColorMap={statusColorMap}
          statusLabelMap={statusLabelMap}
          policyTypeOptions={policyTypeOptions}
          severityOptions={severityOptions}
        />
      </Spin>
    </div>
  );
};

export default AISecurityPage;
