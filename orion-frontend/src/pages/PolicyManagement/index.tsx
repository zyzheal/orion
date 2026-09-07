/**
 * Policy Management Page
 * Policy list with CRUD, violations dashboard, evaluate modal
 *
 * 2026-08-26: 拆分 2 Tab + Header + StatsRow + state hook + columns + Modals (P2-9 Phase 114)
 */
import React from 'react';
import { Tabs } from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { usePolicyManagementState } from './usePolicyManagementState';
import { PolicyHeader } from './Components/PolicyHeader';
import { PolicyStatsRow } from './Components/PolicyStatsRow';
import { PoliciesTab } from './Components/PoliciesTab';
import { ViolationsTab } from './Components/ViolationsTab';
import { PolicyModals } from './Components/PolicyModals';

dayjs.extend(relativeTime);

const PolicyManagement: React.FC = () => {
  const state = usePolicyManagementState();
  const {
    loading,
    loadData,
    policies,
    violations,
    openViolations,
    blockedViolations,
    form,
    setEditingPolicy,
    setPolicyModalVisible,
    setEvaluateModalVisible,
  } = state;

  return (
    <div style={{ padding: 0 }}>
      <PolicyHeader
        loading={loading}
        onLoadData={loadData}
        onEvaluate={() => setEvaluateModalVisible(true)}
        onCreate={() => {
          setEditingPolicy(null);
          form.resetFields();
          setPolicyModalVisible(true);
        }}
      />

      <PolicyStatsRow
        total={policies.length}
        enabled={policies.filter((p) => p.enabled).length}
        openViolations={openViolations}
        blockedViolations={blockedViolations}
      />

      <Tabs
        defaultActiveKey="policies"
        items={[
          {
            key: 'policies',
            label: '策略列表',
            children: <PoliciesTab state={state} />,
          },
          {
            key: 'violations',
            label: `违规 (${violations.length})`,
            children: <ViolationsTab state={state} />,
          },
        ]}
      />

      <PolicyModals state={state} />
    </div>
  );
};

export default PolicyManagement;
