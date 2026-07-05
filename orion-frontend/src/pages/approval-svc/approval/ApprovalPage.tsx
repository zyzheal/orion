/**
 * ApprovalPage (Phase 2)
 * 审批工作流页 - 多级审批流程、待审批列表、紧急审批通道
 *
 * Note: This is an enhanced version of Approvals/index.tsx with additional
 * features like approval templates, SLA tracking, and emergency approval channel.
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Tag,
  Space,
  Button,
  Modal,
  Form,
  Input,
  Select,
  message,
  Descriptions,
  Drawer,
  Tooltip,
  Progress,
  Avatar,
  Steps,
  Timeline,
  Statistic,
  Row,
  Col,
  Alert,
} from 'antd';
import {
  ReloadOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  FireOutlined,
  FormOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import PageSkeleton from '@/components/PageSkeleton';
import TableComponent from '@/components/Table';
import {
  getApprovals,
  getApproval,
  createApproval,
  approveApproval,
  rejectApproval,
  type ApprovalRequest,
  type CreateApprovalInput,
  type ApprovalStatus,
  type ApprovalComment,
} from '@/api/approvals';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { spacing } from '@/tokens';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ---- Color maps ----

const statusColorMap: Record<ApprovalStatus, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
  cancelled: 'default',
};

const statusLabelMap: Record<ApprovalStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
};

// ---- Templates ----

interface ApprovalTemplate {
  id: string;
  name: string;
  description: string;
  approverRoles: string[];
  requiredApprovals: number;
  slaMinutes: number;
  icon: string;
}

const APPROVAL_TEMPLATES: ApprovalTemplate[] = [
  { id: 'deployment', name: '生产部署审批', description: '生产环境部署需要技术负责人和运维负责人审批', approverRoles: ['tech-lead', 'ops-manager'], requiredApprovals: 2, slaMinutes: 60, icon: 'deployment' },
  { id: 'database', name: '数据库变更审批', description: '数据库结构变更需要 DBA 和技术负责人审批', approverRoles: ['dba', 'tech-lead'], requiredApprovals: 2, slaMinutes: 120, icon: 'database' },
  { id: 'security', name: '安全审批', description: '安全相关变更需要安全团队审批', approverRoles: ['security-lead'], requiredApprovals: 1, slaMinutes: 30, icon: 'security' },
  { id: 'infrastructure', name: '基础设施审批', description: '基础设施变更需要 SRE 团队审批', approverRoles: ['sre-lead', 'ops-manager'], requiredApprovals: 2, slaMinutes: 120, icon: 'infrastructure' },
];

// ---- Stats Panel ----

const StatsPanel: React.FC<{ approvals: ApprovalRequest[] }> = ({ approvals }) => {
  const stats = {
    total: approvals.length,
    pending: approvals.filter((a) => a.status === 'pending').length,
    approved: approvals.filter((a) => a.status === 'approved').length,
    rejected: approvals.filter((a) => a.status === 'rejected').length,
  };

  return (
    <Card size="small" style={{ marginBottom: spacing.md }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic title="总计" value={stats.total} />
        </Col>
        <Col span={6}>
          <Statistic title="待审批" value={stats.pending} valueStyle={{ color: colors.primary[500] }} prefix={<ClockCircleOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="已通过" value={stats.approved} valueStyle={{ color: colors.success[500] }} prefix={<CheckCircleOutlined />} />
        </Col>
        <Col span={6}>
          <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: colors.error[400] }} prefix={<StopOutlined />} />
        </Col>
      </Row>
    </Card>
  );
};

// ---- Main Component ----

const ApprovalPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [emergencyModalVisible, setEmergencyModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [createForm] = Form.useForm();
  const [emergencyForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId] = useState('current-user');

  // Comment modal state
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentAction, setCommentAction] = useState<'approve' | 'reject'>('approve');
  const [commentTargetId, setCommentTargetId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getApprovals();
      const list = res.data?.approvals;
      setApprovals(Array.isArray(list) ? list : []);
    } catch (error: unknown) {
      setApprovals([]);
      message.error(`加载审批数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredData = approvals.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !a.title.toLowerCase().includes(q) &&
        !(a.description && a.description.toLowerCase().includes(q)) &&
        !a.requesterId.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const approverList = (values.approverIds as string)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const payload: CreateApprovalInput = {
        title: values.title,
        description: values.description,
        requesterId: values.requesterId || currentUserId,
        approverIds: approverList,
        requiredApprovals: values.requiredApprovals || 1,
        metadata: values.metadata ? { resourceType: values.metadata } : undefined,
      };
      await createApproval(payload);
      message.success('审批请求创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEmergencyCreate = async () => {
    try {
      const values = await emergencyForm.validateFields();
      setSubmitting(true);
      const payload: CreateApprovalInput = {
        title: `[紧急] ${values.title}`,
        description: values.description,
        requesterId: values.requesterId || currentUserId,
        approverIds: (values.approverIds as string).split(',').map((s: string) => s.trim()).filter(Boolean),
        requiredApprovals: 1,
        metadata: { resourceType: values.resourceType, priority: 'urgent' },
      };
      await createApproval(payload);
      message.success('紧急审批已创建，已通知相关审批人');
      setEmergencyModalVisible(false);
      emergencyForm.resetFields();
      loadData();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleTemplateSelect = (template: ApprovalTemplate) => {
    createForm.setFieldsValue({
      title: template.name,
      description: template.description,
      approverIds: template.approverRoles.join(', '),
      requiredApprovals: template.requiredApprovals,
      metadata: template.id,
    });
  };

  const handleApprove = async (id: string, comment?: string) => {
    try {
      await approveApproval(id, { userId: currentUserId, comment });
      message.success('审批通过');
      loadData();
      if (selectedApproval?.id === id) loadDetail(id);
    } catch (error: unknown) {
      message.error(`审批操作失败: ${(error as Error).message}`);
    }
  };

  const handleReject = async (id: string, comment?: string) => {
    try {
      await rejectApproval(id, { userId: currentUserId, comment });
      message.success('已拒绝');
      loadData();
      if (selectedApproval?.id === id) loadDetail(id);
    } catch (error: unknown) {
      message.error(`拒绝操作失败: ${(error as Error).message}`);
    }
  };

  const openCommentModal = (id: string, action: 'approve' | 'reject') => {
    setCommentTargetId(id);
    setCommentAction(action);
    setCommentText('');
    setCommentModalVisible(true);
  };

  const handleCommentSubmit = async () => {
    setCommentSubmitting(true);
    try {
      if (commentAction === 'approve') {
        await handleApprove(commentTargetId, commentText.trim() || undefined);
      } else {
        await handleReject(commentTargetId, commentText.trim() || undefined);
      }
      setCommentModalVisible(false);
    } finally {
      setCommentSubmitting(false);
    }
  };

  const openDetail = (a: ApprovalRequest) => {
    setSelectedApproval(a);
    setDetailDrawerVisible(true);
  };

  const loadDetail = async (id: string) => {
    try {
      const res = await getApproval(id);
      const detail = res.data;
      if (detail) setSelectedApproval(detail);
    } catch {
      // fallback
    }
  };

  const approvalProgress = (record: ApprovalRequest): number => {
    if (record.status === 'approved') return 100;
    if (record.status === 'rejected') return 100;
    return Math.round((record.approvals.length / record.requiredApprovals) * 100);
  };

  // Calculate SLA status
  const getSLAStatus = (record: ApprovalRequest): { label: string; color: string; expired: boolean } => {
    if (record.status !== 'pending') return { label: '已完成', color: 'success', expired: false };
    const createdAt = dayjs(record.createdAt);
    const now = dayjs();
    const hours = now.diff(createdAt, 'hours');
    if (hours > 24) return { label: '已超时', color: 'error', expired: true };
    if (hours > 12) return { label: '即将超时', color: 'warning', expired: false };
    return { label: `${hours}h`, color: 'processing', expired: false };
  };

  // ---- Table columns ----

  const columns = [
    {
      key: 'title',
      title: '审批标题',
      dataIndex: 'title',
      width: 260,
      render: (_: unknown, record: ApprovalRequest) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
            {record.title}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            申请人: {record.requesterId}
            {record.metadata?.resourceType != null && ` | 类型: ${record.metadata.resourceType as string}`}
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: ApprovalRequest) => (
        <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
      ),
    },
    {
      key: 'progress',
      title: '审批进度',
      width: 180,
      render: (_: unknown, record: ApprovalRequest) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Progress
            percent={approvalProgress(record)}
            size="small"
            status={record.status === 'rejected' ? 'exception' : record.status === 'approved' ? 'success' : 'active'}
            format={() => `${record.approvals.length}/${record.requiredApprovals}`}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>需要 {record.requiredApprovals} 个审批</Text>
        </Space>
      ),
    },
    {
      key: 'sla',
      title: 'SLA',
      width: 100,
      render: (_: unknown, record: ApprovalRequest) => {
        const sla = getSLAStatus(record);
        return (
          <Tag color={sla.color}>
            {sla.expired && <StopOutlined />} {sla.label}
          </Tag>
        );
      },
    },
    {
      key: 'approvers',
      title: '审批人',
      width: 200,
      render: (_: unknown, record: ApprovalRequest) => (
        <Space size={4} wrap>
          {record.approverIds.slice(0, 3).map((uid: string) => {
            const hasApproved = record.approvals.includes(uid);
            const hasRejected = record.rejections.includes(uid);
            return (
              <Tooltip key={uid} title={`${uid}${hasApproved ? ' (已通过)' : hasRejected ? ' (已拒绝)' : ''}`}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{
                    backgroundColor: hasApproved ? colors.success[500] : hasRejected ? colors.error[400] : colors.neutral[300],
                  }}
                >
                  {uid.substring(0, 2)}
                </Avatar>
              </Tooltip>
            );
          })}
          {record.approverIds.length > 3 && <Text type="secondary">+{record.approverIds.length - 3}</Text>}
        </Space>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: unknown) => <Text type="secondary">{dayjs(String(v)).fromNow()}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: ApprovalRequest) => (
        <Space size="small" wrap>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>详情</Button>
          {record.status === 'pending' && (
            <>
              <Button type="link" size="small" style={{ color: colors.success[500] }} icon={<CheckOutlined />} onClick={() => openCommentModal(record.id, 'approve')}>通过</Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => openCommentModal(record.id, 'reject')}>拒绝</Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ---- Detail Drawer ----

  const detailContent = selectedApproval ? (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="标题" span={2}>{selectedApproval.title}</Descriptions.Item>
        <Descriptions.Item label="状态"><Tag color={statusColorMap[selectedApproval.status]}>{statusLabelMap[selectedApproval.status]}</Tag></Descriptions.Item>
        <Descriptions.Item label="SLA">
          {(() => {
            const sla = getSLAStatus(selectedApproval);
            return <Tag color={sla.color}>{sla.label}</Tag>;
          })()}
        </Descriptions.Item>
        <Descriptions.Item label="申请人">{selectedApproval.requesterId}</Descriptions.Item>
        <Descriptions.Item label="所需审批数">{selectedApproval.requiredApprovals}</Descriptions.Item>
        <Descriptions.Item label="创建时间">{dayjs(selectedApproval.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        <Descriptions.Item label="更新时间" span={2}>{dayjs(selectedApproval.updatedAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
        {selectedApproval.description && (
          <Descriptions.Item label="描述" span={2}>{selectedApproval.description}</Descriptions.Item>
        )}
      </Descriptions>

      {/* Approval Steps */}
      <Card size="small" title="审批流程">
        <Steps
          current={selectedApproval.status === 'approved' ? selectedApproval.approverIds.length : selectedApproval.approvals.length}
          direction="vertical"
          size="small"
        >
          {selectedApproval.approverIds.map((uid: string) => {
            const hasApproved = selectedApproval.approvals.includes(uid);
            const hasRejected = selectedApproval.rejections.includes(uid);
            return (
              <Steps.Step
                key={uid}
                title={uid}
                status={hasRejected ? 'error' : hasApproved ? 'finish' : 'wait'}
                description={
                  hasApproved ? '已通过' : hasRejected ? '已拒绝' : '待审批'
                }
              />
            );
          })}
        </Steps>
      </Card>

      {/* Comment History */}
      {selectedApproval.comments && selectedApproval.comments.length > 0 && (
        <Card size="small" title="审批评论">
          <Timeline>
            {selectedApproval.comments.map((c: ApprovalComment, idx: number) => (
              <Timeline.Item
                key={idx}
                color={c.action === 'approved' ? 'green' : 'red'}
                dot={c.action === 'approved' ? <CheckCircleOutlined /> : <StopOutlined />}
              >
                <Text strong>{c.userId}</Text>
                <Tag color={c.action === 'approved' ? 'success' : 'error'} style={{ marginLeft: spacing.sm }}>
                  {c.action === 'approved' ? '通过' : '拒绝'}
                </Tag>
                <Text type="secondary" style={{ marginLeft: spacing.sm, fontSize: 12 }}>
                  {dayjs(c.createdAt).fromNow()}
                </Text>
                {c.comment && <div style={{ marginTop: 4 }}>{c.comment}</div>}
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* Action buttons */}
      {selectedApproval.status === 'pending' && (
        <Space>
          <Button type="primary" icon={<CheckOutlined />} style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }} onClick={() => openCommentModal(selectedApproval.id, 'approve')}>通过</Button>
          <Button danger icon={<CloseOutlined />} onClick={() => openCommentModal(selectedApproval.id, 'reject')}>拒绝</Button>
        </Space>
      )}
    </Space>
  ) : null;

  const isInitialLoading = loading && approvals.length === 0;

  return (
    <div>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
            <div>
              <Title level={2} style={{ marginBottom: spacing.sm }}>
            <CheckCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />审批工作流</Title>
              <Text type="secondary">多级审批流程管理，包含待审批列表和紧急审批通道</Text>
            </div>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
              <Button icon={<FormOutlined />} onClick={() => { createForm.resetFields(); setCreateModalVisible(true); }}>创建审批</Button>
              <Button type="primary" danger icon={<FireOutlined />} onClick={() => { emergencyForm.resetFields(); setEmergencyModalVisible(true); }}>紧急审批</Button>
            </Space>
          </div>

          {/* Stats */}
          <StatsPanel approvals={approvals} />

          {/* Filters */}
          <Card>
            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.md }}>
              <Input.Search placeholder="搜索审批标题、描述或申请人..." allowClear style={{ width: 320 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onSearch={setSearchQuery} />
              <Select style={{ width: 140 }} value={statusFilter} onChange={(v) => setStatusFilter(v)} options={[
                { label: '全部状态', value: 'all' },
                { label: '待审批', value: 'pending' },
                { label: '已通过', value: 'approved' },
                { label: '已拒绝', value: 'rejected' },
                { label: '已取消', value: 'cancelled' },
              ]} />
            </div>

            <TableComponent columns={columns} dataSource={filteredData} loading={loading} rowKey="id" size="middle" striped />
          </Card>

          {/* Create Modal */}
          <Modal title="创建审批请求" open={createModalVisible} onCancel={() => setCreateModalVisible(false)} onOk={handleCreate} confirmLoading={submitting} width={600} destroyOnClose>
            <div style={{ marginBottom: spacing.md }}>
              <Text type="secondary">快速选择模板：</Text>
              <Space style={{ marginTop: spacing.sm }} wrap>
                {APPROVAL_TEMPLATES.map((t) => (
                  <Button key={t.id} size="small" onClick={() => handleTemplateSelect(t)}>{t.name}</Button>
                ))}
              </Space>
            </div>
            <Form form={createForm} layout="vertical">
              <Form.Item name="title" label="审批标题" rules={[{ required: true }]}>
                <Input placeholder="如: 生产环境部署审批" />
              </Form.Item>
              <Form.Item name="description" label="描述">
                <Input.TextArea rows={3} placeholder="详细说明审批原因和背景..." />
              </Form.Item>
              <Form.Item name="requesterId" label="申请人">
                <Input placeholder="申请人 ID (默认当前用户)" />
              </Form.Item>
              <Form.Item name="approverIds" label="审批人列表 (逗号分隔)" rules={[{ required: true }]}>
                <Input placeholder="如: tech-lead, ops-manager, security-lead" />
              </Form.Item>
              <Form.Item name="requiredApprovals" label="所需通过数">
                <Input type="number" placeholder="默认 1" min={1} />
              </Form.Item>
              <Form.Item name="metadata" label="资源类型">
                <Select placeholder="选择关联资源类型" options={[
                  { label: '部署 (deployment)', value: 'deployment' },
                  { label: '数据库 (database)', value: 'database' },
                  { label: '服务 (service)', value: 'service' },
                  { label: '安全 (security)', value: 'security' },
                  { label: '基础设施 (infrastructure)', value: 'infrastructure' },
                  { label: '通用 (generic)', value: 'generic' },
                ]} />
              </Form.Item>
            </Form>
          </Modal>

          {/* Emergency Approval Modal */}
          <Modal
            title={<span><FireOutlined style={{ color: colors.error[400], marginRight: spacing.sm }} />紧急审批通道</span>}
            open={emergencyModalVisible}
            onCancel={() => setEmergencyModalVisible(false)}
            onOk={handleEmergencyCreate}
            confirmLoading={submitting}
            width={600}
            destroyOnClose
          >
            <Alert message="紧急审批仅需 1 人审批即可通过，请确保情况属实" type="warning" showIcon style={{ marginBottom: spacing.md }} />
            <Form form={emergencyForm} layout="vertical">
              <Form.Item name="title" label="审批标题" rules={[{ required: true }]}>
                <Input placeholder="紧急审批标题" />
              </Form.Item>
              <Form.Item name="description" label="紧急原因说明" rules={[{ required: true }]}>
                <Input.TextArea rows={3} placeholder="详细说明为什么需要紧急审批..." />
              </Form.Item>
              <Form.Item name="requesterId" label="申请人">
                <Input placeholder="申请人 ID" />
              </Form.Item>
              <Form.Item name="resourceType" label="资源类型" rules={[{ required: true }]}>
                <Select options={[
                  { label: '紧急部署', value: 'emergency-deployment' },
                  { label: '紧急回滚', value: 'emergency-rollback' },
                  { label: '安全修复', value: 'security-fix' },
                  { label: '基础设施', value: 'infrastructure' },
                ]} />
              </Form.Item>
              <Form.Item name="approverIds" label="审批人 (逗号分隔)" rules={[{ required: true }]}>
                <Input placeholder="如: on-call-lead" />
              </Form.Item>
            </Form>
          </Modal>

          {/* Detail Drawer */}
          <Drawer title={selectedApproval?.title || '审批详情'} open={detailDrawerVisible} onClose={() => setDetailDrawerVisible(false)} width={720} destroyOnClose>
            {detailContent}
          </Drawer>

          {/* Comment Modal */}
          <Modal
            title={commentAction === 'approve' ? '通过审批' : '拒绝审批'}
            open={commentModalVisible}
            onCancel={() => setCommentModalVisible(false)}
            onOk={handleCommentSubmit}
            confirmLoading={commentSubmitting}
            okText={commentAction === 'approve' ? '通过' : '拒绝'}
            okButtonProps={{ danger: commentAction === 'reject', style: commentAction === 'approve' ? { backgroundColor: colors.success[500], borderColor: colors.success[500] } : undefined }}
          >
            <div style={{ marginBottom: spacing.sm }}>
              <Text type="secondary">{commentAction === 'approve' ? '确认通过该审批？可填写评论理由（可选）。' : '确认拒绝该审批？请填写拒绝理由（可选）。'}</Text>
            </div>
            <Input.TextArea rows={4} placeholder={commentAction === 'reject' ? '请输入拒绝理由...' : '请输入评论/理由（可选）...'} value={commentText} onChange={(e) => setCommentText(e.target.value)} maxLength={500} showCount />
          </Modal>
        </>
      )}
    </div>
  );
};

export default ApprovalPage;
