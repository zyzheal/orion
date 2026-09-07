/**
 * AI Security Page
 * AI 安全策略管理
 *
 * Features:
 * - Stats cards: Policies Active, Requests Blocked, Sensitive Data Detected, Compliance Score
 * - Security policy table with filter by policy type
 * - Evaluate policy modal
 *
 * P2-9 Phase 118 拆分:
 * - useAISecurityState.tsx      14 useState + 2 Form + 2 loaders + 7 handlers + filteredData + getComplianceColor + AISecurityState
 * - policyColumns.tsx           8 列 + FILTER_DEFS
 * - Components/AISecurityHeader.tsx
 * - Components/AISecurityStatsRow.tsx
 * - Components/AISecurityTable.tsx
 * - AISecurityModals.tsx        (已有)
 */
import React from 'react';
import { Spin } from 'antd';
import { useAISecurityState } from './useAISecurityState';
import { AISecurityHeader } from './Components/AISecurityHeader';
import { AISecurityStatsRow } from './Components/AISecurityStatsRow';
import { AISecurityTable } from './Components/AISecurityTable';
import { AISecurityModals } from './AISecurityModals';
import {
  severityLabelMap,
  severityColorMap,
  statusColorMap,
  statusLabelMap,
  policyTypeOptions,
  severityOptions,
} from './config';

const AISecurityPage: React.FC = () => {
  const state = useAISecurityState();
  const {
    loading,
    policies,
    stats,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    editPolicy,
    setEditPolicy,
    evaluateModalVisible,
    setEvaluateModalVisible,
    detailModalVisible,
    setDetailModalVisible,
    selectedPolicy,
    setSelectedPolicy,
    evaluations,
    submitting,
    createForm,
    editForm,
    handleCreate,
    handleEdit,
    handleEvaluate,
    getComplianceColor,
  } = state;

  return (
    <div style={{ padding: 0 }} data-testid="ai-security-page">
      <Spin spinning={loading}>
        <AISecurityHeader state={state} />
        <AISecurityStatsRow state={state} />
        <AISecurityTable state={state} />

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
