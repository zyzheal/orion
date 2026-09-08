/**
 * 告警闭环与升级策略 (Alert Closure & Escalation)
 * /api/v1/alert-escalation — 策略管理 · 升级触发器 · 告警闭环 · MTTR
 *
 * 重构自 P2-9 Phase 88 (654 → ~215 行):
 *  - constants.ts - SEVERITY_MAP / CLOSURE_STATUS
 *  - columns.tsx - makePolicyColumns / makeTriggerColumns / makeClosureColumns
 *  - useAlertClosureState.ts - 全部状态与 handler
 *  - Modals/PolicyModal.tsx - 新建/编辑策略弹窗
 *  - Modals/PolicyDetailModal.tsx - 策略详情弹窗
 *
 * 二次拆分 (P2-9 Phase 235):
 *  - Components/MTTRMetricsCard.tsx - MTTR 指标卡
 *  - Components/PoliciesTab.tsx - 升级策略 Tab
 *  - Components/ClosuresTab.tsx - 告警闭环 Tab
 *  - index.tsx: 组合层
 */
import React from 'react';
import { Tabs, Typography } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useAlertClosureState } from './useAlertClosureState';
import { makePolicyColumns, makeTriggerColumns, makeClosureColumns } from './columns';
import { PolicyModal } from './Modals/PolicyModal';
import { PolicyDetailModal } from './Modals/PolicyDetailModal';
import { MTTRMetricsCard } from './Components/MTTRMetricsCard';
import { PoliciesTab } from './Components/PoliciesTab';
import { ClosuresTab } from './Components/ClosuresTab';

const { Title, Text } = Typography;

const AlertClosurePage: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    loading,
    modalOpen,
    setModalOpen,
    detailOpen,
    setDetailOpen,
    selectedItem,
    form,
    policies,
    triggers,
    closures,
    metrics,
    policyStatus,
    setPolicyStatus,
    loadTriggers,
    loadClosures,
    handleRefresh,
    handleCreate,
    handleEdit,
    handleSubmit,
    handleDelete,
    handleViewDetail,
    handleEvaluate,
    handleAcknowledge,
    handleResolve,
    handleTriggerResolve,
  } = useAlertClosureState();

  const policyColumns = makePolicyColumns(handleViewDetail, handleEvaluate, handleEdit, handleDelete);
  const triggerColumns = makeTriggerColumns(handleTriggerResolve);
  const closureColumns = makeClosureColumns(handleAcknowledge, handleResolve);

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: 8 }}>
        <BellOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        告警闭环与升级策略
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        升级策略管理 · 告警确认与解决 · MTTR 指标追踪
      </Text>

      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as typeof activeTab)}>
        <Tabs.TabPane tab={`升级策略 (${policies.length})`} key="policies" />
        <Tabs.TabPane tab={`告警闭环 (${closures.length})`} key="closures" />
        <Tabs.TabPane tab="MTTR 指标" key="metrics" />
      </Tabs>

      {activeTab === 'policies' && (
        <PoliciesTab
          policyColumns={policyColumns}
          triggerColumns={triggerColumns}
          policies={policies}
          triggers={triggers}
          loading={loading}
          onRefresh={handleRefresh}
          onCreate={handleCreate}
          onLoadTriggers={loadTriggers}
        />
      )}

      {activeTab === 'closures' && (
        <ClosuresTab
          columns={closureColumns}
          dataSource={closures}
          loading={loading}
          policyStatus={policyStatus}
          setPolicyStatus={setPolicyStatus}
          onLoadClosures={loadClosures}
        />
      )}

      {activeTab === 'metrics' && metrics && <MTTRMetricsCard metrics={metrics} />}

      <PolicyModal
        open={modalOpen}
        form={form}
        selectedItem={selectedItem}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      />

      <PolicyDetailModal
        open={detailOpen}
        selectedItem={selectedItem}
        onClose={() => setDetailOpen(false)}
      />
    </div>
  );
};

export default AlertClosurePage;
