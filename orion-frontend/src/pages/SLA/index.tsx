/**
 * SLA Management Page
 * SLA definitions CRUD, tracking management, breach event log, compliance statistics
 *
 * P2-9 Phase 55 重构:
 * - 全部 state + 4 loaders + 1 coordinator + 7 handlers 抽入 useSLAState.ts
 * - 2 Modals (Def + Tracking) 抽入 SLAModals.tsx
 * - 4 张统计卡片 抽入 SLAStatsBar.tsx
 * - 3 Tabs (definitions/tracking/breaches) 各自抽成独立组件
 * - 主页面仅保留 layout + 2 Form.useForm + form setFieldsValue/resetFields useEffects + form wrapper handlers
 */
import { useEffect } from 'react';
import { Typography, Button, Card, Tabs, Form } from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { useSLAState } from './useSLAState';
import { SLAStatsBar } from './SLAStatsBar';
import { DefinitionsTab } from './DefinitionsTab';
import { TrackingTab } from './TrackingTab';
import { BreachesTab } from './BreachesTab';
import { SLAModals } from './SLAModals';

const { Title, Text } = Typography;

const SLAManagement: React.FC = () => {
  const state = useSLAState();
  const {
    loading,
    activeTab, setActiveTab,
    definitions, defTotal,
    defTypeFilter, setDefTypeFilter,
    defStatusFilter, setDefStatusFilter,
    defModalVisible, setDefModalVisible,
    editingDef, setEditingDef,
    trackings, trackingTotal,
    trackingStatusFilter, setTrackingStatusFilter,
    trackingEntityFilter, setTrackingEntityFilter,
    trackingModalVisible, setTrackingModalVisible,
    breaches, breachTotal,
    breachTrackingFilter, setBreachTrackingFilter,
    stats,
    definitionMap,
    loadData,
    handleSaveDefinition,
    handleDeleteDefinition,
    handleOpenEditDefModal,
    handleOpenCreateDefModal,
    handleCreateTracking,
    handleUpdateTrackingStatus,
    handleMarkBreach,
  } = state;

  // ---- Forms (kept in main page; modals file consumes the form instance) ----
  const [defForm] = Form.useForm();
  const [trackingForm] = Form.useForm();

  // Set/reset form fields when Def modal opens
  useEffect(() => {
    if (!defModalVisible) return;
    if (editingDef) {
      defForm.setFieldsValue({
        name: editingDef.name,
        description: editingDef.description,
        type: editingDef.type,
        target_value: editingDef.target_value,
        target_unit: editingDef.target_unit,
        business_hours_only: editingDef.business_hours_only,
        priority: editingDef.priority,
        category: editingDef.category,
      });
    } else {
      defForm.resetFields();
      defForm.setFieldsValue({ business_hours_only: false });
    }
  }, [defModalVisible, editingDef, defForm]);

  // Reset tracking form when modal opens
  useEffect(() => {
    if (trackingModalVisible) {
      trackingForm.resetFields();
    }
  }, [trackingModalVisible, trackingForm]);

  // ---- Form wrapper handlers (validateFields + call hook handler + resetFields) ----
  const handleSaveDefinitionWrapper = async () => {
    try {
      const values = await defForm.validateFields();
      await handleSaveDefinition(values);
      defForm.resetFields();
    } catch {
      // Form validation error - do nothing
    }
  };

  const handleCreateTrackingWrapper = async () => {
    try {
      const values = await trackingForm.validateFields();
      await handleCreateTracking(values);
      trackingForm.resetFields();
    } catch {
      // Form validation error
    }
  };

  const handleOpenCreateTrackingModal = () => {
    setTrackingModalVisible(true);
  };

  // ---- Tab Items ----
  const tabItems = [
    {
      key: 'definitions',
      label: `SLA 定义 (${defTotal})`,
      children: (
        <DefinitionsTab
          definitions={definitions}
          defTotal={defTotal}
          loading={loading}
          defTypeFilter={defTypeFilter}
          setDefTypeFilter={setDefTypeFilter}
          defStatusFilter={defStatusFilter}
          setDefStatusFilter={setDefStatusFilter}
          handleOpenCreateDefModal={handleOpenCreateDefModal}
          handleOpenEditDefModal={handleOpenEditDefModal}
          handleDeleteDefinition={handleDeleteDefinition}
        />
      ),
    },
    {
      key: 'tracking',
      label: `追踪记录 (${trackingTotal})`,
      children: (
        <TrackingTab
          trackings={trackings}
          trackingTotal={trackingTotal}
          loading={loading}
          trackingStatusFilter={trackingStatusFilter}
          setTrackingStatusFilter={setTrackingStatusFilter}
          trackingEntityFilter={trackingEntityFilter}
          setTrackingEntityFilter={setTrackingEntityFilter}
          handleOpenCreateTrackingModal={handleOpenCreateTrackingModal}
          handleUpdateTrackingStatus={handleUpdateTrackingStatus}
          handleMarkBreach={handleMarkBreach}
          definitionMap={definitionMap}
        />
      ),
    },
    {
      key: 'breaches',
      label: `违约事件 (${breachTotal})`,
      children: (
        <BreachesTab
          breaches={breaches}
          breachTotal={breachTotal}
          loading={loading}
          breachTrackingFilter={breachTrackingFilter}
          setBreachTrackingFilter={setBreachTrackingFilter}
        />
      ),
    },
  ];

  // ---- Render ----
  return (
    <Layout>
      <div style={{ padding: 0 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: spacing.lg,
          }}
        >
          <div>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <SafetyCertificateOutlined
                style={{ marginRight: spacing[3], color: colors.primary[500] }}
              />
              SLA 管理
            </Title>
            <Text type="secondary">定义、追踪和管理服务级别协议，确保服务质量达标</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

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
