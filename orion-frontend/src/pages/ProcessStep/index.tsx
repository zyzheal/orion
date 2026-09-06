/**
 * Process Step Engine Page
 *
 * Features:
 * - Process definition CRUD with steps/transitions editor
 * - Process instance list with status filtering
 * - Instance detail drawer with step history timeline
 * - Step advancement actions (approve, reject, pause, retry, etc.)
 * - State machine visualization
 *
 * 主入口 (P2-9 Phase 96 refactor: 已抽取 constants / columns / useProcessStepState / Tabs/*)
 */
import { Typography, Tabs } from 'antd';
import { ApartmentOutlined, HistoryOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { ProcessStepModals } from './ProcessStepModals';
import {
  getAllowedActions,
  getTimelineColor,
  stepTypeLabel,
  statusColor,
  statusLabel,
  actionLabel,
  actionIcon,
} from './constants';
import { DefinitionsTab } from './Tabs/DefinitionsTab';
import { InstancesTab } from './Tabs/InstancesTab';
import { useProcessStepState } from './useProcessStepState';

const { Title } = Typography;

export default function ProcessStepPage() {
  const s = useProcessStepState();

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.md }}>
        <ApartmentOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流程引擎
      </Title>

      <Tabs
        activeKey={s.activeTab}
        onChange={s.setActiveTab}
        items={[
          {
            key: 'definitions',
            label: (
              <span>
                <ApartmentOutlined /> 流程定义
              </span>
            ),
            children: (
              <DefinitionsTab
                definitions={s.definitions}
                defLoading={s.defLoading}
                defTotal={s.defTotal}
                defPage={s.defPage}
                setDefPage={s.setDefPage}
                setDefFilter={s.setDefFilter}
                fetchDefinitions={s.fetchDefinitions}
                handleCreateDef={s.handleCreateDef}
                handleViewDefDetail={s.handleViewDefDetail}
                handleEditDef={s.handleEditDef}
                handleDeleteDef={s.handleDeleteDef}
                handleStartInstance={s.handleStartInstance}
              />
            ),
          },
          {
            key: 'instances',
            label: (
              <span>
                <HistoryOutlined /> 流程实例
              </span>
            ),
            children: (
              <InstancesTab
                instances={s.instances}
                instLoading={s.instLoading}
                instTotal={s.instTotal}
                instPage={s.instPage}
                setInstPage={s.setInstPage}
                setInstFilter={s.setInstFilter}
                fetchInstances={s.fetchInstances}
                handleStartInstance={s.handleStartInstance}
                handleViewInstance={s.handleViewInstance}
              />
            ),
          },
        ]}
      />

      <ProcessStepModals
        definitions={s.definitions}
        editingDef={s.editingDef}
        defModalOpen={s.defModalOpen}
        defModalLoading={s.defModalLoading}
        setDefModalOpen={s.setDefModalOpen}
        defForm={s.defForm}
        handleSaveDef={s.handleSaveDef}
        handleCreateDef={s.handleCreateDef}
        setEditingDef={s.setEditingDef}
        startModalOpen={s.startModalOpen}
        startModalLoading={s.startModalLoading}
        startForm={s.startForm}
        handleConfirmStart={s.handleConfirmStart}
        setStartModalOpen={s.setStartModalOpen}
        detailDrawerOpen={s.detailDrawerOpen}
        setDetailDrawerOpen={s.setDetailDrawerOpen}
        detailInstance={s.detailInstance}
        stepHistory={s.stepHistory}
        stepLoading={s.stepLoading}
        handleAdvanceStep={s.handleAdvanceStep}
        defDetailOpen={s.defDetailOpen}
        setDefDetailOpen={s.setDefDetailOpen}
        defDetail={s.defDetail}
        handleStartInstance={s.handleStartInstance}
        handleEditDef={s.handleEditDef}
        getAllowedActions={getAllowedActions}
        getTimelineColor={getTimelineColor}
        stepTypeLabel={stepTypeLabel}
        statusColor={statusColor}
        statusLabel={statusLabel}
        actionLabel={actionLabel}
        actionIcon={actionIcon}
      />
    </div>
  );
}
