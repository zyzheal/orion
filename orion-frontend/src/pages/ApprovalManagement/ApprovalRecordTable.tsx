/**
 * 审批记录表格
 *
 * 展示所有审批记录，支持：
 * - 状态筛选 (pending/approved/rejected/timeout)
 * - 搜索 (标题/申请人/资源)
 * - 详情查看 (Drawer)
 * - 审批通过/拒绝操作
 */
import React, { useState, useMemo, useCallback } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Input,
  Select,
  Modal,
  message,
  Descriptions,
  Drawer,
  Tooltip,
  Progress,
  Avatar,
  Card,
} from 'antd';
import {
  EyeOutlined,
  ClockCircleOutlined,
  UserOutlined,
  CheckCircleOutlined,
  StopOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import {
  type ApprovalChainInfo,
  type ApprovalStatus,
  type ApprovalStepDetail,
  approveRequest,
  rejectRequest,
} from '@/api/approval';
import { colors } from '@/tokens/colors';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Text, Paragraph } = Typography;

// ---- 状态颜色映射 ----
const statusColorMap: Record<ApprovalStatus, string> = {
  pending: colors.purple[500],
  approved: colors.success[500],
  rejected: colors.error[400],
  cancelled: colors.neutral[400],
  timeout: colors.warning[500],
};

const statusLabelMap: Record<ApprovalStatus, string> = {
  pending: '审批中',
  approved: '已通过',
  rejected: '已拒绝',
  cancelled: '已取消',
  timeout: '已超时',
};

interface ApprovalRecordTableProps {
  records: ApprovalChainInfo[];
  loading: boolean;
  onRefresh: () => void;
}

/**
 * 审批记录表格组件
 */
