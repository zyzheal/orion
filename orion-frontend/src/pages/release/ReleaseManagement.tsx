/**
 * Release Management Page
 *
 * Features:
 * - Release overview statistics
 * - Release list with status filtering and actions
 * - Monthly release calendar
 * - Create new release flow
 * - Approval workflow (approve/reject)
 *
 * P3-01 Task
 */

import React, { useState, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Typography,
  Statistic,
  message,
  Empty,
} from 'antd';
import {
  DeploymentUnitOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  EyeOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, componentRadius } from '@/tokens';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ==================== Types ====================

type ReleaseStatus =
  | 'planned'
  | 'draft'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'rolled_back';

interface Release {
  id: string;
  name: string;
  version: string;
  status: ReleaseStatus;
  owner: string;
  planDate: string;
  pipeline: string;
  description: string;
  approver: string;
  createdAt: string;
  updatedAt: string;
}

interface ReleaseCalendarDay {
  date: number;
  hasRelease: boolean;
  releaseCount: number;
}

// ==================== Status Configuration ====================

const STATUS_CONFIG: Record<ReleaseStatus, { color: string; label: string; icon: React.ReactNode }> = {
  planned: {
    color: colors.primary[500],
    label: '已计划',
    icon: <ClockCircleOutlined />,
  },
  draft: {
    color: colors.neutral[500],
    label: '草稿',
    icon: null,
  },
  approved: {
    color: colors.success[500],
    label: '已审批',
    icon: <CheckCircleOutlined />,
  },
  in_progress: {
    color: colors.purple[500],
    label: '发布中',
    icon: <ClockCircleOutlined />,
  },
  completed: {
    color: colors.success[500],
    label: '已完成',
    icon: <CheckCircleOutlined />,
  },
  failed: {
    color: colors.error[500],
    label: '失败',
    icon: <CloseCircleOutlined />,
  },
  rolled_back: {
    color: colors.warning[500],
    label: '已回滚',
    icon: <ClockCircleOutlined />,
  },
};

// ==================== Mock Data ====================

