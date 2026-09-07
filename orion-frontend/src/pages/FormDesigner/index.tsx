/**
 * FormDesigner — 表单引擎与条件引擎设计器
 *
 * FE-09: 表单设计器 (JSON Schema Form Builder + Condition Evaluator)
 *
 * 功能对标:
 *   - NeatLogic 表单引擎 3 页 (form-designer / form-preview / condition-engine)
 *
 * 拆分结构 (P2-9 Phase 161):
 * - types.ts: FormSchema + ConditionRule
 * - constants.ts: COND_KEY + STATUS_MAP
 * - api.ts: listConditions/createCondition/updateCondition/deleteCondition (localStorage-backed)
 * - columns.tsx: buildFormColumns/buildConditionColumns/buildActionColumn
 * - useFormDesignerState.ts: 2 useQuery + 4 handlers + Form
 * - Components/PageHeader.tsx
 * - Components/FormFields.tsx
 * - Components/FormModal.tsx
 * - Components/SchemaPreviewModal.tsx
 */
import React, { useMemo } from 'react';
import { Button, Card, Space, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import TableWrapper from '@/components/Table';
import { spacing } from '@/tokens';
import { useFormDesignerState } from './useFormDesignerState';
import { buildFormColumns, buildConditionColumns, buildActionColumn } from './columns';
import { PageHeader } from './Components/PageHeader';
import { FormModal } from './Components/FormModal';
import { SchemaPreviewModal } from './Components/SchemaPreviewModal';

const FormDesigner: React.FC = () => {
  const state = useFormDesignerState();
  const {
    activeTab, setActiveTab,
    forms, conditions,
    modalOpen, setModalOpen,
    previewOpen, setPreviewOpen,
    previewSchema,
    editingItem,
    submitting,
    form,
    loading,
    handleCreate,
    handleDelete,
    handleEdit,
    handlePreview,
    handleSubmit,
    fetchData,
  } = state;

  const currentData = ((activeTab === 'forms' ? forms : conditions) ?? []) as unknown as Record<
    string,
    unknown
  >[];

  const baseColumns = useMemo(
    () => (activeTab === 'forms' ? buildFormColumns() : buildConditionColumns()),
    [activeTab],
  );
  const actionColumn = useMemo(
    () =>
      buildActionColumn({
        activeTab,
        onEdit: handleEdit,
        onDelete: handleDelete,
        onPreview: handlePreview,
      }),
    [activeTab, handleEdit, handleDelete, handlePreview],
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <Card style={{ borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
        <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as 'forms' | 'conditions')}>
          <Tabs.TabPane tab={`表单设计器 (${(forms ?? []).length})`} key="forms" />
          <Tabs.TabPane tab=`条件引擎 (${(conditions ?? []).length})`} key="conditions" />
        </Tabs>

        <Space style={{ marginBottom: spacing.md }}>
          <Button type="primary" icon=<PlusOutlined />} onClick={handleCreate}>
            {activeTab === 'forms' ? '新建表单' : '新建条件'}
          </Button>
          <Button icon=<ReloadOutlined />} onClick={() => fetchData()} loading={loading}>
            刷新
          </Button>
        </Space>

        <TableWrapper
          dataSource={currentData}
          columns={[...baseColumns, actionColumn]}
          rowKey="id"
          loading={loading}
          locale={{
            emptyText: <Empty description={`暂无${activeTab === 'forms' ? '表单' : '条件'}`} />,
          }}
          pagination={{ pageSize: 20, showTotal: (t: number) => `共 ${t} 条` } as any}
        />
      </Card>

      <FormModal
        open={modalOpen}
        editingItem={editingItem}
        submitting={submitting}
        activeTab={activeTab}
        form={form}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
      />

      <SchemaPreviewModal
        open={previewOpen}
        schema={previewSchema}
        onCancel={() => setPreviewOpen(false)}
      />
    </div>
  );
};

export default FormDesigner;
