/**
 * Change Request RFC Approval Page
 *
 * Features:
 * - Change request list with status filter
 * - Create change request modal with full form
 * - Detail drawer showing approval chain with timeline visualization
 * - Approve/Reject actions with comment input
 * - Execution progress view with step-by-step status
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  message,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Row,
  Col,
  Drawer,
  Descriptions,
  Timeline,
  Popconfirm,
  Steps,
  Empty,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  DeleteOutlined,
  EditOutlined,
  SendOutlined,
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  PlayCircleOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import { colors, spacing } from '@/tokens';
import {
  listChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  deleteChangeRequest,
  submitForApproval,
  getApprovalChain,
  approveChange,
  rejectChange,
  startExecution,
  getExecutionProgress,
  type ChangeRequest,
  type ChangeApproval,
  type ChangeExecution,
  type CreateChangeRequestInput,
} from '@/api/change-requests';

const { Title, Text } = Typography;
const { TextArea } = Input;

/* ==================== Constants ==================== */

const statusColor: Record<string, string> = {
  draft: 'default',
  pending_approval: 'processing',
  approved: 'success',
  rejected: 'error',
  implementing: 'warning',
  completed: 'success',
  cancelled: 'default',
};

const statusLabel: Record<string, string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
  implementing: '实施中',
  completed: '已完成',
  cancelled: '已取消',
};

const changeTypeLabel: Record<string, string> = {
  standard: '标准变更',
  normal: '普通变更',
  emergency: '紧急变更',
};

const riskLevelColor: Record<string, string> = {
  low: 'green',
  medium: 'orange',
  high: 'red',
  critical: 'volcano',
};

const riskLevelLabel: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const impactScopeLabel: Record<string, string> = {
  minor: '轻微',
  major: '重大',
  significant: '显著',
};

const approvalStatusLabel: Record<string, string> = {
  pending: '待审批',
  approved: '已批准',
  rejected: '已拒绝',
};

const approvalStatusColor: Record<string, string> = {
  pending: 'processing',
  approved: 'success',
  rejected: 'error',
};

const executionStepStatusColor: Record<string, string> = {
  pending: colors.neutral[400],
  running: colors.primary[500],
  completed: colors.success[500],
  failed: colors.error[500],
  skipped: colors.neutral[300],
};

const executionStepStatusLabel: Record<string, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  skipped: '已跳过',
};

/* ==================== Component ==================== */

