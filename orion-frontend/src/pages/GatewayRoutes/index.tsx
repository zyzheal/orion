/**
 * Gateway Routes Management Page
 *
 * Admin page for API Gateway route management: create, edit, view, enable/disable, delete routes.
 * Uses api/gateway-routes.ts for all data operations.
 *
 * Route: /console/gateway-routes
 * Access: admin, platform_admin
 *
 * 拆分结构（P2-9 Phase 28）:
 * - useGatewayRoutesState.ts: 状态 + 数据加载 + CRUD 处理器 + 过滤
 * - StatsBar.tsx: 4 张统计卡
 * - RouteTableColumns.tsx: 9 列表格配置
 * - RouteModal.tsx: 新建/编辑 Modal
 * - RouteDetailDrawer.tsx: 详情 Drawer
 * - constants.ts: HTTP 方法/颜色/标签常量
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Input,
  Select,
  Alert,
  Table,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  SearchOutlined,
  ClearOutlined,
  GatewayOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import { useGatewayRoutesState } from './useGatewayRoutesState';
import { StatsBar } from './StatsBar';
import { useRouteTableColumns } from './RouteTableColumns';
import { RouteModal } from './RouteModal';
import { RouteDetailDrawer } from './RouteDetailDrawer';
import { HTTP_METHODS, METHOD_LABELS } from './constants';

const { Title, Text } = Typography;
const { Option } = Select;

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
      {/* Page header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: spacing.lg,
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <GatewayOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            API 网关路由
          </Title>
          <Text type="secondary">管理和监控 API Gateway 路由规则</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAll} loading={loading}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建路由
          </Button>
        </Space>
      </div>

      {/* Stats bar */}
      <StatsBar stats={stats} routes={routes} loading={loading} />

      {/* Error alert */}
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

      {/* Main table card */}
      <Card
        style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
        styles={{ body: { padding: 0 } }}
      >
        {/* Filter bar */}
        <div
          style={{
            padding: spacing.md,
            borderBottom: `1px solid ${colors.neutral[200]}`,
            display: 'flex',
            flexWrap: 'wrap',
            gap: spacing.sm,
            alignItems: 'center',
          }}
        >
          <Input
            placeholder="搜索路径、服务、描述..."
            prefix={<SearchOutlined style={{ color: colors.neutral[400] }} />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: 240, borderRadius: componentRadius.input }}
            allowClear
          />
          <Select
            placeholder="HTTP 方法"
            value={methodFilter}
            onChange={(v) => setMethodFilter(v)}
            allowClear
            style={{ width: 120, borderRadius: componentRadius.input }}
          >
            {HTTP_METHODS.map((m) => (
              <Option key={m} value={m}>
                {METHOD_LABELS[m] || m}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="状态"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
            allowClear
            style={{ width: 100, borderRadius: componentRadius.input }}
          >
            <Option value="enabled">已启用</Option>
            <Option value="disabled">已禁用</Option>
          </Select>
          <Select
            placeholder="认证"
            value={authFilter}
            onChange={(v) => setAuthFilter(v)}
            allowClear
            style={{ width: 100, borderRadius: componentRadius.input }}
          >
            <Option value="true">需要</Option>
            <Option value="false">无需</Option>
          </Select>
          <Select
            placeholder="目标服务"
            value={serviceFilter}
            onChange={(v) => setServiceFilter(v)}
            allowClear
            showSearch
            style={{ width: 160, borderRadius: componentRadius.input }}
            filterOption={(input, option) =>
              String(option?.children ?? '')
                .toLowerCase()
                .includes(input.toLowerCase())
            }
          >
            {uniqueServices.map((s) => (
              <Option key={s} value={s}>
                {s}
              </Option>
            ))}
          </Select>
          <div style={{ flex: 1 }} />
          <Button icon={<ClearOutlined />} onClick={clearFilters}>
            清除筛选
          </Button>
        </div>

        {/* Table */}
        <Table
          columns={columns}
          dataSource={filteredRoutes}
          loading={loading}
          rowKey="id"
          size="middle"
          scroll={{ x: 1200 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (total) => `共 ${total} 条`,
          }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <RouteModal
        visible={modalVisible}
        mode={modalMode}
        form={form}
        confirmLoading={actionLoading === 'create' || actionLoading?.startsWith('edit-') || false}
        onSubmit={handleModalSubmit}
        onClose={() => setModalVisible(false)}
      />

      {/* Detail Drawer */}
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
