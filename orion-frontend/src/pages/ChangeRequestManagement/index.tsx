/**
 * Change Request RFC Approval Page
 *
 * Features:
 * - Change request list with status filter
 * - Create change request modal with full form
 * - Detail drawer showing approval chain with timeline visualization
 * - Approve/Reject actions with comment input
 * - Execution progress view with step-by-step status
 *
 * 主入口 (P2-9 Phase 110 refactor: 已抽取 useState/Components)
 */
import { useMemo } from 'react';
import { Card, Table, Empty, Typography } from 'antd';
import { SafetyOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { buildColumns } from './columns';
import { useChangeRequestManagementState } from './useChangeRequestManagementState';
import { Toolbar } from './Components/Toolbar';
import { ApprovalTimeline } from './Components/ApprovalTimeline';
import { ExecutionProgress } from './Components/ExecutionProgress';
import { ChangeRequestManagementModals } from './ChangeRequestManagementModals';
import type { ChangeRequest } from '@/api/change-requests';

const { Title } = Typography;

export default function ChangeRequestManagementPage() {
  const state = useChangeRequestManagementState();

  const columns = useMemo(
    () =>
      buildColumns({
        handleViewDetail: state.handleViewDetail,
        handleAIRisk: state.handleAIRisk,
        handleEdit: state.handleEdit,
        handleSubmitForApproval: state.handleSubmitForApproval,
        handleStartExecution: state.handleStartExecution,
        handleViewExecution: state.handleViewExecution,
        handleDelete: state.handleDelete,
      }),
    [
      state.handleViewDetail,
      state.handleAIRisk,
      state.handleEdit,
      state.handleSubmitForApproval,
      state.handleStartExecution,
      state.handleViewExecution,
      state.handleDelete,
    ]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <SafetyOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        变更管理
      </Title>

      <Card
        style={{
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <Toolbar state={state} />

        <Table<ChangeRequest>
          columns={columns}
          dataSource={state.requests}
          rowKey="id"
          loading={state.loading}
          pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
          locale={
            {
              emptyText: (
                <Empty description="暂无变更请求，点击「创建变更」开始添加" />
              ),
            }
          }
        />
      </Card>

      <ChangeRequestManagementModals
        renderExecutionProgress={() => <ExecutionProgress state={state} />}
        modalVisible={state.modalVisible}
        setModalVisible={state.setModalVisible}
        confirmLoading={state.confirmLoading}
        editingRequest={state.editingRequest}
        setEditingRequest={state.setEditingRequest}
        handleSave={state.handleSave}
        handleCreate={state.handleCreate}
        form={state.form}
        detailDrawerVisible={state.detailDrawerVisible}
        setDetailDrawerVisible={state.setDetailDrawerVisible}
        selectedRequest={state.selectedRequest}
        setSelectedRequest={state.setSelectedRequest}
        riskAnalysis={state.riskAnalysis}
        riskLoading={state.riskLoading}
        setRiskLoading={state.setRiskLoading}
        handleAIRisk={state.handleAIRisk}
        approvalChain={state.approvalChain}
        approvalLoading={state.approvalLoading}
        actionModalVisible={state.actionModalVisible}
        setActionModalVisible={state.setActionModalVisible}
        actionType={state.actionType}
        setActionType={state.setActionType}
        actionApprovalId={state.actionApprovalId}
        setActionApprovalId={state.setActionApprovalId}
        actionComment={state.actionComment}
        setActionComment={state.setActionComment}
        actionLoading={state.actionLoading}
        handleSubmitAction={state.handleConfirmAction}
        fetchRisk={state.fetchRisk}
        handleEdit={state.handleEdit}
        handleStartExecution={state.handleStartExecution}
        handleViewExecution={state.handleViewExecution}
        renderApprovalTimeline={() => <ApprovalTimeline state={state} />}
        executionDrawerVisible={state.executionDrawerVisible}
        setExecutionDrawerVisible={state.setExecutionDrawerVisible}
        executionSteps={state.executionSteps}
        executionLoading={state.executionLoading}
        selectedExecutionRequest={state.selectedExecutionRequest}
        handleSubmitForApproval={state.handleSubmitForApproval}
        handleDelete={state.handleDelete}
      />
    </div>
  );
}