const MOCK_RELEASES: Release[] = [
  {
    id: 'REL-001',
    name: '核心平台 v2.8.0 发布',
    version: 'v2.8.0',
    status: 'in_progress',
    owner: '张明',
    planDate: '2026-08-05',
    pipeline: 'pipeline-core-deploy-001',
    description: '核心平台季度大版本发布，包含 CI/CD 引擎升级、监控增强',
    approver: '李总',
    createdAt: '2026-07-28T09:00:00Z',
    updatedAt: '2026-08-05T10:30:00Z',
  },
  {
    id: 'REL-002',
    name: 'AI 服务平台灰度发布',
    version: 'v1.5.1',
    status: 'approved',
    owner: '王芳',
    planDate: '2026-08-10',
    pipeline: 'pipeline-ai-service-canary',
    description: 'AI 服务灰度发布，增加模型热加载能力',
    approver: '赵工',
    createdAt: '2026-08-01T14:00:00Z',
    updatedAt: '2026-08-03T16:00:00Z',
  },
  {
    id: 'REL-003',
    name: '前端微前端框架升级',
    version: 'v3.0.0',
    status: 'planned',
    owner: '陈伟',
    planDate: '2026-08-15',
    pipeline: 'pipeline-frontend-mf-upgrade',
    description: 'Orion-MF 微前端框架从 v2 升级到 v3，支持子应用沙箱隔离',
    approver: '',
    createdAt: '2026-08-02T11:00:00Z',
    updatedAt: '2026-08-02T11:00:00Z',
  },
  {
    id: 'REL-004',
    name: '数据库迁移补丁 v2.7.4',
    version: 'v2.7.4',
    status: 'completed',
    owner: '刘洋',
    planDate: '2026-07-25',
    pipeline: 'pipeline-db-migration-fix',
    description: '修复 PostgreSQL 迁移脚本中的索引缺失问题',
    approver: '李总',
    createdAt: '2026-07-20T08:00:00Z',
    updatedAt: '2026-07-25T18:00:00Z',
  },
  {
    id: 'REL-005',
    name: '告警规则引擎重构',
    version: 'v1.2.0',
    status: 'failed',
    owner: '孙丽',
    planDate: '2026-08-02',
    pipeline: 'pipeline-alert-engine-rebuild',
    description: '告警去重和聚合规则引擎重写，引入动态阈值',
    approver: '赵工',
    createdAt: '2026-07-25T10:00:00Z',
    updatedAt: '2026-08-02T14:30:00Z',
  },
  {
    id: 'REL-006',
    name: 'CMDB 适配器扩展',
    version: 'v1.1.0',
    status: 'rolled_back',
    owner: '周强',
    planDate: '2026-07-30',
    pipeline: 'pipeline-cmdb-adapter-v2',
    description: '新增 Zabbix 和 NetBox CMDB 适配器支持',
    approver: '李总',
    createdAt: '2026-07-22T09:00:00Z',
    updatedAt: '2026-08-01T12:00:00Z',
  },
  {
    id: 'REL-007',
    name: '安全扫描模块迭代',
    version: 'v0.9.0',
    status: 'draft',
    owner: '吴磊',
    planDate: '2026-08-20',
    pipeline: '',
    description: '新增容器镜像扫描、供应链依赖分析',
    approver: '',
    createdAt: '2026-08-04T15:00:00Z',
    updatedAt: '2026-08-04T15:00:00Z',
  },
  {
    id: 'REL-008',
    name: 'API 网关限流优化',
    version: 'v2.3.1',
    status: 'approved',
    owner: '郑楠',
    planDate: '2026-08-12',
    pipeline: 'pipeline-gateway-rate-limit',
    description: 'API 网关引入动态限流策略，支持按租户维度限流',
    approver: '赵工',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-04T09:00:00Z',
  },
  {
    id: 'REL-009',
    name: '工单系统流程引擎升级',
    version: 'v2.0.0',
    status: 'in_progress',
    owner: '黄涛',
    planDate: '2026-08-07',
    pipeline: 'pipeline-ticket-engine-v2',
    description: '工单审批流引擎从硬编码迁移到 DSL 配置化',
    approver: '李总',
    createdAt: '2026-07-30T08:00:00Z',
    updatedAt: '2026-08-07T11:00:00Z',
  },
  {
    id: 'REL-010',
    name: '可观测性平台 v3.1',
    version: 'v3.1.0',
    status: 'planned',
    owner: '马静',
    planDate: '2026-08-25',
    pipeline: 'pipeline-observability-v3',
    description: '统一 Trace/Metric/Log 三支柱平台，引入 OpenTelemetry 标准',
    approver: '',
    createdAt: '2026-08-05T13:00:00Z',
    updatedAt: '2026-08-05T13:00:00Z',
  },
];

// ==================== Component ====================

