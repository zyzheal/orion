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
  Modal,
  Form,
  Input,
  Select,
  message,
  Alert,
  Popconfirm,
  Switch,
  Row,
  Col,
  Tooltip,
  Progress,
  Descriptions,
  Badge,
  Table as AntTable,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CloseCircleOutlined,
  SecurityScanOutlined,
  StopOutlined,
  EyeOutlined,
  ThunderboltOutlined,
  SafetyOutlined,
  FilterOutlined,
  WarningOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

type PolicyType = 'input_validation' | 'output_filtering' | 'pii_detection' | 'rate_limiting';
type PolicyStatus = 'active' | 'inactive' | 'draft' | 'violated';
type PolicySeverity = 'low' | 'medium' | 'high' | 'critical';

interface SecurityPolicy {
  id: string;
  name: string;
  description: string;
  type: PolicyType;
  status: PolicyStatus;
  severity: PolicySeverity;
  violations: number;
  lastUpdated: string;
  createdBy: string;
  enabled: boolean;
  rules: string[];
}

interface SecurityStats {
  policiesActive: number;
  requestsBlocked: number;
  sensitiveDataDetected: number;
  complianceScore: number;
  totalViolations: number;
  avgResponseTime: number;
}

interface PolicyEvaluation {
  policyId: string;
  policyName: string;
  result: 'pass' | 'fail' | 'warning';
  timestamp: string;
  details: string;
}

// ============================================================================
// Label & Color Maps
// ============================================================================

const typeLabelMap: Record<PolicyType, string> = {
  input_validation: '输入验证',
  output_filtering: '输出过滤',
  pii_detection: 'PII 检测',
  rate_limiting: '速率限制',
};

const typeIconMap: Record<PolicyType, React.ReactNode> = {
  input_validation: <FilterOutlined />,
  output_filtering: <SecurityScanOutlined />,
  pii_detection: <SafetyOutlined />,
  rate_limiting: <ThunderboltOutlined />,
};

const statusColorMap: Record<PolicyStatus, string> = {
  active: 'success',
  inactive: 'default',
  draft: 'processing',
  violated: 'error',
};

const statusLabelMap: Record<PolicyStatus, string> = {
  active: '活跃',
  inactive: '未激活',
  draft: '草稿',
  violated: '已违规',
};

const severityColorMap: Record<PolicySeverity, string> = {
  low: 'blue',
  medium: 'orange',
  high: 'volcano',
  critical: 'red',
};

const severityLabelMap: Record<PolicySeverity, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_STATS: SecurityStats = {
  policiesActive: 18,
  requestsBlocked: 1247,
  sensitiveDataDetected: 89,
  complianceScore: 94,
  totalViolations: 23,
  avgResponseTime: 45,
};

