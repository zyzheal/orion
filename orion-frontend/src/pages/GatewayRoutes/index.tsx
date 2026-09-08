/**
 * Gateway Routes Management Page
 *
 * Admin page for API Gateway route management: create, edit, view, enable/disable, delete routes.
 * Uses api/gateway-routes.ts for all data operations.
 *
 * Route: /console/gateway-routes
 * Access: admin, platform_admin
 *
 * 拆分结构（P2-9 Phase 231）:
 * - useGatewayRoutesState.ts: 状态 + 数据加载 + CRUD 处理器 + 过滤
 * - constants.ts: HTTP 方法/颜色/标签常量
 * - StatsBar.tsx: 4 张统计卡
 * - RouteTableColumns.tsx: 9 列表格配置
 * - RouteModal.tsx: 新建/编辑 Modal
 * - RouteDetailDrawer.tsx: 详情 Drawer
 * - Components/PageHeader.tsx: 标题 + 刷新/新建按钮
 * - Components/FilterBar.tsx: 筛选栏（搜索 + 5 个下拉）
 * - Components/RoutesTableCard.tsx: 主表格卡（含 FilterBar）
 * - index.tsx: 组合层
 */
import React from 'react';
import { Alert } from 'antd';
import { componentRadius, spacing } from '@/tokens';
import { useGatewayRoutesState } from './useGatewayRoutesState';
import { StatsBar } from './StatsBar';
import { useRouteTableColumns } from './RouteTableColumns';
import { RouteModal } from './RouteModal';
import { RouteDetailDrawer } from './RouteDetailDrawer';
import { PageHeader } from './Components/PageHeader';
import { RoutesTableCard } from './Components/RoutesTableCard';

const GatewayRoutesPage: React.FC = () => {
  const {
    routes,
    stats,
    loading,
    error,
    setError,
    actionLoading,
    searchQuery,
    setSearchQuery,
    methodFilter,
    setMethodFilter,
    statusFilter,
    setStatusFilter,
    authFilter,
    setAuthFilter,
    serviceFilter,
    setServiceFilter,
    clearFilters,
    uniqueServices,
    filteredRoutes,
    modalVisible,
    setModalVisible,
    modalMode,
    selectedRoute,
    form,
    drawerVisible,
    setDrawerVisible,
    drawerLoading,
    handleCreate,
    handleEdit,
    handleView,
    handleModalSubmit,
    handleDelete,
    handleToggle,
    loadAll,
  } = useGatewayRoutesState();

  const columns = useRouteTableColumns({
    actionLoading,
    handleToggle,
    handleView,
    handleEdit,
    handleDelete,
  });

  return (
    <div style={{ padding: 0 }} data-testid="gateway-routes-page">
      <PageHeader loading={loading} onRefresh={loadAll} onCreate={handleCreate} />

      <StatsBar stats={stats} routes={routes} loading={loading} />

      {error && (
        <Alert
          message={error.message}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: spacing.md, borderRadius: componentRadius.card }}
        />
      )}

      <RoutesTableCard
        columns={columns}
        dataSource={filteredRoutes}
        loading={loading}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        methodFilter={methodFilter}
        setMethodFilter={setMethodFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        authFilter={authFilter}
        setAuthFilter={setAuthFilter}
        serviceFilter={serviceFilter}
        setServiceFilter={setServiceFilter}
        uniqueServices={uniqueServices}
        onClearFilters={clearFilters}
      />

      <RouteModal
        visible={modalVisible}
        mode={modalMode}
        form={form}
        confirmLoading={actionLoading === 'create' || actionLoading?.startsWith('edit-') || false}
        onSubmit={handleModalSubmit}
        onClose={() => setModalVisible(false)}
      />

      <RouteDetailDrawer
        visible={drawerVisible}
        loading={drawerLoading}
        route={selectedRoute}
        actionLoading={actionLoading}
        onClose={() => setDrawerVisible(false)}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default GatewayRoutesPage;
