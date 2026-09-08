/**
 * Approval Management Page (P2-9 Phase 56)
 * Multi-level approval workflow management (M33)
 * Layout: Header + StatsPanel + Filters + Table + Modals + DetailDrawer
 * P2-9 Phase 276 拆分: 188->79 行 (-58%), 新增 Components/{PageHeader,FilterBar,DetailPanel,ModalsBundle}.tsx
 */
import React from 'react';
import { Form, Card } from 'antd';
import Table from '@/components/Table';
import PageSkeleton from '@/components/PageSkeleton';
import { useApprovalState } from './useApprovalState';
import { useApprovalColumns } from './ApprovalColumns';
import { ApprovalStatsPanel } from './ApprovalStatsPanel';
import { PageHeader } from './Components/PageHeader';
import { FilterBar } from './Components/FilterBar';
import { DetailPanel } from './Components/DetailPanel';
import { ApprovalModalsBundle } from './Components/ModalsBundle';

const ApprovalManagement: React.FC = () => {
  const state = useApprovalState();
  const { loading, approvals, filteredData, stats } = state;

  const [createForm] = Form.useForm();

  const handleCreateWrapper = async () => {
    try {
      const values = await createForm.validateFields();
      await state.handleCreate(values);
      createForm.resetFields();
    } catch {
      // Form validation error - handled by Form
    }
  };

  const columns = useApprovalColumns({
    openCommentModal: state.openCommentModal,
    openDetail: state.openDetail,
  });

  const isInitialLoading = loading && approvals.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader
            loading={loading}
            onRefresh={state.loadData}
            onCreateClick={() => state.setCreateModalVisible(true)}
          />

          <ApprovalStatsPanel stats={stats} />

          <Card>
            <FilterBar
              searchQuery={state.searchQuery}
              setSearchQuery={state.setSearchQuery}
              statusFilter={state.statusFilter}
              setStatusFilter={state.setStatusFilter}
            />
            <Table
              columns={columns}
              dataSource={filteredData}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </Card>

          <DetailPanel
            detailDrawerVisible={state.detailDrawerVisible}
            setDetailDrawerVisible={state.setDetailDrawerVisible}
            selectedApproval={state.selectedApproval}
            openCommentModal={state.openCommentModal}
          />

          <ApprovalModalsBundle
            state={state}
            createForm={createForm}
            handleCreateWrapper={handleCreateWrapper}
          />
        </>
      )}
    </div>
  );
};

export default ApprovalManagement;