const ReleaseManagement: React.FC = () => {
  // ==================== State ====================

  const [releases, setReleases] = useState<Release[]>(MOCK_RELEASES);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createFormVisible, setCreateFormVisible] = useState(false);
  const [createForm] = Form.useForm();
  const [createFormLoading, setCreateFormLoading] = useState(false);
  const [approveModalVisible, setApproveModalVisible] = useState(false);
  const [approveForm] = Form.useForm();
  const [approveLoading, setApproveLoading] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // ==================== Calendar Logic ====================

  const today = dayjs();
  const calendarDays: ReleaseCalendarDay[] = useMemo(() => {
    const daysInMonth = today.daysInMonth();
    const result: ReleaseCalendarDay[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = today
        .year()
        .toString()
        .padStart(4, '0') +
        '-' +
        String(today.month() + 1)
          .padStart(2, '0') +
        '-' +
        day.toString().padStart(2, '0');
      const dayReleases = releases.filter((r) => r.planDate === dayStr);
      result.push({
        date: day,
        hasRelease: dayReleases.length > 0,
        releaseCount: dayReleases.length,
      });
    }
    return result;
  }, [releases, today]);

  const firstDayOfMonth = today.startOf('month').day();
  const emptyDays: number[] = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    emptyDays.push(i);
  }

  // ==================== Statistics ====================

  const stats = useMemo(() => {
    const active = releases.filter(
      (r) => r.status === 'in_progress' || r.status === 'approved' || r.status === 'planned'
    ).length;
    const thisMonth = releases.filter((r) => {
      const d = dayjs(r.planDate);
      return d.year() === today.year() && d.month() === today.month();
    }).length;
    const pendingApproval = releases.filter(
      (r) => r.status === 'planned' || r.status === 'draft'
    ).length;
    const successRate = releases.length > 0
      ? Math.round((releases.filter((r) => r.status === 'completed').length / releases.length) * 100)
      : 0;
    return { active, thisMonth, pendingApproval, successRate };
  }, [releases, today]);

  // ==================== Table Filtering ====================

  const filteredReleases = useMemo(() => {
    if (statusFilter === 'all') return releases;
    return releases.filter((r) => r.status === statusFilter);
  }, [releases, statusFilter]);

  // ==================== Status Badge ====================

  const renderStatusTag = (status: ReleaseStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Tag
        color={config.color}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          fontWeight: 500,
        }}
      >
        {config.icon && <span>{config.icon}</span>}
        {config.label}
      </Tag>
    );
  };

  // ==================== Table Columns ====================

  const columns = [
    {
      title: '发布名称',
      dataIndex: 'name',
      key: 'name',
      width: 220,
      render: (name: string, record: Release) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{name}</Text>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.id}</Text>
          </div>
        </div>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      width: 90,
      render: (version: string) => (
        <Text code style={{ fontSize: 13, color: colors.primary[500] }}>{version}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ReleaseStatus) => renderStatusTag(status),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      key: 'owner',
      width: 100,
    },
    {
      title: '计划日期',
      dataIndex: 'planDate',
      key: 'planDate',
      width: 110,
      render: (date: string) => <Text style={{ fontSize: 13 }}>{date}</Text>,
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: Release) => (
        <Space size={8}>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedRelease(record);
              setDetailModalVisible(true);
            }}
            style={{ color: colors.primary[500] }}
          >
            详情
          </Button>
          {record.status === 'approved' && (
            <Button
              type="primary"
              size="small"
              icon={<FileTextOutlined />}
              onClick={() => {
                setSelectedRelease(record);
                setApproveModalVisible(true);
              }}
              style={{
                backgroundColor: colors.primary[500],
                borderColor: colors.primary[500],
              }}
            >
              审批
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ==================== Handlers ====================

  const handleCreateRelease = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateFormLoading(true);
      // Simulate async
      await new Promise((resolve) => setTimeout(resolve, 800));

      const newRelease: Release = {
        id: `REL-${String(releases.length + 1).padStart(3, '0')}`,
        name: values.releaseName,
        version: values.version,
        status: 'draft',
        owner: '当前用户',
        planDate: dayjs(values.planDate).format('YYYY-MM-DD'),
        pipeline: values.pipeline || '',
        description: values.description || '',
        approver: values.approver || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setReleases((prev) => [newRelease, ...prev]);
      createForm.resetFields();
      setCreateFormVisible(false);
      message.success(`发布 "${newRelease.name}" 已创建`);
    } catch {
      // Validation failed, do nothing
    } finally {
      setCreateFormLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const values = await approveForm.validateFields();
      if (!selectedRelease) return;
      setApproveLoading(true);
      await new Promise((resolve) => setTimeout(resolve, 600));

      const newStatus: ReleaseStatus = values.approvalAction === 'approve' ? 'in_progress' : 'failed';
      setReleases((prev) =>
        prev.map((r) =>
          r.id === selectedRelease.id
            ? {
                ...r,
                status: newStatus,
                updatedAt: new Date().toISOString(),
                approver: r.approver || values.approverNote,
              }
            : r
        )
      );
      approveForm.resetFields();
      setApproveModalVisible(false);
      const actionLabel = values.approvalAction === 'approve' ? '已通过' : '已拒绝';
      message.success(`发布 "${selectedRelease.name}" 审批${actionLabel}`);
    } catch {
      // Validation failed
    } finally {
      setApproveLoading(false);
    }
  };

  // ==================== Calendar Cell Render ====================

  const calendarCellStyle = (day: ReleaseCalendarDay, isToday: boolean) => {
    const base: React.CSSProperties = {
      height: 40,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 4,
      cursor: 'pointer',
      transition: 'background-color 200ms',
      position: 'relative',
    };
    if (isToday) {
      return { ...base, backgroundColor: colors.primary[50], fontWeight: 600 };
    }
    if (day.hasRelease) {
      return {
        ...base,
        backgroundColor: colors.primary[50],
        color: colors.primary[700],
        fontWeight: 600,
      };
    }
    return base;
  };

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900] }}>
        <DeploymentUnitOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        发布管理
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.lg, display: 'block' }}>
        版本规划 · 发布审批 · 变更记录 · 发布日历
      </Text>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.primary[500]}`,
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  活跃发布数
                </Text>
              }
              value={stats.active}
              valueStyle={{ color: colors.primary[500], fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.success[500]}`,
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  本月发布次数
                </Text>
              }
              value={stats.thisMonth}
              valueStyle={{ color: colors.success[500], fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.warning[500]}`,
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  待审批
                </Text>
              }
              value={stats.pendingApproval}
              valueStyle={{ color: colors.warning[500], fontSize: 28 }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.info[500]}`,
            }}
          >
            <Statistic
              title={
                <Text type="secondary" style={{ fontSize: 13 }}>
                  发布成功率
                </Text>
              }
              value={stats.successRate}
              suffix="%"
              valueStyle={{ color: colors.info[500], fontSize: 28 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Main Content Area */}
      <Row gutter={[16, 16]}>
        {/* Left: Release List */}
        <Col span={16}>
          <Card
            title="发布列表"
            extra={
              <Space>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 130 }}
                  size="small"
                >
                  <Select.Option value="all">全部状态</Select.Option>
                  <Select.Option value="planned">已计划</Select.Option>
                  <Select.Option value="draft">草稿</Select.Option>
                  <Select.Option value="approved">已审批</Select.Option>
                  <Select.Option value="in_progress">发布中</Select.Option>
                  <Select.Option value="completed">已完成</Select.Option>
                  <Select.Option value="failed">失败</Select.Option>
                  <Select.Option value="rolled_back">已回滚</Select.Option>
                </Select>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateFormVisible(true)}
                  style={{
                    backgroundColor: colors.primary[500],
                    borderColor: colors.primary[500],
                  }}
                >
                  新建发布
                </Button>
              </Space>
            }
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            {filteredReleases.length === 0 ? (
              <Empty description="暂无发布记录" />
            ) : (
              <Table
                columns={columns}
                dataSource={filteredReleases}
                rowKey="id"
                size="middle"
                rowClassName={() => 'release-table-row'}
                style={{
                    '--primary-color': colors.primary[500],
                } as React.CSSProperties}
                rowHoverable
              />
            )}
          </Card>
        </Col>

        {/* Right: Release Calendar */}
        <Col span={8}>
          <Card
            title={
              <Space>
                <CalendarOutlined style={{ color: colors.primary[500] }} />
                <Text strong>
                  {today.format('YYYY 年 MM 月')} 发布日历
                </Text>
              </Space>
            }
            style={{
              borderRadius: componentRadius.card,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
                marginBottom: 12,
              }}
            >
              {['日', '一', '二', '三', '四', '五', '六'].map((d, i) => (
                <div
                  key={i}
                  style={{
                    textAlign: 'center',
                    fontSize: 12,
                    color: colors.neutral[500],
                    fontWeight: 500,
                    padding: '4px 0',
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 4,
              }}
            >
              {emptyDays.map((i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarDays.map((day) => {
                const isToday = day.date === today.date();
                return (
                  <div
                    key={day.date}
                    style={calendarCellStyle(day, isToday)}
                    title={day.hasRelease ? `${day.releaseCount} 个发布` : ''}
                  >
                    <Text style={{ fontSize: 12 }}>{day.date}</Text>
                    {day.hasRelease && (
                      <Tag
                        color={colors.primary[500]}
                        style={{
                          marginTop: 2,
                          fontSize: 10,
                          padding: '0 4px',
                          height: 16,
                        }}
                      >
                        {day.releaseCount}
                      </Tag>
                    )}
                  </div>
                );
              })}
            </div>
            <div
              style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: colors.light.bg.secondary,
                borderRadius: 4,
              }}
            >
              <Space size={12} style={{ flexWrap: 'wrap', fontSize: 12 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: colors.primary[500],
                    }}
                  />
                  <Text type="secondary">有发布计划</Text>
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: colors.primary[100],
                      border: `1px solid ${colors.primary[300]}`,
                    }}
                  />
                  <Text type="secondary">今天</Text>
                </span>
              </Space>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Create Release Modal */}
      <Modal
        title="新建发布"
        open={createFormVisible}
        onCancel={() => {
          setCreateFormVisible(false);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={600}
        style={{ top: 80 }}
      >
        <Form
          form={createForm}
          layout="vertical"
          requiredMark="optional"
        >
          <Form.Item
            label="发布名称"
            name="releaseName"
            rules={[{ required: true, message: '请输入发布名称' }]}
          >
            <Input placeholder="例：核心平台 v2.8.0 发布" />
          </Form.Item>
          <Form.Item
            label="版本号"
            name="version"
            rules={[
              { required: true, message: '请输入版本号' },
              { pattern: /^v?\d+\.\d+\.\d+$/, message: '版本号格式如 v1.2.3' },
            ]}
          >
            <Input placeholder="例：v1.2.3" />
          </Form.Item>
          <Form.Item
            label="计划日期"
            name="planDate"
            rules={[{ required: true, message: '请选择计划日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="选择计划发布日期" />
          </Form.Item>
          <Form.Item label="关联 Pipeline" name="pipeline">
            <Select
              placeholder="选择关联的 Pipeline（可选）"
              allowClear
              showSearch
              optionFilterProp="children"
            >
              <Select.Option value="pipeline-core-deploy-001">pipeline-core-deploy-001</Select.Option>
              <Select.Option value="pipeline-ai-service-canary">pipeline-ai-service-canary</Select.Option>
              <Select.Option value="pipeline-frontend-mf-upgrade">pipeline-frontend-mf-upgrade</Select.Option>
              <Select.Option value="pipeline-db-migration-fix">pipeline-db-migration-fix</Select.Option>
              <Select.Option value="pipeline-alert-engine-rebuild">pipeline-alert-engine-rebuild</Select.Option>
              <Select.Option value="pipeline-gateway-rate-limit">pipeline-gateway-rate-limit</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="发布说明" name="description">
            <TextArea
              rows={3}
              placeholder="描述本次发布的内容和变更范围"
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item label="审批人" name="approver">
            <Input placeholder="指定审批人（可选）" allowClear />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setCreateFormVisible(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                loading={createFormLoading}
                onClick={handleCreateRelease}
                style={{
                  backgroundColor: colors.primary[500],
                  borderColor: colors.primary[500],
                }}
              >
                创建发布
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Approval Modal */}
      <Modal
        title={
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            <Text strong>审批发布</Text>
          </Space>
        }
        open={approveModalVisible}
        onCancel={() => {
          setApproveModalVisible(false);
          approveForm.resetFields();
        }}
        footer={null}
        destroyOnClose
        width={560}
        style={{ top: 80 }}
      >
        {selectedRelease && (
          <>
            <div
              style={{
                padding: 12,
                backgroundColor: colors.light.bg.secondary,
                borderRadius: 4,
                marginBottom: 16,
              }}
            >
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>发布名称</Text>
                <div>
                  <Text strong style={{ fontSize: 14 }}>{selectedRelease.name}</Text>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>版本</Text>
                  <div>
                    <Text code style={{ color: colors.primary[500] }}>
                      {selectedRelease.version}
                    </Text>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>计划日期</Text>
                  <div>
                    <Text>{selectedRelease.planDate}</Text>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>负责人</Text>
                  <div>
                    <Text>{selectedRelease.owner}</Text>
                  </div>
                </div>
              </div>
            </div>
            <Form form={approveForm} layout="vertical">
              <Form.Item
                label="审批决定"
                name="approvalAction"
                rules={[{ required: true, message: '请选择审批决定' }]}
              >
                <Select placeholder="选择审批结果">
                  <Select.Option value="approve">
                    <span style={{ color: colors.success[500] }}>
                      <CheckCircleOutlined /> 审批通过
                    </span>
                  </Select.Option>
                  <Select.Option value="reject">
                    <span style={{ color: colors.error[500] }}>
                      <CloseCircleOutlined /> 拒绝发布
                    </span>
                  </Select.Option>
                </Select>
              </Form.Item>
              <Form.Item
                label="审批意见"
                name="approverNote"
                rules={[{ required: true, message: '请输入审批意见' }]}
              >
                <TextArea rows={3} placeholder="填写审批意见（必填）" maxLength={200} showCount />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setApproveModalVisible(false)}>取消</Button>
                  <Button
                    type="primary"
                    loading={approveLoading}
                    onClick={handleApprove}
                    style={{
                      backgroundColor: colors.primary[500],
                      borderColor: colors.primary[500],
                    }}
                  >
                    提交审批
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={
          <Space>
            <EyeOutlined style={{ color: colors.primary[500] }} />
            <Text strong>发布详情</Text>
          </Space>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        destroyOnClose
        width={600}
        style={{ top: 80 }}
      >
        {selectedRelease && (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                marginBottom: 16,
                padding: 16,
                backgroundColor: colors.light.bg.secondary,
                borderRadius: 4,
              }}
            >
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>发布名称</Text>
                <div>
                  <Text strong style={{ fontSize: 14 }}>{selectedRelease.name}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
                <div style={{ marginTop: 2 }}>{renderStatusTag(selectedRelease.status)}</div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>版本号</Text>
                <div>
                  <Text code style={{ color: colors.primary[500] }}>
                    {selectedRelease.version}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>计划日期</Text>
                <div>
                  <Text>{selectedRelease.planDate}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>负责人</Text>
                <div>
                  <Text>{selectedRelease.owner}</Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>关联 Pipeline</Text>
                <div>
                  <Text code style={{ fontSize: 12 }}>
                    {selectedRelease.pipeline || '—'}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>创建时间</Text>
                <div>
                  <Text style={{ fontSize: 12 }}>
                    {dayjs(selectedRelease.createdAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </div>
              </div>
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>更新时间</Text>
                <div>
                  <Text style={{ fontSize: 12 }}>
                    {dayjs(selectedRelease.updatedAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>发布说明</Text>
              <div style={{ marginTop: 4 }}>
                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  {selectedRelease.description || '—'}
                </Paragraph>
              </div>
            </div>
            {selectedRelease.approver && (
              <div>
                <Text type="secondary" style={{ fontSize: 12 }}>审批人</Text>
                <div style={{ marginTop: 4 }}>
                  <Text>{selectedRelease.approver}</Text>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReleaseManagement;
