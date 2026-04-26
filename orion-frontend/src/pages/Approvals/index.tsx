/**
 * Approval Management Page
 * Multi-level approval workflow management (M33)
 * List, create, approve/reject, view detail
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography, Button, Space, Tag, Card, Modal, Form, Input, Select, message,
  Popconfirm, Descriptions, Drawer, Tooltip, Progress, Avatar,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, CheckOutlined, CloseOutlined,
  EyeOutlined, ClockCircleOutlined, UserOutlined,
  CheckCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import {
  getApprovals, getApproval, createApproval, approveApproval, rejectApproval,
  type ApprovalRequest, type CreateApprovalInput, type ApprovalStatus,
} from '@/api/approvals';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text, Paragraph } = Typography;

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

// ---- Mock data ----

const MOCK_APPROVALS: ApprovalRequest[] = [
  {
    id: 'appr-1',
    title: '生产环境部署审批',
    description: 'orion-core 服务 v2.5.0 部署到生产环境需要审批。该版本已通过所有测试，包含性能优化和安全修复。',
    requesterId: 'dev-001',
    approverIds: ['tech-lead', 'ops-manager', 'security-lead'],
    status: 'pending',
    approvals: ['tech-lead'],
    rejections: [],
    requiredApprovals: 2,
    createdAt: '2024-03-20T10:00:00Z',
    updatedAt: '2024-03-20T14:00:00Z',
    metadata: { resourceType: 'deployment', environment: 'production', service: 'orion-core', version: '2.5.0' },
  },
  {
    id: 'appr-2',
    title: '数据库结构变更审批',
    description: '新增用户表索引，预计影响线上查询性能 30 分钟。需要运维团队审批。',
    requesterId: 'dev-002',
    approverIds: ['dba-lead', 'ops-manager'],
    status: 'pending',
    approvals: [],
    rejections: [],
    requiredApprovals: 2,
    createdAt: '2024-03-19T08:00:00Z',
    updatedAt: '2024-03-19T08:00:00Z',
    metadata: { resourceType: 'database', changeType: 'index', table: 'users' },
  },
  {
    id: 'appr-3',
    title: '新服务上线审批',
    description: 'orion-ai-gateway 新服务申请上线，已准备好灰度发布策略。',
    requesterId: 'dev-003',
    approverIds: ['arch-lead', 'ops-manager'],
    status: 'approved',
    approvals: ['arch-lead', 'ops-manager'],
    rejections: [],
    requiredApprovals: 2,
    createdAt: '2024-03-18T09:00:00Z',
    updatedAt: '2024-03-19T16:00:00Z',
    metadata: { resourceType: 'service', serviceName: 'orion-ai-gateway' },
  },
  {
    id: 'appr-4',
    title: '安全策略变更审批',
    description: '申请修改 API 网关的 WAF 规则，允许新的第三方回调地址。',
    requesterId: 'sec-001',
    approverIds: ['security-lead', 'ops-manager'],
    status: 'rejected',
    approvals: ['security-lead'],
    rejections: ['ops-manager'],
    requiredApprovals: 2,
    createdAt: '2024-03-17T11:00:00Z',
    updatedAt: '2024-03-18T10:00:00Z',
    metadata: { resourceType: 'security', changeType: 'waf_rule' },
  },
  {
    id: 'appr-5',
    title: '资源扩容审批',
    description: '申请将 orion-api 服务的 K8s 副本数从 3 扩容到 6，应对促销活动流量峰值。',
    requesterId: 'ops-001',
    approverIds: ['cost-lead', 'arch-lead'],
    status: 'pending',
    approvals: ['cost-lead'],
    rejections: [],
    requiredApprovals: 2,
    createdAt: '2024-03-21T08:00:00Z',
    updatedAt: '2024-03-21T09:30:00Z',
    metadata: { resourceType: 'infrastructure', action: 'scale_up', service: 'orion-api', fromReplicas: 3, toReplicas: 6 },
  },
];

// ---- Main Component ----

const ApprovalManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [createForm] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId] = useState('current-user');

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getApprovals();
      const list = res.data?.data?.approvals;
      setApprovals(Array.isArray(list) ? list : []);
    } catch {
      setApprovals(MOCK_APPROVALS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredData = useMemo(() => {
    return approvals.filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !a.title.toLowerCase().includes(q) &&
          !(a.description && a.description.toLowerCase().includes(q)) &&
          !a.requesterId.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [searchQuery, statusFilter, approvals]);

  const stats = useMemo(() => ({
    total: approvals.length,
    pending: approvals.filter(a => a.status === 'pending').length,
    approved: approvals.filter(a => a.status === 'approved').length,
    rejected: approvals.filter(a => a.status === 'rejected').length,
  }), [approvals]);

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      const approverList = values.approverIds.split(',').map((s: string) => s.trim()).filter(Boolean);
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
    } catch {
      message.error('创建失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await approveApproval(id, { userId: currentUserId });
      message.success('审批通过');
      loadData();
      if (selectedApproval?.id === id) loadDetail(id);
    } catch {
      message.error('审批操作失败');
    }
  };

  const handleReject = async (id: string) => {
    try {
      await rejectApproval(id, { userId: currentUserId });
      message.success('已拒绝');
      loadData();
      if (selectedApproval?.id === id) loadDetail(id);
    } catch {
      message.error('拒绝操作失败');
    }
  };

  const openDetail = (a: ApprovalRequest) => {
    setSelectedApproval(a);
    setDetailDrawerVisible(true);
  };

  const loadDetail = async (id: string) => {
    try {
      const res = await getApproval(id);
      const detail = res.data?.data;
      if (detail) setSelectedApproval(detail);
    } catch {
      // Keep existing data
    }
  };

  const approvalProgress = (record: ApprovalRequest): number => {
    if (record.status === 'approved') return 100;
    if (record.status === 'rejected') return 100;
    return Math.round((record.approvals.length / record.requiredApprovals) * 100);
  };

  // ---- Table columns ----

  const columns: TableColumn<any>[] = [
    {
      key: 'title',
      title: '审批标题',
      dataIndex: 'title',
      width: 260,
      render: (v: unknown, record: any) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>{String(v)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            申请人: {record.requesterId}
            {record.metadata?.resourceType && ` | 类型: ${record.metadata.resourceType}`}
          </Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: any) => (
        <Tag color={statusColorMap[record.status as ApprovalStatus] || 'default'}>
          {statusLabelMap[record.status as ApprovalStatus] || record.status}
        </Tag>
      ),
    },
    {
      key: 'progress',
      title: '审批进度',
      width: 180,
      render: (_: unknown, record: any) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Progress
            percent={approvalProgress(record)}
            size="small"
            status={record.status === 'rejected' ? 'exception' : record.status === 'approved' ? 'success' : 'active'}
            format={() => `${record.approvals.length}/${record.requiredApprovals}`}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            需要 {record.requiredApprovals} 个审批
          </Text>
        </Space>
      ),
    },
    {
      key: 'approvers',
      title: '审批人',
      width: 200,
      render: (_: unknown, record: any) => (
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
                    backgroundColor: hasApproved ? '#52c41a' : hasRejected ? '#ff4d4f' : '#d9d9d9',
                    fontSize: 10,
                  }}
                >
                  {uid.substring(0, 2)}
                </Avatar>
              </Tooltip>
            );
          })}
          {record.approverIds.length > 3 && (
            <Text type="secondary" style={{ fontSize: 11 }}>+{record.approverIds.length - 3}</Text>
          )}
        </Space>
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      sortable: true,
      render: (v: unknown) => <Text type="secondary" style={{ fontSize: 12 }}>{dayjs(String(v)).fromNow()}</Text>,
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: any) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Popconfirm title="确认通过该审批?" onConfirm={() => handleApprove(record.id)}>
                <Tooltip title="通过">
                  <Button type="link" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />}>
                    通过
                  </Button>
                </Tooltip>
              </Popconfirm>
              <Popconfirm title="确认拒绝该审批?" onConfirm={() => handleReject(record.id)}>
                <Tooltip title="拒绝">
                  <Button type="link" size="small" danger icon={<CloseOutlined />}>
                    拒绝
                  </Button>
                </Tooltip>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ---- Detail Drawer Content ----

  const detailContent = useMemo(() => {
    if (!selectedApproval) return null;
    const a = selectedApproval;
    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="标题" span={2}>{a.title}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={statusColorMap[a.status]}>{statusLabelMap[a.status]}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{a.requesterId}</Descriptions.Item>
          <Descriptions.Item label="所需审批数">{a.requiredApprovals}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs(a.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          <Descriptions.Item label="更新时间" span={2}>
            {dayjs(a.updatedAt).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(a.updatedAt).fromNow()})
          </Descriptions.Item>
          {a.description && (
            <Descriptions.Item label="描述" span={2}>
              <Paragraph style={{ marginBottom: 0 }}>{a.description}</Paragraph>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* Approval Progress */}
        <Card size="small" title="审批进度" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Progress
              percent={approvalProgress(a)}
              status={a.status === 'rejected' ? 'exception' : a.status === 'approved' ? 'success' : 'active'}
              format={() => `${a.approvals.length} / ${a.requiredApprovals}`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              已获得 {a.approvals.length} 个通过, {a.rejections.length} 个拒绝 (需要 {a.requiredApprovals} 个通过)
            </Text>
          </Space>
        </Card>

        {/* Approver List */}
        <Card size="small" title="审批人列表" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {a.approverIds.map((uid: string) => {
              const hasApproved = a.approvals.includes(uid);
              const hasRejected = a.rejections.includes(uid);
              let statusIcon = <ClockCircleOutlined style={{ color: '#999' }} />;
              let statusText = '待审批';
              if (hasApproved) {
                statusIcon = <CheckCircleOutlined style={{ color: '#52c41a' }} />;
                statusText = '已通过';
              } else if (hasRejected) {
                statusIcon = <StopOutlined style={{ color: '#ff4d4f' }} />;
                statusText = '已拒绝';
              }
              return (
                <Space key={uid} style={{ padding: '4px 0' }}>
                  <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: hasApproved ? '#52c41a' : hasRejected ? '#ff4d4f' : '#d9d9d9' }}>
                    {uid.substring(0, 2)}
                  </Avatar>
                  <Text>{uid}</Text>
                  {statusIcon}
                  <Text type="secondary" style={{ fontSize: 12 }}>{statusText}</Text>
                </Space>
              );
            })}
          </Space>
        </Card>

        {/* Metadata */}
        {a.metadata && Object.keys(a.metadata).length > 0 && (
          <Card size="small" title="元数据" style={{ marginTop: 16 }}>
            <Descriptions column={2} size="small">
              {Object.entries(a.metadata).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>{String(value)}</Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        )}

        {/* Action buttons for pending items */}
        {a.status === 'pending' && (
          <Space style={{ marginTop: 16 }}>
            <Popconfirm title="确认通过该审批?" onConfirm={() => handleApprove(a.id)}>
              <Button type="primary" icon={<CheckOutlined />} style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}>
                通过
              </Button>
            </Popconfirm>
            <Popconfirm title="确认拒绝该审批?" onConfirm={() => handleReject(a.id)}>
              <Button danger icon={<CloseOutlined />}>
                拒绝
              </Button>
            </Popconfirm>
          </Space>
        )}
      </div>
    );
  }, [selectedApproval]);

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>审批管理</Title>
          <Text type="secondary">管理多级审批流程，包括创建、审批和跟踪</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            创建审批
          </Button>
        </Space>
      </div>

      {/* Stats Panel */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Space>
            <Text type="secondary">总计:</Text>
            <Text strong>{stats.total}</Text>
          </Space>
          <Space>
            <ClockCircleOutlined style={{ color: '#1890ff' }} />
            <Text type="secondary">待审批:</Text>
            <Text strong style={{ color: '#1890ff' }}>{stats.pending}</Text>
          </Space>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text type="secondary">已通过:</Text>
            <Text strong style={{ color: '#52c41a' }}>{stats.approved}</Text>
          </Space>
          <Space>
            <StopOutlined style={{ color: '#ff4d4f' }} />
            <Text type="secondary">已拒绝:</Text>
            <Text strong style={{ color: '#ff4d4f' }}>{stats.rejected}</Text>
          </Space>
        </Space>
      </Card>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Input.Search
            placeholder="搜索审批标题、描述或申请人..."
            allowClear
            style={{ width: 320 }}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onSearch={setSearchQuery}
          />
          <Select
            style={{ width: 140 }}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            options={[
              { label: '全部状态', value: 'all' },
              { label: '待审批', value: 'pending' },
              { label: '已通过', value: 'approved' },
              { label: '已拒绝', value: 'rejected' },
              { label: '已取消', value: 'cancelled' },
            ]}
          />
        </div>

        {/* Approval Table */}
        <Table
          columns={columns}
          dataSource={filteredData as unknown as Record<string, unknown>[]}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建审批请求"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={600}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="审批标题" rules={[{ required: true, message: '请输入审批标题' }]}>
            <Input placeholder="如: 生产环境部署审批" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="详细说明审批原因和背景..." />
          </Form.Item>
          <Form.Item name="requesterId" label="申请人">
            <Input placeholder="申请人 ID (默认当前用户)" />
          </Form.Item>
          <Form.Item
            name="approverIds"
            label="审批人列表 (逗号分隔)"
            rules={[{ required: true, message: '请输入审批人列表' }]}
          >
            <Input placeholder="如: tech-lead, ops-manager, security-lead" />
          </Form.Item>
          <Form.Item name="requiredApprovals" label="所需通过数">
            <Input type="number" placeholder="默认 1" min={1} />
          </Form.Item>
          <Form.Item name="metadata" label="资源类型">
            <Select
              placeholder="选择关联资源类型"
              options={[
                { label: '部署 (deployment)', value: 'deployment' },
                { label: '数据库 (database)', value: 'database' },
                { label: '服务 (service)', value: 'service' },
                { label: '安全 (security)', value: 'security' },
                { label: '基础设施 (infrastructure)', value: 'infrastructure' },
                { label: '通用 (generic)', value: 'generic' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={selectedApproval ? selectedApproval.title : '审批详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={720}
        destroyOnClose
      >
        {detailContent}
      </Drawer>
    </div>
  );
};

export default ApprovalManagement;
