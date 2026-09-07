/**
 * RDM — 研发管理页面 (Research & Development Management)
 *
 * FE-06: 需求/缺陷/迭代/任务管理
 *
 * Split into components (P2-9 Phase 155):
 * - types.ts / constants.ts / columns.tsx / useRDMState.ts
 * - Components/{RDMHeader,RDMTabs,RDMTable,RDMFormModal}.tsx
 */
import React, { useMemo } from 'react';
import { Button, Card, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useRDMState } from './useRDMState';
import { buildColumnsForTab, buildActionColumn } from './columns';
import { RDMHeader } from './Components/RDMHeader';
import { RDMTabs } from './Components/RDMTabs';
import { RDMTable } from './Components/RDMTable';
import { RDMFormModal } from './Components/RDMFormModal';

const RDM: React.FC = () => {
  const state = useRDMState();

  const baseColumns = useMemo(
    () => buildColumnsForTab(state.activeTab),
    [state.activeTab],
  );
  const actionColumn = useMemo(
    () => buildActionColumn({ handleEdit: state.handleEdit, handleDelete: state.handleDelete }),
    [state.handleEdit, state.handleDelete],
  );
  const columns = useMemo(() => [...baseColumns, actionColumn], [baseColumns, actionColumn]);

  const currentData = {
    requirements: state.requirements,
    defects: state.defects,
    sprints: state.sprints,
    tasks: state.tasks,
  }[state.activeTab] as unknown as Record<string, unknown>[];

  const counts = useMemo(
    () => ({
      requirements: state.requirements.length,
      defects: state.defects.length,
      sprints: state.sprints.length,
      tasks: state.tasks.length,
    }),
    [state.requirements, state.defects, state.sprints, state.tasks],
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <RDMHeader />

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <RDMTabs activeTab={state.activeTab} onChange={state.setActiveTab} counts={counts} />

        <Space style={{ marginBottom: spacing.md }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={state.handleCreate}>
            新建
          </Button>
          <Button icon={<ReloadOutlined />} onClick={state.fetchData} loading={state.loading}>
            刷新
          </Button>
        </Space>

        <RDMTable dataSource={currentData} columns={columns} loading={state.loading} />
      </Card>

      <RDMFormModal
        open={state.modalOpen}
        editingItem={state.editingItem}
        entityName={state.getEntityName()}
        form={state.form}
        users={state.users}
        onOk={state.handleSubmit}
        onCancel={() => state.setModalOpen(false)}
      />
    </div>
  );
};

export default RDM;