const MOCK_POLICIES: SecurityPolicy[] = [
  {
    id: 'pol-001',
    name: 'SQL 注入防护',
    description: '检测并阻止 AI 请求中的 SQL 注入攻击模式',
    type: 'input_validation',
    status: 'active',
    severity: 'critical',
    violations: 156,
    lastUpdated: '2026-04-26T10:00:00Z',
    createdBy: 'security-team',
    enabled: true,
    rules: ['block_sql_keywords', 'escape_special_chars', 'validate_query_structure'],
  },
  {
    id: 'pol-002',
    name: 'XSS 内容过滤',
    description: '过滤 AI 响应中的跨站脚本攻击内容',
    type: 'output_filtering',
    status: 'active',
    severity: 'critical',
    violations: 89,
    lastUpdated: '2026-04-25T14:00:00Z',
    createdBy: 'security-team',
    enabled: true,
    rules: ['strip_script_tags', 'encode_html_entities', 'validate_js_content'],
  },
  {
    id: 'pol-003',
    name: '个人信息检测',
    description: '检测并脱敏 AI 响应中的个人身份信息 (PII)',
    type: 'pii_detection',
    status: 'active',
    severity: 'high',
    violations: 234,
    lastUpdated: '2026-04-27T08:00:00Z',
    createdBy: 'compliance-team',
    enabled: true,
    rules: ['detect_email', 'detect_phone', 'detect_id_number', 'detect_credit_card'],
  },
  {
    id: 'pol-004',
    name: 'API 速率限制',
    description: '限制每个用户的 AI API 请求频率',
    type: 'rate_limiting',
    status: 'active',
    severity: 'medium',
    violations: 45,
    lastUpdated: '2026-04-24T16:00:00Z',
    createdBy: 'platform-team',
    enabled: true,
    rules: ['max_100_per_minute', 'max_5000_per_hour', 'burst_limit_20'],
  },
  {
    id: 'pol-005',
    name: '敏感词过滤',
    description: '过滤 AI 响应中的敏感词汇和不适当内容',
    type: 'output_filtering',
    status: 'active',
    severity: 'high',
    violations: 178,
    lastUpdated: '2026-04-26T12:00:00Z',
    createdBy: 'content-team',
    enabled: true,
    rules: ['keyword_blacklist', 'context_analysis', 'toxicity_detection'],
  },
  {
    id: 'pol-006',
    name: 'Prompt 注入防护',
    description: '检测和阻止针对 AI 模型的提示词注入攻击',
    type: 'input_validation',
    status: 'active',
    severity: 'critical',
    violations: 67,
    lastUpdated: '2026-04-27T06:00:00Z',
    createdBy: 'security-team',
    enabled: true,
    rules: ['detect_system_prompt_injection', 'validate_intent', 'block_jailbreak_patterns'],
  },
  {
    id: 'pol-007',
    name: 'API 密钥泄露检测',
    description: '检测并阻止 AI 响应中泄露的 API 密钥和凭证',
    type: 'pii_detection',
    status: 'active',
    severity: 'critical',
    violations: 12,
    lastUpdated: '2026-04-23T09:00:00Z',
    createdBy: 'security-team',
    enabled: true,
    rules: ['detect_api_keys', 'detect_tokens', 'detect_passwords', 'detect_secrets'],
  },
  {
    id: 'pol-008',
    name: 'Token 消耗限制',
    description: '限制单次请求的 Token 消耗上限',
    type: 'rate_limiting',
    status: 'active',
    severity: 'low',
    violations: 8,
    lastUpdated: '2026-04-20T11:00:00Z',
    createdBy: 'cost-team',
    enabled: true,
    rules: ['max_tokens_per_request_4096', 'max_response_tokens_2048'],
  },
  {
    id: 'pol-009',
    name: '模型输出长度限制',
    description: '限制 AI 模型输出的最大长度',
    type: 'output_filtering',
    status: 'draft',
    severity: 'low',
    violations: 0,
    lastUpdated: '2026-04-22T15:00:00Z',
    createdBy: 'platform-team',
    enabled: false,
    rules: ['max_output_chars_10000'],
  },
  {
    id: 'pol-010',
    name: '版权内容检测',
    description: '检测 AI 生成内容中可能的版权侵权',
    type: 'output_filtering',
    status: 'draft',
    severity: 'medium',
    violations: 0,
    lastUpdated: '2026-04-21T13:00:00Z',
    createdBy: 'legal-team',
    enabled: false,
    rules: ['code_similarity_check', 'text_similarity_check'],
  },
  {
    id: 'pol-011',
    name: '用户输入大小限制',
    description: '限制用户单次输入的最大字符数',
    type: 'input_validation',
    status: 'violated',
    severity: 'medium',
    violations: 34,
    lastUpdated: '2026-04-27T04:00:00Z',
    createdBy: 'platform-team',
    enabled: true,
    rules: ['max_input_chars_8192'],
  },
  {
    id: 'pol-012',
    name: '请求频率动态调整',
    description: '根据系统负载动态调整请求频率限制',
    type: 'rate_limiting',
    status: 'inactive',
    severity: 'low',
    violations: 0,
    lastUpdated: '2026-04-15T10:00:00Z',
    createdBy: 'platform-team',
    enabled: false,
    rules: ['auto_scale_based_on_cpu', 'auto_scale_based_on_memory'],
  },
];