export default function ChangeRequestManagementPage() {
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Create/Edit modal
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ChangeRequest | null>(null);
  const [form] = Form.useForm();

  // Detail drawer
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ChangeRequest | null>(null);

  // Approval chain
  const [approvalChain, setApprovalChain] = useState<ChangeApproval[]>([]);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Approve/Reject modal
  const [actionModalVisible, setActionModalVisible] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [actionApprovalId, setActionApprovalId] = useState<string>('');
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Execution
  const [executionDrawerVisible, setExecutionDrawerVisible] = useState(false);
  const [executionSteps, setExecutionSteps] = useState<ChangeExecution[]>([]);
  const [executionLoading, setExecutionLoading] = useState(false);
  const [selectedExecutionRequest, setSelectedExecutionRequest] = useState<ChangeRequest | null>(null);

  /* ==================== Data Fetching ==================== */

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: { status?: string } = {};
      if (statusFilter) params.status = statusFilter;
      const res = await listChangeRequests(params);
      setRequests(res.data ?? []);
    } catch {
      message.error('获取变更请求列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const fetchApprovalChain = async (changeRequestId: string) => {
    setApprovalLoading(true);
    try {
      const res = await getApprovalChain(changeRequestId);
      setApprovalChain(res.data ?? []);
    } catch {
      message.error('获取审批链失败');
    } finally {
      setApprovalLoading(false);
    }
  };

  const fetchExecutionProgress = async (changeRequestId: string) => {
    setExecutionLoading(true);
    try {
      const res = await getExecutionProgress(changeRequestId);
      setExecutionSteps(res.data ?? []);
    } catch {
      message.error('获取执行进度失败');
    } finally {
      setExecutionLoading(false);
    }
  };

  /* ==================== Handlers ==================== */

  const handleCreate = () => {
    setEditingRequest(null);
    form.resetFields();
    form.setFieldsValue({ riskLevel: 'low', changeType: 'normal', impactScope: 'minor' });
    setModalVisible(true);
  };

  const handleEdit = (record: ChangeRequest) => {
    setEditingRequest(record);
    form.setFieldsValue({
      title: record.title,
      description: record.description,
      changeType: record.changeType,
      riskLevel: record.riskLevel,
      impactScope: record.impactScope,
      rollbackPlan: record.rollbackPlan,
      scheduledStart: record.scheduledStart ? dayjs(record.scheduledStart) : null,
      scheduledEnd: record.scheduledEnd ? dayjs(record.scheduledEnd) : null,
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setConfirmLoading(true);
      const input: CreateChangeRequestInput = {
        title: values.title,
        description: values.description,
        changeType: values.changeType,
        riskLevel: values.riskLevel,
        impactScope: values.impactScope,
        rollbackPlan: values.rollbackPlan,
        scheduledStart: values.scheduledStart?.toISOString(),
        scheduledEnd: values.scheduledEnd?.toISOString(),
      };
      if (editingRequest) {
        await updateChangeRequest(editingRequest.id, input);
        message.success('变更请求更新成功');
      } else {
        await createChangeRequest(input);
        message.success('变更请求创建成功');
      }
      setModalVisible(false);
      fetchRequests();
    } catch (err: any) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error('保存失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteChangeRequest(id);
      message.success('删除成功');
      fetchRequests();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmitForApproval = async (id: string) => {
    try {
      await submitForApproval(id);
      message.success('已提交审批');
      fetchRequests();
    } catch {
      message.error('提交审批失败');
    }
  };

  const handleViewDetail = async (record: ChangeRequest) => {
    setSelectedRequest(record);
    setDetailDrawerVisible(true);
    fetchApprovalChain(record.id);
  };

  const handleOpenAction = (type: 'approve' | 'reject', approvalId: string) => {
    setActionType(type);
    setActionApprovalId(approvalId);
    setActionComment('');
    setActionModalVisible(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedRequest) return;
    setActionLoading(true);
    try {
      if (actionType === 'approve') {
        await approveChange(selectedRequest.id, actionApprovalId, actionComment);
        message.success('审批通过');
      } else {
        await rejectChange(selectedRequest.id, actionApprovalId, actionComment);
        message.success('已拒绝');
      }
      setActionModalVisible(false);
      fetchApprovalChain(selectedRequest.id);
      fetchRequests();
    } catch {
      message.error(actionType === 'approve' ? '审批操作失败' : '拒绝操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartExecution = async (record: ChangeRequest) => {
    try {
      await startExecution(record.id);
      message.success('执行已启动');
      fetchRequests();
    } catch {
      message.error('启动执行失败');
    }
  };

  const handleViewExecution = async (record: ChangeRequest) => {
    setSelectedExecutionRequest(record);
    setExecutionDrawerVisible(true);
    fetchExecutionProgress(record.id);
  };

  /* ==================== Table Columns ==================== */

  const columns: ColumnsType<ChangeRequest> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text: string, record) => (
        <a onClick={() => handleViewDetail(record)}>{text}</a>
      ),
    },
    {
      title: '变更类型',
      dataIndex: 'changeType',
      key: 'changeType',
      width: 100,
      render: (val: string) => <Tag>{changeTypeLabel[val] ?? val}</Tag>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 80,
      render: (val: string) => (
        <Tag color={riskLevelColor[val]}>{riskLevelLabel[val] ?? val}</Tag>
      ),
    },
    {
      title: '影响范围',
      dataIndex: 'impactScope',
      key: 'impactScope',
      width: 80,
      render: (val: string | null) => val ? <Tag>{impactScopeLabel[val] ?? val}</Tag> : '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Badge status={statusColor[val] as any} text={statusLabel[val] ?? val} />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (text: string) => dayjs(text).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.status === 'draft' && (
            <>
              <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Button
                type="link"
                icon={<SendOutlined />}
                onClick={() => handleSubmitForApproval(record.id)}
              >
                提交
              </Button>
            </>
          )}
          {record.status === 'approved' && (
            <Button
              type="link"
              icon={<PlayCircleOutlined />}
              onClick={() => handleStartExecution(record)}
            >
              执行
            </Button>
          )}
          {record.status === 'implementing' && (
            <Button
              type="link"
              icon={<EyeOutlined />}
              onClick={() => handleViewExecution(record)}
            >
              进度
            </Button>
          )}
          {['draft', 'rejected', 'cancelled'].includes(record.status) && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  /* ==================== Approval Timeline ==================== */

  const renderApprovalTimeline = () => {
    if (approvalLoading) return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
    if (approvalChain.length === 0) return <Empty description="暂无审批链" />;

    return (
      <Timeline
        items={approvalChain.map((approval) => {
          const dotColor =
            approval.status === 'approved'
              ? colors.success[500]
              : approval.status === 'rejected'
                ? colors.error[500]
                : colors.primary[500];
          const roleLabel =
            approval.approverRole === 'supervisor'
              ? '主管'
              : approval.approverRole === 'manager'
                ? '经理'
                : 'CTO';

          return {
            color: dotColor,
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
                  <Space>
                    <Text strong>{roleLabel}</Text>
                    <Tag color={approvalStatusColor[approval.status]}>
                      {approvalStatusLabel[approval.status]}
                    </Tag>
                  </Space>
                  {approval.status === 'pending' && selectedRequest?.status === 'pending_approval' && (
                    <Space size={4}>
                      <Button
                        type="primary"
                        size="small"
                        icon={<CheckOutlined />}
                        onClick={() => handleOpenAction('approve', approval.id)}
                      >
                        通过
                      </Button>
                      <Button
                        danger
                        size="small"
                        icon={<CloseOutlined />}
                        onClick={() => handleOpenAction('reject', approval.id)}
                      >
                        拒绝
                      </Button>
                    </Space>
                  )}
                </div>
                {approval.approverId && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 13 }}>
                    审批人: {approval.approverId}
                  </Text>
                )}
                {approval.comment && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 13, marginTop: 4 }}>
                    备注: {approval.comment}
                  </Text>
                )}
                {approval.decidedAt && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    {dayjs(approval.decidedAt).format('YYYY-MM-DD HH:mm')}
                  </Text>
                )}
              </div>
            ),
          };
        })}
      />
    );
  };

  /* ==================== Execution Progress ==================== */

  const renderExecutionProgress = () => {
    if (executionLoading) return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
    if (executionSteps.length === 0) return <Empty description="暂无执行步骤" />;

    const completedCount = executionSteps.filter((s) => s.status === 'completed').length;
    const currentStep = executionSteps.findIndex((s) => s.status === 'running');

    return (
      <>
        <Steps
          current={currentStep >= 0 ? currentStep : completedCount}
          status={executionSteps.some((s) => s.status === 'failed') ? 'error' : undefined}
          style={{ marginBottom: spacing.lg }}
          items={executionSteps.map((step) => ({
            title: step.stepName,
            description: executionStepStatusLabel[step.status],
            icon:
              step.status === 'running' ? (
                <ClockCircleOutlined style={{ color: colors.primary[500] }} />
              ) : step.status === 'failed' ? (
                <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
              ) : undefined,
          }))}
        />
        <Timeline
          items={executionSteps.map((step) => ({
            color: executionStepStatusColor[step.status] ?? colors.neutral[400],
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Space>
                    <Text strong>{step.stepName}</Text>
                    <Tag color={step.status === 'completed' ? 'success' : step.status === 'failed' ? 'error' : step.status === 'running' ? 'processing' : 'default'}>
                      {executionStepStatusLabel[step.status]}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {step.stepType === 'manual' ? '手动' : step.stepType === 'script' ? '脚本' : '自动'}
                  </Text>
                </div>
                {step.output && (
                  <div
                    style={{
                      background: colors.light.bg.secondary,
                      borderRadius: 6,
                      padding: `${spacing.xs}px ${spacing.sm}px`,
                      marginTop: spacing.xs,
                      fontSize: 13,
                      fontFamily: 'monospace',
                    }}
                  >
                    {step.output}
                  </div>
                )}
                {step.error && (
                  <Text type="danger" style={{ display: 'block', marginTop: 4, fontSize: 13 }}>
                    {step.error}
                  </Text>
                )}
                {step.startedAt && (
                  <Text type="secondary" style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    {dayjs(step.startedAt).format('HH:mm:ss')}
                    {step.completedAt && ` - ${dayjs(step.completedAt).format('HH:mm:ss')}`}
                  </Text>
                )}
              </div>
            ),
          }))}
        />
      </>
    );
  };

  /* ==================== Render ==================== */

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Page Title */}
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <SafetyOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        变更管理
      </Title>

      {/* Main Card */}
      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        {/* Toolbar */}
        <Row justify="space-between" align="middle" style={{ marginBottom: spacing.md }}>
          <Col>
            <Space>
              <Select
                placeholder="按状态筛选"
                allowClear
                style={{ width: 160 }}
                value={statusFilter}
                onChange={(val) => setStatusFilter(val)}
              >
                {Object.entries(statusLabel).map(([key, label]) => (
                  <Select.Option key={key} value={key}>
                    {label}
                  </Select.Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchRequests}>
                刷新
              </Button>
            </Space>
          </Col>
          <Col>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              创建变更请求
            </Button>
          </Col>
        </Row>

        {/* Table */}
        <Table<ChangeRequest>
          columns={columns}
          dataSource={requests}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>

      {/* ==================== Create/Edit Modal ==================== */}
      <Modal
        title={editingRequest ? '编辑变更请求' : '创建变更请求'}
        open={modalVisible}
        onOk={handleSave}
        confirmLoading={confirmLoading}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入变更标题' }]}
          >
            <Input placeholder="输入变更请求标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="详细描述变更内容" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="changeType"
                label="变更类型"
                rules={[{ required: true, message: '请选择变更类型' }]}
              >
                <Select placeholder="选择变更类型">
                  <Select.Option value="standard">标准变更</Select.Option>
                  <Select.Option value="normal">普通变更</Select.Option>
                  <Select.Option value="emergency">紧急变更</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="riskLevel" label="风险等级">
                <Select placeholder="选择风险等级">
                  <Select.Option value="low">低</Select.Option>
                  <Select.Option value="medium">中</Select.Option>
                  <Select.Option value="high">高</Select.Option>
                  <Select.Option value="critical">严重</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="impactScope" label="影响范围">
                <Select placeholder="选择影响范围">
                  <Select.Option value="minor">轻微</Select.Option>
                  <Select.Option value="major">重大</Select.Option>
                  <Select.Option value="significant">显著</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="rollbackPlan" label="回滚方案">
            <TextArea rows={2} placeholder="描述回滚方案" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="scheduledStart" label="计划开始时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择开始时间" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="scheduledEnd" label="计划结束时间">
                <DatePicker showTime style={{ width: '100%' }} placeholder="选择结束时间" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ==================== Detail Drawer ==================== */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: colors.primary[500] }} />
            <span>{selectedRequest?.title ?? '变更详情'}</span>
          </Space>
        }
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={640}
      >
        {selectedRequest && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: spacing.lg }}
            >
              <Descriptions.Item label="状态" span={2}>
                <Badge
                  status={statusColor[selectedRequest.status] as any}
                  text={statusLabel[selectedRequest.status]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="变更类型">
                <Tag>{changeTypeLabel[selectedRequest.changeType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevelColor[selectedRequest.riskLevel]}>
                  {riskLevelLabel[selectedRequest.riskLevel]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="影响范围">
                {selectedRequest.impactScope
                  ? impactScopeLabel[selectedRequest.impactScope]
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建人">
                {selectedRequest.createdBy ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间" span={2}>
                {dayjs(selectedRequest.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>
                {selectedRequest.description ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="回滚方案" span={2}>
                {selectedRequest.rollbackPlan ?? '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划开始">
                {selectedRequest.scheduledStart
                  ? dayjs(selectedRequest.scheduledStart).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="计划结束">
                {selectedRequest.scheduledEnd
                  ? dayjs(selectedRequest.scheduledEnd).format('YYYY-MM-DD HH:mm')
                  : '-'}
              </Descriptions.Item>
            </Descriptions>

            {/* Approval Chain Section */}
            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <CheckOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              审批链
            </Title>
            {renderApprovalTimeline()}

            {/* Action Buttons for draft */}
            {selectedRequest.status === 'draft' && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Space>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => {
                      setDetailDrawerVisible(false);
                      handleEdit(selectedRequest);
                    }}
                  >
                    编辑
                  </Button>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={() => {
                      handleSubmitForApproval(selectedRequest.id);
                      setDetailDrawerVisible(false);
                    }}
                  >
                    提交审批
                  </Button>
                </Space>
              </div>
            )}

            {/* Execution Button for approved */}
            {selectedRequest.status === 'approved' && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={() => {
                    handleStartExecution(selectedRequest);
                    setDetailDrawerVisible(false);
                  }}
                >
                  开始执行
                </Button>
              </div>
            )}

            {/* View Execution for implementing/completed */}
            {(selectedRequest.status === 'implementing' || selectedRequest.status === 'completed') && (
              <div style={{ marginTop: spacing.lg, textAlign: 'right' }}>
                <Button
                  type="primary"
                  icon={<EyeOutlined />}
                  onClick={() => {
                    setDetailDrawerVisible(false);
                    handleViewExecution(selectedRequest);
                  }}
                >
                  查看执行进度
                </Button>
              </div>
            )}
          </>
        )}
      </Drawer>

      {/* ==================== Approve/Reject Modal ==================== */}
      <Modal
        title={actionType === 'approve' ? '审批通过' : '拒绝变更'}
        open={actionModalVisible}
        onOk={handleConfirmAction}
        onCancel={() => setActionModalVisible(false)}
        confirmLoading={actionLoading}
        okText={actionType === 'approve' ? '确认通过' : '确认拒绝'}
        okButtonProps={actionType === 'reject' ? { danger: true } : {}}
        destroyOnClose
      >
        <div style={{ marginTop: spacing.md }}>
          <Text style={{ display: 'block', marginBottom: spacing.sm }}>
            {actionType === 'approve' ? '请确认审批通过此变更请求:' : '请填写拒绝原因:'}
          </Text>
          <TextArea
            rows={3}
            placeholder={actionType === 'approve' ? '审批备注（可选）' : '请输入拒绝原因'}
            value={actionComment}
            onChange={(e) => setActionComment(e.target.value)}
          />
        </div>
      </Modal>

      {/* ==================== Execution Progress Drawer ==================== */}
      <Drawer
        title={
          <Space>
            <PlayCircleOutlined style={{ color: colors.primary[500] }} />
            <span>执行进度 - {selectedExecutionRequest?.title}</span>
          </Space>
        }
        open={executionDrawerVisible}
        onClose={() => setExecutionDrawerVisible(false)}
        width={640}
      >
        {selectedExecutionRequest && (
          <>
            <Descriptions
              column={2}
              bordered
              size="small"
              style={{ marginBottom: spacing.lg }}
            >
              <Descriptions.Item label="状态" span={2}>
                <Badge
                  status={statusColor[selectedExecutionRequest.status] as any}
                  text={statusLabel[selectedExecutionRequest.status]}
                />
              </Descriptions.Item>
              <Descriptions.Item label="变更类型">
                {changeTypeLabel[selectedExecutionRequest.changeType]}
              </Descriptions.Item>
              <Descriptions.Item label="风险等级">
                <Tag color={riskLevelColor[selectedExecutionRequest.riskLevel]}>
                  {riskLevelLabel[selectedExecutionRequest.riskLevel]}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            <Title level={4} style={{ marginBottom: spacing.sm }}>
              <ClockCircleOutlined style={{ marginRight: 8, color: colors.primary[500] }} />
              步骤执行详情
            </Title>
            {renderExecutionProgress()}
          </>
        )}
      </Drawer>
    </div>
  );
}
