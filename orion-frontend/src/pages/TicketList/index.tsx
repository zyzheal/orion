/**
 * TicketList Page
 * - 布局编排: Header + SummaryCards + SearchFilterBar + Table + Modals
 * - 6 文件拆分: types.ts + constants.tsx + useTicketListState.tsx + TicketColumns.tsx + SummaryCards.tsx + index.tsx
 * 抽取自 738 行原始文件 (P2-9 Phase 62)
 */
import React from 'react';
import { Typography, Button, Space } from 'antd';
import {
  PlusOutlined,
  OrderedListOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '@/tokens';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { useTicketListState } from './useTicketListState';
import { useTicketColumns } from './TicketColumns';
import { SummaryCards } from './SummaryCards';
import CreateTicketModal from './CreateTicketModal';
import EditTicketModal from './EditTicketModal';
import DispatchPanel from './DispatchPanel';

const { Title, Text } = Typography;

const TicketList: React.FC = () => {
  const navigate = useNavigate();

  const {
    setSearchQuery,
    loading,
    createModalOpen, setCreateModalOpen,
    editModalOpen, setEditModalOpen,
    editingTicket, setEditingTicket,
    dispatchPanelOpen, setDispatchPanelOpen,
    filteredTickets,
    openCount, inProgressCount, overdueCount, slaBreached,
    filterDefs,
    setFilters,
    handleRefresh,
    handleAssign,
    handleAutoDispatch,
    handleCreateSuccess,
    handleEdit,
    handleEditSuccess,
    handleDelete,
    handleStatusTransition,
  } = useTicketListState();

  const columns = useTicketColumns({
    navigate,
    handleEdit,
    handleAssign,
    handleDelete,
    handleStatusTransition,
  });

  return (
    <div style={{ padding: 0 }} data-testid="ticket-list-page">
      {/* Page header */}
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
            <OrderedListOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            工单管理
          </Title>
          <Text type="secondary">共 {filteredTickets.length} 个工单</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
            刷新
          </Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleAutoDispatch}>
            自动分派
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            创建工单
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <SummaryCards
        openCount={openCount}
        inProgressCount={inProgressCount}
        overdueCount={overdueCount}
        slaBreached={slaBreached}
      />

      {/* Search and filter bar */}
      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="搜索工单 ID、标题、负责人..."
        />
      </div>

      {/* Ticket table */}
      <Table
        columns={columns}
        dataSource={filteredTickets}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
        data-testid="ticket-table"
      />

      {/* Create ticket modal */}
      <CreateTicketModal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit ticket modal */}
      <EditTicketModal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingTicket(null);
        }}
        onSuccess={handleEditSuccess}
        ticket={editingTicket as any}
      />

      {/* Dispatch panel */}
      <DispatchPanel open={dispatchPanelOpen} onClose={() => setDispatchPanelOpen(false)} />
    </div>
  );
};

export default TicketList;