const MOCK_EVALUATIONS: PolicyEvaluation[] = [
  {
    policyId: 'pol-001',
    policyName: 'SQL 注入防护',
    result: 'pass',
    timestamp: '2026-04-27T10:30:00Z',
    details: '策略规则全部生效，成功拦截测试用例中的 5 种 SQL 注入模式',
  },
  {
    policyId: 'pol-003',
    policyName: '个人信息检测',
    result: 'warning',
    timestamp: '2026-04-27T10:25:00Z',
    details: '检测到 2 条规则的覆盖率不足 90%，建议更新检测规则库',
  },
  {
    policyId: 'pol-006',
    policyName: 'Prompt 注入防护',
    result: 'pass',
    timestamp: '2026-04-27T10:20:00Z',
    details: '所有 jailbreak 模式均被正确识别和拦截',
  },
  {
    policyId: 'pol-011',
    policyName: '用户输入大小限制',
    result: 'fail',
    timestamp: '2026-04-27T10:15:00Z',
    details: '策略在过去 24 小时内有 34 次违规，部分请求绕过了大小限制',
  },
];

// ============================================================================
// Main Component
// ============================================================================

const AISecurityPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<SecurityPolicy[]>([]);
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editPolicy, setEditPolicy] = useState<SecurityPolicy | null>(null);
  const [evaluateModalVisible, setEvaluateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedPolicy, setSelectedPolicy] = useState<SecurityPolicy | null>(null);
  const [evaluations] = useState<PolicyEvaluation[]>(MOCK_EVALUATIONS);
  const [usingMockData, setUsingMockData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API call when AI security API is available
      throw new Error('API not yet implemented');
    } catch {
      setUsingMockData(true);
      setPolicies(MOCK_POLICIES);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      throw new Error('API not yet implemented');
    } catch {
      setUsingMockData(true);
      setStats(MOCK_STATS);
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
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.description.toLowerCase().includes(q)
        ) {
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
      await createForm.validateFields();
      setSubmitting(true);
      // TODO: Replace with actual API call
      message.success('安全策略创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error('创建失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editPolicy) return;
    try {
      await editForm.validateFields();
      setSubmitting(true);
      // TODO: Replace with actual API call
      message.success('策略更新成功');
      setEditModalVisible(false);
      setEditPolicy(null);
      loadData();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error('更新失败');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (_id: string) => {
    try {
      // TODO: Replace with actual API call
      message.success('策略已删除');
      loadData();
      loadStats();
    } catch {
      message.error('删除失败');
    }
  };

  const handleTogglePolicy = async (record: SecurityPolicy) => {
    const newEnabled = !record.enabled;
    try {
      // TODO: Replace with actual API call
      setPolicies((prev) =>
        prev.map((p) => (p.id === record.id ? { ...p, enabled: newEnabled } : p))
      );
      message.success(
        `策略 "${record.name}" 已${newEnabled ? '启用' : '禁用'}`
      );
    } catch {
      message.error('状态更新失败');
    }
  };

  const handleEvaluate = async () => {
    try {
      setSubmitting(true);
      // TODO: Replace with actual API call
      message.success('策略评估已启动，结果将稍后显示');
      setEvaluateModalVisible(false);
    } catch {
      message.error('评估启动失败');
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (record: SecurityPolicy) => {
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

  const openDetail = (record: SecurityPolicy) => {
    setSelectedPolicy(record);
    setDetailModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: TableColumn<SecurityPolicy>[] = [
    {
      key: 'name',
      title: '策略名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SecurityPolicy) => (
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
      render: (_: unknown, record: SecurityPolicy) => (
        <Tag icon={typeIconMap[record.type]} color="blue">
          {typeLabelMap[record.type]}
        </Tag>
      ),
    },
    {
      key: 'severity',
      title: '严重级别',
      width: 100,
      render: (_: unknown, record: SecurityPolicy) => (
        <Tag color={severityColorMap[record.severity]}>
          {severityLabelMap[record.severity]}
        </Tag>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: SecurityPolicy) => (
        <Tag color={statusColorMap[record.status]}>
          {statusLabelMap[record.status]}
        </Tag>
      ),
    },
    {
      key: 'violations',
      title: '违规次数',
      dataIndex: 'violations',
      width: 100,
      sortable: true,
      render: (value: unknown, record: SecurityPolicy) => (
        record.status === 'violated' ? (
          <Tag icon={<WarningOutlined />} color="red">{String(value)}</Tag>
        ) : (
          <Text type="secondary">{String(value)}</Text>
        )
      ),
    },
    {
      key: 'enabled',
      title: '开关',
      width: 80,
      render: (_: unknown, record: SecurityPolicy) => (
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
      render: (_: unknown, record: SecurityPolicy) => (
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
          <Popconfirm
            title="确认删除该策略?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Tooltip title="删除">
              <Button type="link" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Filter Definitions ----

  const filterDefs: FilterDefinition[] = [
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
  ];

  // ---- Compliance Score Color ----

  const getComplianceColor = (score: number): string => {
    if (score >= 90) return colors.success[500];
    if (score >= 70) return colors.warning[500];
    return colors.error[500];
  };

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
            <SafetyOutlined style={{ marginRight: spacing[3], color: colors.success[500] }} />
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
          <Button
            icon={<ThunderboltOutlined />}
            onClick={() => setEvaluateModalVisible(true)}
          >
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

      {/* Mock Data Warning */}
      {usingMockData && (
        <Alert
          message="使用模拟数据"
          description="AI 安全后端 API 暂未接入，当前显示的是模拟数据，可能不是最新状态。"
          type="warning"
          showIcon
          closable
          style={{ marginBottom: spacing[4] }}
          onClose={() => setUsingMockData(false)}
        />
      )}

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
              icon={<SafetyOutlined style={{ fontSize: 20, color: getComplianceColor(stats.complianceScore) }} />}
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
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Policy Modal */}
      <Modal
        title="创建安全策略"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input placeholder="如: SQL 注入防护" />
          </Form.Item>
          <Form.Item
            name="type"
            label="策略类型"
            rules={[{ required: true, message: '请选择策略类型' }]}
          >
            <Select>
              <Select.Option value="input_validation">输入验证</Select.Option>
              <Select.Option value="output_filtering">输出过滤</Select.Option>
              <Select.Option value="pii_detection">PII 检测</Select.Option>
              <Select.Option value="rate_limiting">速率限制</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="severity"
            label="严重级别"
            rules={[{ required: true, message: '请选择严重级别' }]}
            initialValue="medium"
          >
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="critical">严重</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="策略描述..." />
          </Form.Item>
          <Form.Item name="rules" label="规则 (逗号分隔)">
            <Input.TextArea rows={2} placeholder="如: block_sql_keywords, escape_special_chars" />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Select>
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Policy Modal */}
      <Modal
        title="编辑安全策略"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          setEditPolicy(null);
        }}
        onOk={handleEdit}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical">
          <Form.Item
            name="name"
            label="策略名称"
            rules={[{ required: true, message: '请输入策略名称' }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="type"
            label="策略类型"
            rules={[{ required: true, message: '请选择策略类型' }]}
          >
            <Select>
              <Select.Option value="input_validation">输入验证</Select.Option>
              <Select.Option value="output_filtering">输出过滤</Select.Option>
              <Select.Option value="pii_detection">PII 检测</Select.Option>
              <Select.Option value="rate_limiting">速率限制</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="severity"
            label="严重级别"
            rules={[{ required: true, message: '请选择严重级别' }]}
          >
            <Select>
              <Select.Option value="low">低</Select.Option>
              <Select.Option value="medium">中</Select.Option>
              <Select.Option value="high">高</Select.Option>
              <Select.Option value="critical">严重</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="rules" label="规则 (逗号分隔)">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item
            name="enabled"
            label="启用状态"
            valuePropName="checked"
          >
            <Select>
              <Select.Option value={true}>启用</Select.Option>
              <Select.Option value={false}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Evaluate Policy Modal */}
      <Modal
        title="策略评估"
        open={evaluateModalVisible}
        onCancel={() => setEvaluateModalVisible(false)}
        onOk={handleEvaluate}
        confirmLoading={submitting}
        width={700}
      >
        <Alert
          message="策略评估说明"
          description="策略评估将运行预定义的测试用例，验证每个安全策略是否按预期工作。评估过程可能需要几分钟。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Title level={5}>最近评估结果</Title>
        <AntTable
          dataSource={evaluations}
          rowKey="policyId"
          pagination={false}
          size="small"
          columns={[
            {
              title: '策略',
              dataIndex: 'policyName',
              key: 'policyName',
            },
            {
              title: '结果',
              key: 'result',
              render: (_: unknown, record: PolicyEvaluation) => {
                const config: Record<string, { color: string; icon: React.ReactNode; text: string }> = {
                  pass: { color: 'green', icon: <CheckCircleOutlined />, text: '通过' },
                  fail: { color: 'red', icon: <CloseCircleOutlined />, text: '失败' },
                  warning: { color: 'orange', icon: <WarningOutlined />, text: '警告' },
                };
                const c = config[record.result];
                return <Tag color={c.color} icon={c.icon}>{c.text}</Tag>;
              },
            },
            {
              title: '时间',
              dataIndex: 'timestamp',
              key: 'timestamp',
              render: (value: unknown) => dayjs(String(value)).format('YYYY-MM-DD HH:mm'),
            },
            {
              title: '详情',
              dataIndex: 'details',
              key: 'details',
              ellipsis: true,
            },
          ]}
        />
      </Modal>

      {/* Policy Detail Modal */}
      <Modal
        title={selectedPolicy ? selectedPolicy.name : '策略详情'}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedPolicy(null);
        }}
        footer={[
          <Button key="close" onClick={() => { setDetailModalVisible(false); setSelectedPolicy(null); }}>
            关闭
          </Button>,
        ]}
        width={650}
      >
        {selectedPolicy && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Descriptions column={2} bordered size="small">
              <Descriptions.Item label="策略名称">{selectedPolicy.name}</Descriptions.Item>
              <Descriptions.Item label="类型">
                <Tag icon={typeIconMap[selectedPolicy.type]} color="blue">
                  {typeLabelMap[selectedPolicy.type]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="严重级别">
                <Tag color={severityColorMap[selectedPolicy.severity]}>
                  {severityLabelMap[selectedPolicy.severity]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[selectedPolicy.status]}>
                  {statusLabelMap[selectedPolicy.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="违规次数">
                <Badge count={selectedPolicy.violations} style={{ backgroundColor: selectedPolicy.violations > 0 ? colors.error[500] : colors.success[500] }} />
              </Descriptions.Item>
              <Descriptions.Item label="启用状态">
                {selectedPolicy.enabled ? (
                  <Tag color="green">已启用</Tag>
                ) : (
                  <Tag color="default">已禁用</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">{selectedPolicy.createdBy}</Descriptions.Item>
              <Descriptions.Item label="最后更新">
                {dayjs(selectedPolicy.lastUpdated).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedPolicy.description}
              </Descriptions.Item>
            </Descriptions>
            <div>
              <Title level={5}>策略规则</Title>
              <Space wrap>
                {selectedPolicy.rules.map((rule, idx) => (
                  <Tag key={idx} icon={<SecurityScanOutlined />}>{rule}</Tag>
                ))}
              </Space>
            </div>
            {stats && (
              <div>
                <Title level={5}>合规评分概览</Title>
                <Progress
                  percent={stats.complianceScore}
                  strokeColor={getComplianceColor(stats.complianceScore)}
                  format={() => `${stats.complianceScore}%`}
                />
              </div>
            )}
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AISecurityPage;
