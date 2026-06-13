/**
 * Problem Management Page
 * Problem lifecycle management with KEDB (Known Error Database) and incident/change linking.
 *
 * Features:
 * - Tab 1: Problem List with filters, CRUD, pagination
 * - Tab 2: Problem Detail with status transitions, related items, linking
 * - Tab 3: Known Error Database (KEDB) with search and CRUD
 * - Stats bar: total, by status, by severity breakdown
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Select,
  Input,
  Tabs,
  Empty,
  message,
  Card,
  Descriptions,
  Popconfirm,
  Badge,
  Row,
  Col,
  Statistic,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  BugOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  LinkOutlined,
  ArrowRightOutlined,
  BookOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { colors, spacing, radius, shadows } from '@/tokens';
import {
  getProblems,
  getProblem,
  createProblem,
  updateProblem,
  deleteProblem,
  updateProblemStatus,
  linkIncident,
  linkChange,
  getKnownErrors,
  createKnownError,
  updateKnownError,
  deleteKnownError,
  searchKnownErrors,
  getProblemStats,
} from '@/api/problem';
import type { Problem, KnownError, ProblemStats } from '@/api/problem';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ============================================================================
// Constants
// ============================================================================

/** Severity configuration with color coding */
const severityConfig: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  critical: { color: 'red', label: '严重', icon: <ExclamationCircleOutlined /> },
  high: { color: 'orange', label: '高', icon: <WarningOutlined /> },
  medium: { color: 'blue', label: '中', icon: <InfoCircleOutlined /> },
  low: { color: 'green', label: '低', icon: <InfoCircleOutlined /> },
};

/** Problem status configuration */
const statusConfig: Record<string, { color: string; label: string }> = {
  known: { color: 'purple', label: '已知' },
  investigating: { color: 'orange', label: '调查中' },
  resolved: { color: 'green', label: '已解决' },
  closed: { color: 'default', label: '已关闭' },
};

/** Known error status configuration */
const knownErrorStatusConfig: Record<string, { color: string; label: string }> = {
  active: { color: 'green', label: '活跃' },
  resolved: { color: 'blue', label: '已解决' },
  archived: { color: 'default', label: '已归档' },
};

/** Status transition map: current -> next available statuses */
const statusTransitions: Record<string, { status: string; label: string; icon: React.ReactNode }[]> = {
  known: [{ status: 'investigating', label: '开始调查', icon: <SyncOutlined /> }],
  investigating: [{ status: 'resolved', label: '标记解决', icon: <CheckCircleOutlined /> }],
  resolved: [{ status: 'closed', label: '关闭问题', icon: <CloseCircleOutlined /> }],
  closed: [],
};

// ============================================================================
// Component
// ============================================================================

