/**
 * SLA Management Page
 * SLA definitions CRUD, tracking management, breach event log, compliance statistics
 *
 * P2-9 Phase 55 重构:
 * - 全部 state + 4 loaders + 1 coordinator + 7 handlers 抽入 useSLAState.ts
 * - 2 Modals (Def + Tracking) 抽入 SLAModals.tsx
 * - 4 张统计卡片 抽入 SLAStatsBar.tsx
 * - 3 Tabs (definitions/tracking/breaches) 各自抽成独立组件
 *
 * P2-9 Phase 238 拆分:
 * - useSLAFormHandlers.ts - 表单 wrapper handlers + setFieldsValue useEffects
 * - Components/PageHeader.tsx - 标题栏 + 刷新按钮
 * - Components/TabItems.tsx - Tab 项目构建 (buildTabItems)
 * - index.tsx: 组合层
 */
import { Form } from 'antd';
import { Card, Tabs } from 'antd';
import { Layout } from '@/components/Layout';
import { spacing, componentRadius, shadows } from '@/tokens';
import { useSLAState } from './useSLAState';
import { useSLAFormHandlers } from './useSLAFormHandlers';
import { SLAStatsBar } from './SLAStatsBar';
import { SLAModals } from './SLAModals';
import { PageHeader } from './Components/PageHeader';
import { buildTabItems } from './Components/TabItems';

const SLAManagement: React.FC = () => {
  const state = useSLAState();
  const {
    loading,
    activeTab, setActiveTab,
    definitions, defTotal,
    defModalVisible, setDefModalVisible,
    editingDef, setEditingDef,
    trackingModalVisible, setTrackingModalVisible,
    stats,
    loadData,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [defForm] = Form.useForm();
  const [trackingForm] = Form.useForm();

  const {
    handleSaveDefinitionWrapper,
    handleCreateTrackingWrapper,
    handleOpenCreateTrackingModal,
  } = useSLAFormHandlers({ state, defForm, trackingForm });

  const tabItems = buildTabItems({ state, handleOpenCreateTrackingModal });

  // ---- Render ----
  return (
    <Layout>
      <div style={{ padding: 0 }}>
        <PageHeader loading={loading} onRefresh={loadData} />

        <SLAStatsBar stats={stats} defTotal={defTotal} />

        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Card>

        <SLAModals
          defModalVisible={defModalVisible}
          setDefModalVisible={setDefModalVisible}
          editingDef={editingDef}
          setEditingDef={setEditingDef}
          defForm={defForm}
          handleSaveDefinition={handleSaveDefinitionWrapper}
          trackingModalVisible={trackingModalVisible}
          setTrackingModalVisible={setTrackingModalVisible}
          trackingForm={trackingForm}
          handleCreateTracking={handleCreateTrackingWrapper}
          definitions={definitions}
        />
      </div>
    </Layout>
  );
};

export default SLAManagement;
