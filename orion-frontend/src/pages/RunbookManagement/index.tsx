/**
 * Runbook Management Page
 *
 * Features:
 * - Runbook definition CRUD
 * - Runbook execution and history
 * - Step-by-step execution tracking
 *
 * 组件化重构 (P2-9 Phase 163)
 */
import { useMemo } from 'react';
import { Button, Card, Row, Col, Table, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useRunbookManagementState } from './useRunbookManagementState';
import { buildRunbookColumns, buildExecutionColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { RunbookFormModal } from './Components/RunbookFormModal';
import { DetailDrawer } from './Components/DetailDrawer';
import { ExecutionDetailDrawer } from './Components/ExecutionDetailDrawer';

export default function RunbookManagementPage() {
  const state = useRunbookManagementState();
  const {
    runbooks,
    loading,
    modalVisible,
    editingRunbook,
    drawerVisible,
    selectedRunbook,
    executions,
    executionDrawerVisible,
    selectedExecution,
    activeTab,
    form,
    setActiveTab,
    setModalVisible,
    setDrawerVisible,
    setExecutionDrawerVisible,
    fetchRunbooks,
    handleCreate,
    handleEdit,
    handleSave,
    handleDelete,
    handleExecute,
    handleViewDetail,
    handleViewExecution,
  } = state;

  const runbookColumns = useMemo(
    () =>
      buildRunbookColumns({
        handleViewDetail,
        handleEdit,
        handleDelete,
        handleExecute,
      }),
    [handleViewDetail, handleEdit, handleDelete, handleExecute]
  );

  const executionColumns = useMemo(
    () => buildExecutionColumns({ handleViewExecution }),
    [handleViewExecution]
  );

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'definitions',
            label: 'Runbook 定义',
            children: (
              <Card>
                <Row justify="space-between" style={{ marginBottom: spacing.md }}>
                  <Col>
                    <Button icon={<ReloadOutlined />} onClick={fetchRunbooks}>
                      刷新
                    </Button>
                  </Col>
                  <Col>
                    <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                      创建 Runbook
                    </Button>
                  </Col>
                </Row>
                <Table
                  columns={runbookColumns}
                  dataSource={runbooks}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 20 }}
                />
              </Card>
            ),
          },
        ]}
      />

      <RunbookFormModal
        open={modalVisible}
        form={form}
        isEdit={!!editingRunbook}
        onOk={handleSave}
        onCancel={() => setModalVisible(false)}
      />

      <DetailDrawer
        open={drawerVisible}
        runbook={selectedRunbook}
        executions={executions}
        executionColumns={executionColumns}
        onClose={() => setDrawerVisible(false)}
      />

      <ExecutionDetailDrawer
        open={executionDrawerVisible}
        execution={selectedExecution}
        onClose={() => setExecutionDrawerVisible(false)}
      />
    </div>
  );
}