const ApprovalRecordTable: React.FC<ApprovalRecordTableProps> = ({ records, loading, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'all'>('all');
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalChainInfo | null>(null);
  const [currentUserId] = useState('current-user');

  // ---- 评论弹窗 ----
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentAction, setCommentAction] = useState<'approve' | 'reject'>('approve');
  const [commentTargetId, setCommentTargetId] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentSubmitting, setCommentSubmitting] = useState(false);

  // ---- 过滤 ----
  const filteredData = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [r.title, r.requesterId, r.resourceType, r.resourceId].join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
  }, [searchQuery, statusFilter, records]);

  // ---- 统计 ----
  const stats = useMemo(
    () => ({
      total: records.length,
      pending: records.filter((r) => r.status === 'pending').length,
      approved: records.filter((r) => r.status === 'approved').length,
      rejected: records.filter((r) => r.status === 'rejected').length,
      timeout: records.filter((r) => r.status === 'timeout').length,
    }),
    [records]
  );

  // ---- 审批进度计算 ----
  const approvalProgress = useCallback((record: ApprovalChainInfo): number => {
    if (record.status === 'approved') return 100;
    if (record.status === 'rejected') return 100;
    if (record.status === 'timeout') return 100;
    const approved = record.steps.filter((s) => s.status === 'approved').length;
    const total = record.steps.length || 1;
    return Math.round((approved / total) * 100);
  }, []);

  // ---- 打开详情 ----
  const openDetail = (record: ApprovalChainInfo) => {
    setSelectedRecord(record);
    setDetailDrawerVisible(true);
  };

  // ---- 审批操作 ----
  const handleApprove = async (id: string, comment?: string) => {
    try {
      await approveRequest(id, { reviewerId: currentUserId, comment });
      message.success('审批通过');
      onRefresh();
    } catch (error: unknown) {
      message.error(`审批操作失败: ${(error as Error).message}`);
    }
  };

  const handleReject = async (id: string, comment?: string) => {
    try {
      await rejectRequest(id, { reviewerId: currentUserId, comment });
      message.success('已拒绝');
      onRefresh();
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

  // ---- 表格列 ----
  const columns: TableColumn<ApprovalChainInfo>[] = [
    {
      key: 'title',
      title: '标题',
      dataIndex: 'title',
      width: 260,
      render: (v: unknown, record: ApprovalChainInfo) => (
        <Space direction="vertical" size={0}>
          <Text strong style={{ cursor: 'pointer', color: colors.primary[500] }} onClick={() => openDetail(record)}>
            {String(v)}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            申请人: {record.requesterId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'resource',
      title: '关联资源',
      width: 180,
      render: (_: unknown, record: ApprovalChainInfo) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{record.resourceType}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>{record.resourceId}</Text>
        </Space>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: ApprovalChainInfo) => (
        <Tag
          style={{
            backgroundColor: statusColorMap[record.status] + '18',
            color: statusColorMap[record.status],
            borderColor: statusColorMap[record.status] + '40',
          }}
        >
          {statusLabelMap[record.status] || record.status}
        </Tag>
      ),
    },
    {
      key: 'progress',
      title: '审批进度',
      width: 180,
      render: (_: unknown, record: ApprovalChainInfo) => {
        const approvedCount = record.steps.filter((s) => s.status === 'approved').length;
        const totalCount = record.steps.length;
        return (
          <Space direction="vertical" size={0} style={{ width: '100%' }}>
            <Progress
              percent={approvalProgress(record)}
              size="small"
              status={
                record.status === 'rejected'
                  ? 'exception'
                  : record.status === 'approved'
                    ? 'success'
                    : record.status === 'timeout'
                      ? 'exception'
                      : 'active'
              }
              format={() => `${approvedCount}/${totalCount}`}
            />
            <Text type="secondary" style={{ fontSize: 11 }}>
              {record.totalLevels} 级审批
            </Text>
          </Space>
        );
      },
    },
    {
      key: 'approvers',
      title: '当前审批人',
      width: 160,
      render: (_: unknown, record: ApprovalChainInfo) => {
        const pendingSteps = record.steps.filter((s) => s.status === 'pending');
        if (pendingSteps.length === 0) {
          return <Text type="secondary" style={{ fontSize: 12 }}>-</Text>;
        }
        return (
          <Space size={4} wrap>
            {pendingSteps.slice(0, 3).map((step) => (
              <Tooltip key={step.stepIndex} title={step.approverId}>
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  style={{ backgroundColor: colors.neutral[300], fontSize: 10 }}
                >
                  {step.approverId.substring(0, 2)}
                </Avatar>
              </Tooltip>
            ))}
            {pendingSteps.length > 3 && (
              <Text type="secondary" style={{ fontSize: 11 }}>
                +{pendingSteps.length - 3}
              </Text>
            )}
          </Space>
        );
      },
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 140,
      render: (v: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(v as string).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: ApprovalChainInfo) => (
        <Space size="small" wrap>
          <Tooltip title="详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            >
              详情
            </Button>
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Tooltip title="通过">
                <Button
                  type="link"
                  size="small"
                  style={{ color: colors.success[500] }}
                  icon={<CheckOutlined />}
                  onClick={() => openCommentModal(record.id, 'approve')}
                >
                  通过
                </Button>
              </Tooltip>
              <Tooltip title="拒绝">
                <Button
                  type="link"
                  size="small"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => openCommentModal(record.id, 'reject')}
                >
                  拒绝
                </Button>
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  // ---- 详情抽屉 ----
  const detailContent = useMemo(() => {
    if (!selectedRecord) return null;
    const r = selectedRecord;
    const approvedCount = r.steps.filter((s) => s.status === 'approved').length;
    const rejectedCount = r.steps.filter((s) => s.status === 'rejected').length;

    return (
      <div>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="标题" span={2}>
            {r.title}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag
              style={{
                backgroundColor: statusColorMap[r.status] + '18',
                color: statusColorMap[r.status],
                borderColor: statusColorMap[r.status] + '40',
              }}
            >
              {statusLabelMap[r.status]}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="申请人">{r.requesterId}</Descriptions.Item>
          <Descriptions.Item label="资源类型">
            <Tag color="blue">{r.resourceType}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="资源ID">{r.resourceId}</Descriptions.Item>
          <Descriptions.Item label="审批模式" span={2}>
            {r.mode === 'sequential' ? '串行' : r.mode === 'parallel' ? '并行' : r.mode === 'or_gate' ? '或签' : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(r.updatedAt).format('YYYY-MM-DD HH:mm:ss')} ({dayjs(r.updatedAt).fromNow()})
          </Descriptions.Item>
          {r.description && (
            <Descriptions.Item label="描述" span={2}>
              <Paragraph style={{ marginBottom: 0 }}>{r.description}</Paragraph>
            </Descriptions.Item>
          )}
        </Descriptions>

        {/* 审批进度 */}
        <Card size="small" title="审批进度" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Progress
              percent={approvalProgress(r)}
              status={
                r.status === 'rejected'
                  ? 'exception'
                  : r.status === 'approved'
                    ? 'success'
                    : 'active'
              }
              format={() => `${approvedCount} / ${r.steps.length}`}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              已通过 {approvedCount}, 已拒绝 {rejectedCount}, 共 {r.steps.length} 步
            </Text>
          </Space>
        </Card>

        {/* 审批步骤列表 */}
        <Card size="small" title="审批步骤" style={{ marginTop: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            {r.steps.map((step: ApprovalStepDetail) => {
              const statusIconMap: Record<string, React.ReactNode> = {
                pending: <ClockCircleOutlined style={{ color: colors.purple[500] }} />,
                approved: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
                rejected: <StopOutlined style={{ color: colors.error[400] }} />,
                waiting: <ClockCircleOutlined style={{ color: colors.neutral[400] }} />,
                timeout: <ClockCircleOutlined style={{ color: colors.warning[500] }} />,
              };
              const statusTextMap: Record<string, string> = {
                pending: '待审批',
                approved: '已通过',
                rejected: '已拒绝',
                waiting: '等待中',
                timeout: '已超时',
              };
              return (
                <Space key={step.stepIndex} style={{ padding: '4px 0', width: '100%', justifyContent: 'space-between' }}>
                  <Space>
                    <Avatar
                      size="small"
                      icon={<UserOutlined />}
                      style={{
                        backgroundColor:
                          step.status === 'approved'
                            ? colors.success[500]
                            : step.status === 'rejected'
                              ? colors.error[400]
                              : colors.neutral[300],
                      }}
                    >
                      {step.approverId.substring(0, 2)}
                    </Avatar>
                    <Text>{step.approverId}</Text>
                    <Tag>第 {step.levelIndex + 1} 级</Tag>
                  </Space>
                  <Space>
                    {statusIconMap[step.status]}
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {statusTextMap[step.status]}
                    </Text>
                    {step.actedAt && (
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {dayjs(step.actedAt).fromNow()}
                      </Text>
                    )}
                  </Space>
                </Space>
              );
            })}
          </Space>
        </Card>

        {/* 操作按钮 */}
        {r.status === 'pending' && (
          <Space style={{ marginTop: 16 }}>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              style={{ backgroundColor: colors.success[500], borderColor: colors.success[500] }}
              onClick={() => openCommentModal(r.id, 'approve')}
            >
              通过
            </Button>
            <Button
              danger
              icon={<CloseOutlined />}
              onClick={() => openCommentModal(r.id, 'reject')}
            >
              拒绝
            </Button>
          </Space>
        )}
      </div>
    );
  }, [selectedRecord, approvalProgress]);

  return (
    <div>
      {/* 统计面板 */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Space>
            <Text type="secondary">总计:</Text>
            <Text strong>{stats.total}</Text>
          </Space>
          <Space>
            <ClockCircleOutlined style={{ color: colors.purple[500] }} />
            <Text type="secondary">审批中:</Text>
            <Text strong style={{ color: colors.purple[500] }}>
              {stats.pending}
            </Text>
          </Space>
          <Space>
            <CheckCircleOutlined style={{ color: colors.success[500] }} />
            <Text type="secondary">已通过:</Text>
            <Text strong style={{ color: colors.success[500] }}>
              {stats.approved}
            </Text>
          </Space>
          <Space>
            <StopOutlined style={{ color: colors.error[400] }} />
            <Text type="secondary">已拒绝:</Text>
            <Text strong style={{ color: colors.error[400] }}>
              {stats.rejected}
            </Text>
          </Space>
          <Space>
            <ClockCircleOutlined style={{ color: colors.warning[500] }} />
            <Text type="secondary">已超时:</Text>
            <Text strong style={{ color: colors.warning[500] }}>
              {stats.timeout}
            </Text>
          </Space>
        </Space>
      </Card>

      {/* 筛选 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Space>
            <Input.Search
              placeholder="搜索标题、申请人或资源..."
              allowClear
              style={{ width: 280 }}
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
                { label: '审批中', value: 'pending' },
                { label: '已通过', value: 'approved' },
                { label: '已拒绝', value: 'rejected' },
                { label: '已取消', value: 'cancelled' },
                { label: '已超时', value: 'timeout' },
              ]}
            />
          </Space>
          <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
            刷新
          </Button>
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

      {/* 详情 Drawer */}
      <Drawer
        title={selectedRecord ? selectedRecord.title : '审批详情'}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={720}
        destroyOnClose
      >
        {detailContent}
      </Drawer>

      {/* 评论 Modal */}
      <Modal
        title={commentAction === 'approve' ? '通过审批' : '拒绝审批'}
        open={commentModalVisible}
        onCancel={() => setCommentModalVisible(false)}
        onOk={handleCommentSubmit}
        confirmLoading={commentSubmitting}
        okText={commentAction === 'approve' ? '通过' : '拒绝'}
        okButtonProps={{
          danger: commentAction === 'reject',
          style:
            commentAction === 'approve'
              ? { backgroundColor: colors.success[500], borderColor: colors.success[500] }
              : undefined,
        }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text type="secondary">
            {commentAction === 'approve'
              ? '确认通过该审批？可填写评论理由（可选）。'
              : '确认拒绝该审批？请填写拒绝理由（可选）。'}
          </Text>
        </div>
        <Input.TextArea
          rows={4}
          placeholder={
            commentAction === 'reject' ? '请输入拒绝理由...' : '请输入评论/理由（可选）...'
          }
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          maxLength={500}
          showCount
        />
      </Modal>
    </div>
  );
};

export default ApprovalRecordTable;
