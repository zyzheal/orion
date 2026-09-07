/**
 * MCPManagement state hook
 * 抽取自 index.tsx (P2-9 Phase 147)
 */
import { useCallback, useState } from 'react';
import { Form, message } from 'antd';
import { mcpApi } from './api';
import type { MCPService, MCPTool, MCPServiceFormValues } from './types';

export const useMCPManagementState = () => {
  // Data state
  const [loading, setLoading] = useState(false);
  const [servers, setServers] = useState<MCPService[]>([]);
  const [total, setTotal] = useState(0);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [toolsLoading, setToolsLoading] = useState(false);

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedServer, setSelectedServer] = useState<MCPService | null>(null);

  // Forms
  const [createForm] = Form.useForm<MCPServiceFormValues>();
  const [editForm] = Form.useForm<MCPServiceFormValues>();

  // Loaders
  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await mcpApi.listServers();
      setServers(res.servers || []);
      setTotal(res.total || 0);
    } catch (error: unknown) {
      setServers([]);
      setTotal(0);
      message.error(`加载 MCP 服务失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadTools = useCallback(async (serverId: string) => {
    setToolsLoading(true);
    try {
      const res = await mcpApi.listTools(serverId);
      setTools(res.tools || []);
    } catch (error: unknown) {
      setTools([]);
      message.error(`加载工具列表失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setToolsLoading(false);
    }
  }, []);

  // Handlers
  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await mcpApi.createServer(values);
      message.success(`MCP 服务 "${values.name}" 创建成功`);
      setCreateModalOpen(false);
      createForm.resetFields();
      loadServers();
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(`创建失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleEdit = async () => {
    if (!selectedServer) return;
    try {
      const values = await editForm.validateFields();
      await mcpApi.updateServer(selectedServer.id, values);
      message.success('MCP 服务更新成功');
      setEditModalOpen(false);
      setSelectedServer(null);
      loadServers();
    } catch (error: unknown) {
      if ((error as { errorFields?: unknown }).errorFields) return;
      message.error(`更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await mcpApi.deleteServer(id);
      message.success(`MCP 服务 "${name}" 已删除`);
      loadServers();
    } catch (error: unknown) {
      message.error(`删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      const enabled = !current;
      await mcpApi.updateServer(id, { enabled });
      message.success(`MCP 服务已${enabled ? '启用' : '禁用'}`);
      loadServers();
    } catch (error: unknown) {
      message.error(`操作失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleViewTools = (record: MCPService) => {
    setSelectedServer(record);
    loadTools(record.id);
  };

  const handleOpenEdit = (record: MCPService) => {
    setSelectedServer(record);
    editForm.setFieldsValue(record);
    setEditModalOpen(true);
  };

  const handleOpenCreate = () => setCreateModalOpen(true);
  const handleCloseCreate = () => {
    setCreateModalOpen(false);
    createForm.resetFields();
  };
  const handleCloseEdit = () => {
    setEditModalOpen(false);
    setSelectedServer(null);
  };

  return {
    // data
    loading,
    servers,
    total,
    tools,
    toolsLoading,
    // modal
    createModalOpen,
    editModalOpen,
    selectedServer,
    // forms
    createForm,
    editForm,
    // loaders
    loadServers,
    loadTools,
    // handlers
    handleCreate,
    handleEdit,
    handleDelete,
    handleToggle,
    handleViewTools,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseCreate,
    handleCloseEdit,
  };
};

export type MCPManagementState = ReturnType<typeof useMCPManagementState>;