const ProblemPage: React.FC = () => {
  // ---- State ----
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [totalProblems, setTotalProblems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [stats, setStats] = useState<ProblemStats | null>(null);

  // Filters
  const [filterSeverity, setFilterSeverity] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState('');

  // Selected problem for detail view
  const [selectedProblem, setSelectedProblem] = useState<Problem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [linkIncidentModalVisible, setLinkIncidentModalVisible] = useState(false);
  const [linkChangeModalVisible, setLinkChangeModalVisible] = useState(false);

  // Forms
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [linkForm] = Form.useForm();

  // KEDB state
  const [knownErrors, setKnownErrors] = useState<KnownError[]>([]);
  const [kedbLoading, setKedbLoading] = useState(false);
  const [kedbTotal, setKedbTotal] = useState(0);
  const [kedbPage, setKedbPage] = useState(1);
  const [kedbSearchQuery, setKedbSearchQuery] = useState('');
  const [kedbStatusFilter, setKedbStatusFilter] = useState<string | undefined>();
  const [kedbModalVisible, setKedbModalVisible] = useState(false);
  const [kedbEditModalVisible, setKedbEditModalVisible] = useState(false);
  const [editingKnownError, setEditingKnownError] = useState<KnownError | null>(null);
  const [kedbForm] = Form.useForm();
  const [kedbEditForm] = Form.useForm();

  // Operation loading states
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);

  // ============================================================================
  // Data Loading
  // ============================================================================

  /** Load problem list with current filters */
  const loadProblems = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: pageSize,
        offset: (currentPage - 1) * pageSize,
      };
      if (filterSeverity) params.severity = filterSeverity;
      if (filterStatus) params.status = filterStatus;

      const result = await getProblems(params);
      let data = result.data || [];
      // Client-side search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        data = data.filter(
          (p) =>
            p.title.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q) ||
            p.category?.toLowerCase().includes(q)
        );
      }
      setProblems(data);
      setTotalProblems(result.total || data.length);
    } catch (error) {
      message.error('加载问题列表失败');
      console.error('Failed to load problems:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filterSeverity, filterStatus, searchQuery]);

  /** Load problem statistics */
  const loadStats = useCallback(async () => {
    try {
      const data = await getProblemStats();
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, []);

  /** Load known errors for KEDB tab */
  const loadKnownErrors = useCallback(async () => {
    setKedbLoading(true);
    try {
      if (kedbSearchQuery) {
        const data = await searchKnownErrors(kedbSearchQuery);
        setKnownErrors(data);
        setKedbTotal(data.length);
      } else {
        const params: Record<string, unknown> = {
          limit: 20,
          offset: (kedbPage - 1) * 20,
        };
        if (kedbStatusFilter) params.status = kedbStatusFilter;
        const result = await getKnownErrors(params);
        setKnownErrors(result.data || []);
        setKedbTotal(result.total || 0);
      }
    } catch (error) {
      message.error('加载已知错误数据库失败');
      console.error('Failed to load known errors:', error);
    } finally {
      setKedbLoading(false);
    }
  }, [kedbPage, kedbSearchQuery, kedbStatusFilter]);

  /** Load single problem detail */
  const loadProblemDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const data = await getProblem(id);
      setSelectedProblem(data);
    } catch (error) {
      message.error('加载问题详情失败');
      console.error('Failed to load problem detail:', error);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // Effects
  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    if (activeTab === 'kedb') {
      loadKnownErrors();
    }
  }, [activeTab, loadKnownErrors]);

  // ============================================================================
  // Problem CRUD Handlers
  // ============================================================================

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await createProblem({
        title: values.title,
        description: values.description,
        severity: values.severity,
        category: values.category,
        assignedTo: values.assigned_to,
      });
      message.success('问题创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadProblems();
      loadStats();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return; // form validation
      message.error('创建问题失败');
      console.error('Failed to create problem:', error);
    }
  };

  const handleEdit = async () => {
    if (!selectedProblem) return;
    try {
      const values = await editForm.validateFields();
      await updateProblem(selectedProblem.id, {
        title: values.title,
        description: values.description,
        severity: values.severity,
        category: values.category,
        assigned_to: values.assigned_to,
        root_cause: values.root_cause,
        workaround: values.workaround,
        resolution: values.resolution,
      });
      message.success('问题更新成功');
      setEditModalVisible(false);
      editForm.resetFields();
      loadProblems();
      loadProblemDetail(selectedProblem.id);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('更新问题失败');
      console.error('Failed to update problem:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteProblem(id);
      message.success('问题已删除');
      if (selectedProblem?.id === id) {
        setSelectedProblem(null);
        setActiveTab('list');
      }
      loadProblems();
      loadStats();
    } catch (error) {
      message.error('删除问题失败');
      console.error('Failed to delete problem:', error);
    }
  };

  // ============================================================================
  // Status Transition Handlers
  // ============================================================================

  const handleStatusTransition = async (newStatus: string) => {
    if (!selectedProblem) return;
    setStatusUpdating(true);
    try {
      const updated = await updateProblemStatus(selectedProblem.id, newStatus);
      setSelectedProblem(updated);
      message.success(`问题状态已更新为: ${statusConfig[newStatus]?.label || newStatus}`);
      loadProblems();
      loadStats();
    } catch (error) {
      message.error('更新状态失败');
      console.error('Failed to update status:', error);
    } finally {
      setStatusUpdating(false);
    }
  };

  // ============================================================================
  // Linking Handlers
  // ============================================================================

  const handleLinkIncident = async () => {
    if (!selectedProblem) return;
    try {
      const values = await linkForm.validateFields();
      setLinkingLoading(true);
      const updated = await linkIncident(selectedProblem.id, values.id);
      setSelectedProblem(updated);
      message.success('关联事件成功');
      setLinkIncidentModalVisible(false);
      linkForm.resetFields();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('关联事件失败');
      console.error('Failed to link incident:', error);
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleLinkChange = async () => {
    if (!selectedProblem) return;
    try {
      const values = await linkForm.validateFields();
      setLinkingLoading(true);
      const updated = await linkChange(selectedProblem.id, values.id);
      setSelectedProblem(updated);
      message.success('关联变更成功');
      setLinkChangeModalVisible(false);
      linkForm.resetFields();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('关联变更失败');
      console.error('Failed to link change:', error);
    } finally {
      setLinkingLoading(false);
    }
  };

  // ============================================================================
  // KEDB CRUD Handlers
  // ============================================================================

  const handleCreateKnownError = async () => {
    try {
      const values = await kedbForm.validateFields();
      await createKnownError({
        title: values.title,
        description: values.description,
        symptoms: values.symptoms,
        root_cause: values.root_cause,
        workaround: values.workaround,
        keywords: values.keywords ? values.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
        problem_id: values.problem_id,
      });
      message.success('已知错误创建成功');
      setKedbModalVisible(false);
      kedbForm.resetFields();
      loadKnownErrors();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('创建已知错误失败');
      console.error('Failed to create known error:', error);
    }
  };

  const handleEditKnownError = async () => {
    if (!editingKnownError) return;
    try {
      const values = await kedbEditForm.validateFields();
      await updateKnownError(editingKnownError.id, {
        title: values.title,
        description: values.description,
        symptoms: values.symptoms,
        root_cause: values.root_cause,
        workaround: values.workaround,
        keywords: values.keywords ? values.keywords.split(',').map((k: string) => k.trim()).filter(Boolean) : [],
        status: values.status,
      });
      message.success('已知错误更新成功');
      setKedbEditModalVisible(false);
      kedbEditForm.resetFields();
      setEditingKnownError(null);
      loadKnownErrors();
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      message.error('更新已知错误失败');
      console.error('Failed to update known error:', error);
    }
  };

  const handleDeleteKnownError = async (id: string) => {
    try {
      await deleteKnownError(id);
      message.success('已知错误已删除');
      loadKnownErrors();
    } catch (error) {
      message.error('删除已知错误失败');
      console.error('Failed to delete known error:', error);
    }
  };

  // ============================================================================
  // View Detail Handler
  // ============================================================================

  const handleViewDetail = (problem: Problem) => {
    loadProblemDetail(problem.id);
    setActiveTab('detail');
  };

  const handleOpenEditModal = (problem: Problem) => {
    setSelectedProblem(problem);
    editForm.setFieldsValue({
      title: problem.title,
      description: problem.description,
      severity: problem.severity,
      category: problem.category,
      assigned_to: problem.assigned_to,
      root_cause: problem.root_cause,
      workaround: problem.workaround,
      resolution: problem.resolution,
    });
    setEditModalVisible(true);
  };

  const handleOpenKedbEditModal = (ke: KnownError) => {
    setEditingKnownError(ke);
    kedbEditForm.setFieldsValue({
      title: ke.title,
      description: ke.description,
      symptoms: ke.symptoms,
      root_cause: ke.root_cause,
      workaround: ke.workaround,
      keywords: ke.keywords?.join(', '),
      status: ke.status,
    });
    setKedbEditModalVisible(true);
  };

  // ============================================================================
  // Stats Computation
  // ============================================================================

  const statCards = useMemo(() => {
    if (!stats) return null;
    return (
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
          >
            <Statistic
              title="问题总数"
              value={stats.total}
              prefix={<BugOutlined style={{ color: colors.primary[500] }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
          >
            <Statistic
              title="已知问题"
              value={stats.byStatus?.known || 0}
              valueStyle={{ color: colors.purple[500] }}
              prefix={<BookOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
          >
            <Statistic
              title="调查中"
              value={stats.byStatus?.investigating || 0}
              valueStyle={{ color: colors.warning[500] }}
              prefix={<SyncOutlined spin />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card
            size="small"
            style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
          >
            <Statistic
              title="严重/高级"
              value={(stats.bySeverity?.critical || 0) + (stats.bySeverity?.high || 0)}
              valueStyle={{ color: colors.error[500] }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
    );
  }, [stats]);

  // ============================================================================
  // Tab 1: Problem List
  // ============================================================================

  const problemListContent = (
    <div>
      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
          alignItems: 'center',
        }}
      >
        <Input
          placeholder="搜索问题标题、描述、分类..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: 280, borderRadius: radius.sm }}
          allowClear
        />
        <Select
          placeholder="严重级别"
          value={filterSeverity}
          onChange={setFilterSeverity}
          allowClear
          style={{ width: 130 }}
          options={[
            { label: '全部级别', value: undefined },
            { label: '严重', value: 'critical' },
            { label: '高', value: 'high' },
            { label: '中', value: 'medium' },
            { label: '低', value: 'low' },
          ]}
        />
        <Select
          placeholder="状态"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 130 }}
          options={[
            { label: '全部状态', value: undefined },
            { label: '已知', value: 'known' },
            { label: '调查中', value: 'investigating' },
            { label: '已解决', value: 'resolved' },
            { label: '已关闭', value: 'closed' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadProblems}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建问题
        </Button>
      </div>

      {/* Problem table */}
      {problems.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${colors.neutral[200]}`,
                    background: colors.neutral[50],
                  }}
                >
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>标题</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 90 }}>严重级别</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 100 }}>状态</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 120 }}>分类</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 120 }}>负责人</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 170 }}>创建时间</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 160 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((problem) => {
                  const sev = severityConfig[problem.severity] || severityConfig.medium;
                  const st = statusConfig[problem.status] || statusConfig.known;
                  return (
                    <tr
                      key={problem.id}
                      style={{
                        borderBottom: `1px solid ${colors.neutral[100]}`,
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = colors.primary[50];
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <td
                        style={{ padding: '12px 16px' }}
                        onClick={() => handleViewDetail(problem)}
                      >
                        <Text strong style={{ color: colors.primary[600], cursor: 'pointer' }}>
                          {problem.title}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Tag color={sev.color} icon={sev.icon}>
                          {sev.label}
                        </Tag>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Tag color={st.color}>{st.label}</Tag>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text type="secondary">{problem.category || '-'}</Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text>{problem.assigned_to || '-'}</Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {problem.created_at ? dayjs(problem.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Space size={4}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EyeOutlined />}
                            onClick={() => handleViewDetail(problem)}
                            title="查看详情"
                          />
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenEditModal(problem)}
                            title="编辑"
                          />
                          <Popconfirm
                            title="确定删除此问题?"
                            description="删除后不可恢复"
                            onConfirm={() => handleDelete(problem.id)}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              title="删除"
                            />
                          </Popconfirm>
                        </Space>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text type="secondary" style={{ lineHeight: '32px', fontSize: 13 }}>
              共 {totalProblems} 条
            </Text>
            <Button
              size="small"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              上一页
            </Button>
            <Badge count={currentPage} style={{ backgroundColor: colors.primary[500] }} />
            <Button
              size="small"
              disabled={problems.length < pageSize}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </>
      ) : (
        !loading && (
          <Empty description="暂无问题数据">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              创建第一个问题
            </Button>
          </Empty>
        )
      )}
    </div>
  );

  // ============================================================================
  // Tab 2: Problem Detail
  // ============================================================================

  const problemDetailContent = selectedProblem ? (
    <Spin spinning={detailLoading}>
      <Space direction="vertical" size={spacing.md} style={{ width: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.sm }}>
          <div>
            <Space align="center" style={{ marginBottom: spacing.sm }}>
              <Title level={3} style={{ margin: 0 }}>
                {selectedProblem.title}
              </Title>
              <Tag color={severityConfig[selectedProblem.severity]?.color} icon={severityConfig[selectedProblem.severity]?.icon}>
                {severityConfig[selectedProblem.severity]?.label}
              </Tag>
              <Tag color={statusConfig[selectedProblem.status]?.color}>
                {statusConfig[selectedProblem.status]?.label}
              </Tag>
            </Space>
          </div>
          <Space wrap>
            {/* Status transition buttons */}
            {(statusTransitions[selectedProblem.status] || []).map((t) => (
              <Button
                key={t.status}
                type="primary"
                icon={t.icon}
                loading={statusUpdating}
                onClick={() => handleStatusTransition(t.status)}
              >
                {t.label}
              </Button>
            ))}
            <Button
              icon={<EditOutlined />}
              onClick={() => handleOpenEditModal(selectedProblem)}
            >
              编辑
            </Button>
            <Button onClick={() => setActiveTab('list')}>返回列表</Button>
          </Space>
        </div>

        {/* Detail Descriptions */}
        <Card
          title="问题详情"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
        >
          <Descriptions column={{ xs: 1, sm: 2 }} bordered size="small">
            <Descriptions.Item label="描述" span={2}>
              {selectedProblem.description || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="分类">
              {selectedProblem.category || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="负责人">
              {selectedProblem.assigned_to || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="根因分析" span={2}>
              {selectedProblem.root_cause || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="临时解决方案" span={2}>
              {selectedProblem.workaround || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="永久解决方案" span={2}>
              {selectedProblem.resolution || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建人">
              {selectedProblem.created_by || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {selectedProblem.created_at ? dayjs(selectedProblem.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="解决时间">
              {selectedProblem.resolved_at ? dayjs(selectedProblem.resolved_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="关闭时间">
              {selectedProblem.closed_at ? dayjs(selectedProblem.closed_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
            </Descriptions.Item>
          </Descriptions>
        </Card>

        {/* Related items */}
        <Card
          title="关联项"
          style={{ borderRadius: radius.lg, boxShadow: shadows.sm }}
          extra={
            <Space>
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  linkForm.resetFields();
                  setLinkIncidentModalVisible(true);
                }}
              >
                关联事件
              </Button>
              <Button
                size="small"
                icon={<LinkOutlined />}
                onClick={() => {
                  linkForm.resetFields();
                  setLinkChangeModalVisible(true);
                }}
              >
                关联变更
              </Button>
            </Space>
          }
        >
          <Row gutter={[spacing.md, spacing.md]}>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                关联事件 ({selectedProblem.related_incidents?.length || 0})
              </Text>
              {selectedProblem.related_incidents?.length > 0 ? (
                <Space wrap>
                  {selectedProblem.related_incidents.map((id) => (
                    <Tag key={id} color="red" style={{ cursor: 'pointer' }}>
                      <ExclamationCircleOutlined /> {id}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">暂无关联事件</Text>
              )}
            </Col>
            <Col xs={24} sm={12}>
              <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
                关联变更 ({selectedProblem.related_changes?.length || 0})
              </Text>
              {selectedProblem.related_changes?.length > 0 ? (
                <Space wrap>
                  {selectedProblem.related_changes.map((id) => (
                    <Tag key={id} color="blue" style={{ cursor: 'pointer' }}>
                      <ArrowRightOutlined /> {id}
                    </Tag>
                  ))}
                </Space>
              ) : (
                <Text type="secondary">暂无关联变更</Text>
              )}
            </Col>
          </Row>
        </Card>
      </Space>
    </Spin>
  ) : (
    <Empty description="请选择一个问题查看详情" />
  );

  // ============================================================================
  // Tab 3: KEDB
  // ============================================================================

  const kedbContent = (
    <div>
      {/* KEDB filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: spacing.sm,
          marginBottom: spacing.md,
          alignItems: 'center',
        }}
      >
        <Input
          placeholder="搜索已知错误..."
          prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
          value={kedbSearchQuery}
          onChange={(e) => setKedbSearchQuery(e.target.value)}
          style={{ width: 280, borderRadius: radius.sm }}
          allowClear
        />
        <Select
          placeholder="状态"
          value={kedbStatusFilter}
          onChange={setKedbStatusFilter}
          allowClear
          style={{ width: 130 }}
          options={[
            { label: '全部状态', value: undefined },
            { label: '活跃', value: 'active' },
            { label: '已解决', value: 'resolved' },
            { label: '已归档', value: 'archived' },
          ]}
        />
        <div style={{ flex: 1 }} />
        <Button icon={<ReloadOutlined />} onClick={loadKnownErrors}>
          刷新
        </Button>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setKedbModalVisible(true)}
        >
          新建已知错误
        </Button>
      </div>

      {/* KEDB table */}
      {knownErrors.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: `1px solid ${colors.neutral[200]}`,
                    background: colors.neutral[50],
                  }}
                >
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600 }}>标题</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 180 }}>症状</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 180 }}>根因</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 180 }}>临时方案</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 90 }}>状态</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 160 }}>关键词</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 170 }}>创建时间</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, width: 120 }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {knownErrors.map((ke) => {
                  const keStatus = knownErrorStatusConfig[ke.status] || knownErrorStatusConfig.active;
                  return (
                    <tr
                      key={ke.id}
                      style={{
                        borderBottom: `1px solid ${colors.neutral[100]}`,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.background = colors.primary[50];
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <td style={{ padding: '12px 16px' }}>
                        <Text strong>{ke.title}</Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text
                          type="secondary"
                          ellipsis={{ tooltip: ke.symptoms }}
                          style={{ maxWidth: 160, display: 'inline-block' }}
                        >
                          {ke.symptoms || '-'}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text
                          type="secondary"
                          ellipsis={{ tooltip: ke.root_cause }}
                          style={{ maxWidth: 160, display: 'inline-block' }}
                        >
                          {ke.root_cause || '-'}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text
                          type="secondary"
                          ellipsis={{ tooltip: ke.workaround }}
                          style={{ maxWidth: 160, display: 'inline-block' }}
                        >
                          {ke.workaround || '-'}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Tag color={keStatus.color}>{keStatus.label}</Tag>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Space wrap size={4}>
                          {(ke.keywords || []).slice(0, 3).map((kw) => (
                            <Tag key={kw} style={{ borderRadius: radius.tag }}>
                              {kw}
                            </Tag>
                          ))}
                          {(ke.keywords || []).length > 3 && (
                            <Tag>+{ke.keywords.length - 3}</Tag>
                          )}
                        </Space>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Text type="secondary" style={{ fontSize: 13 }}>
                          {ke.created_at ? dayjs(ke.created_at).format('YYYY-MM-DD HH:mm') : '-'}
                        </Text>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Space size={4}>
                          <Button
                            type="text"
                            size="small"
                            icon={<EditOutlined />}
                            onClick={() => handleOpenKedbEditModal(ke)}
                            title="编辑"
                          />
                          <Popconfirm
                            title="确定删除此已知错误?"
                            onConfirm={() => handleDeleteKnownError(ke.id)}
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                          >
                            <Button
                              type="text"
                              size="small"
                              danger
                              icon={<DeleteOutlined />}
                              title="删除"
                            />
                          </Popconfirm>
                        </Space>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* KEDB Pagination */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: spacing.md,
              gap: spacing.sm,
            }}
          >
            <Text type="secondary" style={{ lineHeight: '32px', fontSize: 13 }}>
              共 {kedbTotal} 条
            </Text>
            <Button
              size="small"
              disabled={kedbPage <= 1}
              onClick={() => setKedbPage((p) => p - 1)}
            >
              上一页
            </Button>
            <Badge count={kedbPage} style={{ backgroundColor: colors.primary[500] }} />
            <Button
              size="small"
              disabled={knownErrors.length < 20}
              onClick={() => setKedbPage((p) => p + 1)}
            >
              下一页
            </Button>
          </div>
        </>
      ) : (
        !kedbLoading && (
          <Empty description="暂无已知错误数据">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setKedbModalVisible(true)}
            >
              创建第一个已知错误
            </Button>
          </Empty>
        )
      )}
    </div>
  );

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <BugOutlined /> 问题列表
        </span>
      ),
      children: problemListContent,
    },
    {
      key: 'detail',
      label: (
        <span>
          <EyeOutlined /> 问题详情
        </span>
      ),
      children: problemDetailContent,
    },
    {
      key: 'kedb',
      label: (
        <span>
          <BookOutlined /> 已知错误库
        </span>
      ),
      children: kedbContent,
    },
  ];

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div style={{ padding: 0 }}>
      {/* Page header */}
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <BugOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          问题管理
        </Title>
        <Text type="secondary">管理问题生命周期，关联事件和变更，维护已知错误数据库</Text>
      </div>

      {/* Stats bar */}
      {statCards}

      {/* Main content with tabs */}
      <Spin spinning={loading}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="large"
        />
      </Spin>

      {/* ==================== Modals ==================== */}

      {/* Create Problem Modal */}
      <Modal
        title="新建问题"
        open={createModalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setCreateModalVisible(false);
          createForm.resetFields();
        }}
        okText="创建"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="问题标题"
            rules={[{ required: true, message: '请输入问题标题' }]}
          >
            <Input placeholder="简要描述问题" />
          </Form.Item>
          <Form.Item name="description" label="问题描述">
            <TextArea rows={3} placeholder="详细描述问题现象" />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={8}>
              <Form.Item
                name="severity"
                label="严重级别"
                rules={[{ required: true, message: '请选择严重级别' }]}
              >
                <Select
                  placeholder="选择级别"
                  options={[
                    { label: '严重', value: 'critical' },
                    { label: '高', value: 'high' },
                    { label: '中', value: 'medium' },
                    { label: '低', value: 'low' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="分类">
                <Input placeholder="问题分类" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assigned_to" label="负责人">
                <Input placeholder="分配给" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* Edit Problem Modal */}
      <Modal
        title="编辑问题"
        open={editModalVisible}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
        }}
        okText="保存"
        cancelText="取消"
        width={720}
        destroyOnClose
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="问题标题"
            rules={[{ required: true, message: '请输入问题标题' }]}
          >
            <Input placeholder="简要描述问题" />
          </Form.Item>
          <Form.Item name="description" label="问题描述">
            <TextArea rows={3} placeholder="详细描述问题现象" />
          </Form.Item>
          <Row gutter={spacing.md}>
            <Col span={8}>
              <Form.Item
                name="severity"
                label="严重级别"
                rules={[{ required: true, message: '请选择严重级别' }]}
              >
                <Select
                  placeholder="选择级别"
                  options={[
                    { label: '严重', value: 'critical' },
                    { label: '高', value: 'high' },
                    { label: '中', value: 'medium' },
                    { label: '低', value: 'low' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="分类">
                <Input placeholder="问题分类" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assigned_to" label="负责人">
                <Input placeholder="分配给" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="root_cause" label="根因分析">
            <TextArea rows={2} placeholder="问题的根本原因" />
          </Form.Item>
          <Form.Item name="workaround" label="临时解决方案">
            <TextArea rows={2} placeholder="临时规避方案" />
          </Form.Item>
          <Form.Item name="resolution" label="永久解决方案">
            <TextArea rows={2} placeholder="永久修复方案" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Link Incident Modal */}
      <Modal
        title="关联事件"
        open={linkIncidentModalVisible}
        onOk={handleLinkIncident}
        onCancel={() => {
          setLinkIncidentModalVisible(false);
          linkForm.resetFields();
        }}
        okText="关联"
        cancelText="取消"
        confirmLoading={linkingLoading}
        width={480}
        destroyOnClose
      >
        <Form form={linkForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="id"
            label="事件 ID"
            rules={[{ required: true, message: '请输入事件 ID' }]}
          >
            <Input placeholder="输入要关联的事件 ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Link Change Modal */}
      <Modal
        title="关联变更"
        open={linkChangeModalVisible}
        onOk={handleLinkChange}
        onCancel={() => {
          setLinkChangeModalVisible(false);
          linkForm.resetFields();
        }}
        okText="关联"
        cancelText="取消"
        confirmLoading={linkingLoading}
        width={480}
        destroyOnClose
      >
        <Form form={linkForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="id"
            label="变更 ID"
            rules={[{ required: true, message: '请输入变更 ID' }]}
          >
            <Input placeholder="输入要关联的变更 ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Known Error Modal */}
      <Modal
        title="新建已知错误"
        open={kedbModalVisible}
        onOk={handleCreateKnownError}
        onCancel={() => {
          setKedbModalVisible(false);
          kedbForm.resetFields();
        }}
        okText="创建"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={kedbForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="已知错误标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="详细描述" />
          </Form.Item>
          <Form.Item name="symptoms" label="症状">
            <TextArea rows={2} placeholder="可观测到的症状" />
          </Form.Item>
          <Form.Item name="root_cause" label="根因">
            <TextArea rows={2} placeholder="根本原因" />
          </Form.Item>
          <Form.Item name="workaround" label="临时方案">
            <TextArea rows={2} placeholder="临时解决方案" />
          </Form.Item>
          <Form.Item name="keywords" label="关键词" help="多个关键词用逗号分隔">
            <Input placeholder="关键词1, 关键词2, ..." />
          </Form.Item>
          <Form.Item name="problem_id" label="关联问题 ID">
            <Input placeholder="可选：关联的问题 ID" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Known Error Modal */}
      <Modal
        title="编辑已知错误"
        open={kedbEditModalVisible}
        onOk={handleEditKnownError}
        onCancel={() => {
          setKedbEditModalVisible(false);
          kedbEditForm.resetFields();
          setEditingKnownError(null);
        }}
        okText="保存"
        cancelText="取消"
        width={640}
        destroyOnClose
      >
        <Form form={kedbEditForm} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="已知错误标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="详细描述" />
          </Form.Item>
          <Form.Item name="symptoms" label="症状">
            <TextArea rows={2} placeholder="可观测到的症状" />
          </Form.Item>
          <Form.Item name="root_cause" label="根因">
            <TextArea rows={2} placeholder="根本原因" />
          </Form.Item>
          <Form.Item name="workaround" label="临时方案">
            <TextArea rows={2} placeholder="临时解决方案" />
          </Form.Item>
          <Form.Item name="keywords" label="关键词" help="多个关键词用逗号分隔">
            <Input placeholder="关键词1, 关键词2, ..." />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select
              options={[
                { label: '活跃', value: 'active' },
                { label: '已解决', value: 'resolved' },
                { label: '已归档', value: 'archived' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProblemPage;
