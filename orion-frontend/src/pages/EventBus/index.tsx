/**
 * EventBus Monitoring Page
 * Event bus status monitoring and event stream visualization
 *
 * 组件化重构 (P2-9 Phase 164)
 */
import { useMemo } from 'react';
import { Card } from 'antd';
import Table from '@/components/Table';
import { useEventBusState } from './useEventBusState';
import { buildEventColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { FilterBar } from './Components/FilterBar';
import { DetailDrawer } from './Components/DetailDrawer';

export default function EventBusMonitoring() {
  const state = useEventBusState();
  const {
    statusFilter,
    setStatusFilter,
    typeFilter,
    setTypeFilter,
    searchQuery,
    setSearchQuery,
    detailDrawerVisible,
    setDetailDrawerVisible,
    selectedEvent,
    loading,
    refetch,
    stats,
    eventTypes,
    filteredEvents,
    openDetail,
  } = state;

  const columns = useMemo(() => buildEventColumns({ openDetail }), [openDetail]);

  return (
    <div style={{ padding: 0 }} >
      <PageHeader loading={loading} onRefresh={() => refetch()} />

      <StatsCards stats={stats} />

      <FilterBar
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        eventTypes={eventTypes}
      />

      <Card>
        <Table
          columns={columns}
          dataSource={filteredEvents}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      <DetailDrawer
        open={detailDrawerVisible}
        event={selectedEvent}
        onClose={() => setDetailDrawerVisible(false)}
      />
    </div>
  );
}
