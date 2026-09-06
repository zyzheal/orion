/**
 * Distributed Config Center Page
 * 命名空间 → 配置分组 → 配置项 CRUD → 快照发布/回滚 → 变更审计
 *
 * 拆分结构（P2-9 Phase 31）:
 * - useConfigCenterState.ts: 状态 + 6 个 loader + 10 个 CRUD/发布/回滚/审计处理器
 * - columns.tsx: itemColumns hook + snapshotColumns hook + releaseColumns + auditColumns
 * - ItemsTab.tsx: 配置项管理 Tab（含筛选、新建、Modal.confirm 新建分组）
 * - SnapshotsTab.tsx: 快照管理 Tab（含环境筛选、发布快照 + 发布确认）
 * - ReleasesTab.tsx: 发布记录 Tab（含回滚确认）
 * - AuditTab.tsx: 变更审计 Tab
 * - ItemModal.tsx: 配置项新增/编辑 Modal
 * - NamespaceModal.tsx: 创建命名空间 Modal
 * - HistoryModal.tsx: 变更历史 Modal
 */
import React, { useState } from 'react';
import {
  Card,
  Button,
  Row,
  Col,
  Typography,
  Tabs,
  Form,
} from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useConfigCenterState } from './useConfigCenterState';
import { ItemModal } from './ItemModal';
import { NamespaceModal } from './NamespaceModal';
import { HistoryModal } from './HistoryModal';
import { ItemsTab } from './ItemsTab';
import { SnapshotsTab } from './SnapshotsTab';
import { ReleasesTab } from './ReleasesTab';
import { AuditTab } from './AuditTab';

const { Title, Text } = Typography;

const ConfigCenterPage: React.FC = () => {
  const state = useConfigCenterState();
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [nsModalOpen, setNsModalOpen] = useState(false);
  const [nsForm] = Form.useForm();
  const [groupForm] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [releaseForm] = Form.useForm();
  const [rollbackForm] = Form.useForm();

  const {
    activeTab,
    setActiveTab,
    loading,
    namespaces,
    groups,
    selectedNamespace,
    setSelectedNamespace,
    selectedGroup,
    setSelectedGroup,
    items,
    snapshots,
    releases,
    selectedEnv,
    setSelectedEnv,
    audits,
    historyData,
    historyOpen,
    setHistoryOpen,
    loadItems,
    loadAudit,
    handleCreateNamespace,
    handleCreateGroup,
    handleCreateItem,
    handleUpdateItem,
    handleDeleteItem,
    handleViewHistory,
    handlePublishSnapshot,
    handlePublishRelease,
    handleRollback,
  } = state;

  const handleItemSubmit = (payload: any) => {
    if (payload.id && editingItem) {
      const { id, ...values } = payload;
      return handleUpdateItem(id, values);
    }
    return handleCreateItem(payload);
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: spacing.md,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
            <SettingOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            分布式配置中心
          </Title>
          <Text type="secondary" style={{ display: 'block' }}>
            命名空间 · 配置分组 · 快照发布 · 变更审计
          </Text>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.md }}>
        <Col span={6}>
          <Card>
            <Text type="secondary">命名空间</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.primary[500] }}>
              {namespaces.length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">配置项</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.info[500] }}>
              {items.length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">快照</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.success[500] }}>
              {snapshots.length}
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Text type="secondary">发布记录</Text>
            <div style={{ fontSize: 24, fontWeight: 600, color: colors.purple[500] }}>
              {releases.length}
            </div>
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: spacing.md }}>
        <Tabs.TabPane key="items" tab="配置项管理" />
        <Tabs.TabPane key="snapshots" tab="快照管理" />
        <Tabs.TabPane key="releases" tab="发布记录" />
        <Tabs.TabPane key="audit" tab="变更审计" />
      </Tabs>

      {activeTab === 'items' && (
        <ItemsTab
          loading={loading}
          items={items}
          namespaces={namespaces}
          groups={groups}
          selectedNamespace={selectedNamespace}
          setSelectedNamespace={setSelectedNamespace}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          itemModalOpen={itemModalOpen}
          setItemModalOpen={setItemModalOpen}
          editingItem={editingItem}
          setEditingItem={setEditingItem}
          itemForm={itemForm}
          nsModalOpen={nsModalOpen}
          setNsModalOpen={setNsModalOpen}
          groupForm={groupForm}
          loadItems={loadItems}
          handleCreateItem={handleCreateItem}
          handleUpdateItem={handleUpdateItem}
          handleDeleteItem={handleDeleteItem}
          handleViewHistory={handleViewHistory}
          handleCreateGroup={handleCreateGroup}
        />
      )}

      {activeTab === 'snapshots' && (
        <SnapshotsTab
          snapshots={snapshots}
          selectedEnv={selectedEnv}
          setSelectedEnv={setSelectedEnv}
          loading={loading}
          releaseForm={releaseForm}
          handlePublishSnapshot={handlePublishSnapshot}
          handlePublishRelease={handlePublishRelease}
        />
      )}

      {activeTab === 'releases' && (
        <ReleasesTab
          releases={releases}
          selectedEnv={selectedEnv}
          setSelectedEnv={setSelectedEnv}
          rollbackForm={rollbackForm}
          handleRollback={handleRollback}
        />
      )}

      {activeTab === 'audit' && <AuditTab audits={audits} loadAudit={loadAudit} />}

      <ItemModal
        open={itemModalOpen}
        editingItem={editingItem}
        form={itemForm}
        onOk={(values) => {
          handleItemSubmit(values);
          setItemModalOpen(false);
          setEditingItem(null);
          itemForm.resetFields();
        }}
        onCancel={() => {
          setItemModalOpen(false);
          setEditingItem(null);
          itemForm.resetFields();
        }}
      />

      <NamespaceModal
        open={nsModalOpen}
        form={nsForm}
        onOk={async (values) => {
          await handleCreateNamespace(values);
          setNsModalOpen(false);
          nsForm.resetFields();
        }}
        onCancel={() => setNsModalOpen(false)}
      />

      <HistoryModal
        open={historyOpen}
        historyData={historyData}
        onClose={() => setHistoryOpen(false)}
      />
    </div>
  );
};

export default ConfigCenterPage;
