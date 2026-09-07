/**
 * MCP Server Management Page (A7 + B6)
 *
 * 管理 MCP (Model Context Protocol) 服务注册、启停、工具发现。
 * 后端 /api/v1/mcp/* 已实现。
 *
 * Features:
 * - Server CRUD: list / create / update / delete MCP servers
 * - Enable/disable servers
 * - Tool discovery: list tools per server
 * - Stats overview: total servers, active, total tools
 *
 * 拆分 (P2-9 Phase 147): types / api / columns / useMCPManagementState / Components/*
 */
import React from 'react';
import { spacing } from '@/tokens';
import { useMCPManagementState } from './useMCPManagementState';
import { MCPManagementHeader } from './Components/MCPManagementHeader';
import { StatsRow } from './Components/StatsRow';
import { ServerTable } from './Components/ServerTable';
import { ToolDiscoveryCard } from './Components/ToolDiscoveryCard';
import { CreateServiceModal } from './Components/CreateServiceModal';
import { EditServiceModal } from './Components/EditServiceModal';
import type { ServerColumnDeps } from './columns';

const MCPManagement: React.FC = () => {
  const state = useMCPManagementState();

  const activeCount = state.servers.filter((s) => s.enabled).length;
  const coverage =
    state.total > 0
      ? `${Math.round((state.tools.length / state.total) * 100)}%`
      : '0%';

  const colDeps: ServerColumnDeps = {
    handleViewTools: state.handleViewTools,
    handleOpenEdit: state.handleOpenEdit,
    handleDelete: state.handleDelete,
    handleToggle: state.handleToggle,
  };

  return (
    <div style={{ padding: spacing.lg }}>
      <MCPManagementHeader />
      <StatsRow
        total={state.total}
        activeCount={activeCount}
        toolsCount={state.tools.length}
        coverage={coverage}
      />
      <ServerTable
        servers={state.servers}
        loading={state.loading}
        colDeps={colDeps}
        onRefresh={state.loadServers}
        onOpenCreate={state.handleOpenCreate}
      />
      <ToolDiscoveryCard
        server={state.selectedServer}
        tools={state.tools}
        loading={state.toolsLoading}
        onRefreshTools={state.loadTools}
      />
      <CreateServiceModal
        open={state.createModalOpen}
        form={state.createForm}
        onCancel={state.handleCloseCreate}
        onOk={state.handleCreate}
      />
      <EditServiceModal
        server={state.selectedServer}
        open={state.editModalOpen}
        form={state.editForm}
        onCancel={state.handleCloseEdit}
        onOk={state.handleEdit}
      />
    </div>
  );
};

export default MCPManagement;
