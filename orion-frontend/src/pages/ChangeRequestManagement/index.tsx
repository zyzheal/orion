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
  ThunderboltOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors, spacing, themeVars } from '@/tokens';
import {
  statusColor,
  statusLabel,
  changeTypeLabel,
  riskLevelColor,
  riskLevelLabel,
  impactScopeLabel,
  approvalStatusLabel,
  approvalStatusColor,
  executionStepStatusColor,
  executionStepStatusLabel,
} from './config';
import { buildColumns } from './columns';
import { ChangeRequestManagementModals } from './ChangeRequestManagementModals';
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
  getChangeRiskAnalysis,
  type ChangeRequest,
  type ChangeApproval,
  type ChangeExecution,
  type CreateChangeRequestInput,
  type ChangeRiskAnalysis,
} from '@/api/change-requests';

const { Title, Text } = Typography;
const { TextArea } = Input;

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

  // AI Risk Analysis (TR-03)
  const [riskLoading, setRiskLoading] = useState(false);
  const [riskAnalysis, setRiskAnalysis] = useState<ChangeRiskAnalysis | null>(null);

  // Fetch AI risk assessment for a change request.
  const fetchRisk = async (id: string) => {
    setRiskLoading(true);
    setRiskAnalysis(null);
    try {
      const res = await getChangeRiskAnalysis(id);
      setRiskAnalysis(res?.data ?? null);
    } catch {
      message.error('获取 AI 风险评估失败，请稍后重试');
    } finally {
      setRiskLoading(false);
    }
  };

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
  const [selectedExecutionRequest, setSelectedExecutionRequest] = useState<ChangeRequest | null>(
    null
  );

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
    } catch (err: unknown) {
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

  const handleAIRisk = async (record: ChangeRequest) => {
    try {
      const risk = await getChangeRiskAnalysis(record.id);
      const analysis = (risk && 'data' in risk ? risk.data : risk) as unknown as {
        riskScore?: string;
        risk_score?: string;
        riskLevel?: string;
        risk_level?: string;
        riskAssessment?: string;
        risk_assessment?: string;
      };
      if (analysis) {
        message.success({
          content: (
            <div>
              <strong style={{ display: 'block', marginBottom: 4 }}>AI 变更风险评估</strong>
              <div>变更: {record.title}</div>
              <div>
                风险分:{' '}
                <span style={{ fontWeight: 600 }}>
                  {String(analysis.riskScore ?? analysis.risk_score ?? '-')}
                </span>
              </div>
              <div>
                风险等级:{' '}
                <span style={{ fontWeight: 600 }}>
                  {String(analysis.riskLevel ?? analysis.risk_level ?? '-')}
                </span>
              </div>
              <div style={{ marginTop: 4, fontSize: 12, color: colors.neutral[600] }}>
                {String(analysis.riskAssessment ?? analysis.risk_assessment ?? '暂无详细评估')}
              </div>
            </div>
          ),
          duration: 8,
          key: `ai-risk-${record.id}`,
        });
      }
    } catch (err: unknown) {
      message.error('AI 风险评估失败: ' + (err instanceof Error ? err.message : String(err)));
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

  const columns = buildColumns({
    handleViewDetail,
    handleAIRisk,
    handleEdit,
    handleSubmitForApproval,
    handleStartExecution,
    handleViewExecution,
    handleDelete,
  });

  /* ==================== Approval Timeline ==================== */

  const renderApprovalTimeline = () => {
    if (approvalLoading)
      return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
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
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: spacing.xs,
                  }}
                >
                  <Space>
                    <Text strong>{roleLabel}</Text>
                    <Tag color={approvalStatusColor[approval.status]}>
                      {approvalStatusLabel[approval.status]}
                    </Tag>
                  </Space>
                  {approval.status === 'pending' &&
                    selectedRequest?.status === 'pending_approval' && (
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
    if (executionLoading)
      return <div style={{ textAlign: 'center', padding: spacing.lg }}>加载中...</div>;
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
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <Space>
                    <Text strong>{step.stepName}</Text>
                    <Tag
                      color={
                        step.status === 'completed'
                          ? 'success'
                          : step.status === 'failed'
                            ? 'error'
                            : step.status === 'running'
                              ? 'processing'
                              : 'default'
                      }
                    >
                      {executionStepStatusLabel[step.status]}
                    </Tag>
                  </Space>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {step.stepType === 'manual'
                      ? '手动'
                      : step.stepType === 'script'
                        ? '脚本'
                        : '自动'}
                  </Text>
                </div>
                {step.output && (
                  <div
                    style={{
                      background: themeVars.bgSecondary,
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
          locale={{
            emptyText: (
              <Empty description="暂无变更请求，点击「创建变更」开始添加" />
            ),
          }}
        />
      </Card>

      <ChangeRequestManagementModals
        renderExecutionProgress={renderExecutionProgress}
        modalVisible={modalVisible}
        setModalVisible={setModalVisible}
        confirmLoading={confirmLoading}
        editingRequest={editingRequest}
        setEditingRequest={setEditingRequest}
        handleSave={handleSave}
        handleCreate={handleCreate}
        form={form}
        detailDrawerVisible={detailDrawerVisible}
        setDetailDrawerVisible={setDetailDrawerVisible}
        selectedRequest={selectedRequest}
        setSelectedRequest={setSelectedRequest}
        riskAnalysis={riskAnalysis}
        riskLoading={riskLoading}
        setRiskLoading={setRiskLoading}
        handleAIRisk={handleAIRisk}
        approvalChain={approvalChain}
        approvalLoading={approvalLoading}
        actionModalVisible={actionModalVisible}
        setActionModalVisible={setActionModalVisible}
        actionType={actionType}
        setActionType={setActionType}
        actionApprovalId={actionApprovalId}
        setActionApprovalId={setActionApprovalId}
        actionComment={actionComment}
        setActionComment={setActionComment}
        actionLoading={actionLoading}
        handleSubmitAction={handleSubmitAction}
        executionDrawerVisible={executionDrawerVisible}
        setExecutionDrawerVisible={setExecutionDrawerVisible}
        executionSteps={executionSteps}
        executionLoading={executionLoading}
        selectedExecutionRequest={selectedExecutionRequest}
        handleSubmitForApproval={handleSubmitForApproval}
        handleDelete={handleDelete}
      />
    </div>
  );
}
