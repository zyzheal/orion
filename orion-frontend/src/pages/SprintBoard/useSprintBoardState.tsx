/**
 * useSprintBoardState - Sprint Board 页面状态 + 加载器 + CRUD/看板/待办处理器
 * 从 index.tsx 抽离，handleSave(values) 由 index.tsx wrapper 委托
 */
import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import {
  listSprints,
  createSprint,
  updateSprint,
  deleteSprint,
  getSprintBoard,
  addTicketToSprint,
  removeTicketFromSprint,
  getBacklog,
  getBurndownData,
  type Sprint,
  type SprintBoard as SprintBoardType,
  type BurndownData,
  type CreateSprintInput,
} from '@/api/sprints';

export function useSprintBoardState() {
  const [activeTab, setActiveTab] = useState('list');
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  // Kanban state
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<SprintBoardType | null>(null);
  const [boardLoading, setBoardLoading] = useState(false);

  // Backlog state
  const [backlog, setBacklog] = useState<
    { ticketId: string; title: string; priority: string; storyPoints: number | null }[]
  >([]);
  const [backlogLoading, setBacklogLoading] = useState(false);

  // Burndown state
  const [burndownData, setBurndownData] = useState<BurndownData[]>([]);
  const [burndownLoading, setBurndownLoading] = useState(false);

  // Active sprint filter for list tab
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // ── Data fetching ──────────────────────────────────────────────

  const fetchSprints = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listSprints(statusFilter ? { status: statusFilter } : undefined);
      setSprints(res.data ?? []);
    } catch {
      message.error('获取 Sprint 列表失败');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchBoard = useCallback(async (sprintId: string) => {
    setBoardLoading(true);
    try {
      const res = await getSprintBoard(sprintId);
      setBoardData(res.data ?? null);
    } catch {
      message.error('获取看板数据失败');
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const fetchBacklog = useCallback(async () => {
    setBacklogLoading(true);
    try {
      const res = await getBacklog();
      setBacklog(res.data ?? []);
    } catch {
      message.error('获取待办列表失败');
    } finally {
      setBacklogLoading(false);
    }
  }, []);

  const fetchBurndown = useCallback(async (sprintId: string) => {
    setBurndownLoading(true);
    try {
      const res = await getBurndownData(sprintId);
      setBurndownData(res.data ?? []);
    } catch {
      // Burndown data may not be available yet
      setBurndownData([]);
    } finally {
      setBurndownLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSprints();
  }, [fetchSprints]);

  useEffect(() => {
    if (selectedSprintId) {
      fetchBoard(selectedSprintId);
      fetchBurndown(selectedSprintId);
    }
  }, [selectedSprintId, fetchBoard, fetchBurndown]);

  useEffect(() => {
    if (activeTab === 'backlog') {
      fetchBacklog();
    }
  }, [activeTab, fetchBacklog]);

  // ── Sprint CRUD handlers ──────────────────────────────────────

  const handleCreate = () => {
    setEditingSprint(null);
    setModalVisible(true);
  };

  const handleEdit = (record: Sprint) => {
    setEditingSprint(record);
    setModalVisible(true);
  };

  const handleSave = async (values: any) => {
    setConfirmLoading(true);
    try {
      const [start, end] = values.dateRange ?? [];
      const input: CreateSprintInput = {
        name: values.name,
        goal: values.goal,
        startDate: start?.format('YYYY-MM-DD') ?? '',
        endDate: end?.format('YYYY-MM-DD') ?? '',
        capacity: values.capacity,
      };
      if (editingSprint) {
        await updateSprint(editingSprint.id, {
          ...input,
          status: values.status,
        });
        message.success('Sprint 更新成功');
      } else {
        await createSprint(input);
        message.success('Sprint 创建成功');
      }
      setModalVisible(false);
      fetchSprints();
    } catch {
      message.error('保存失败');
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteSprint(id);
      message.success('Sprint 已删除');
      fetchSprints();
    } catch {
      message.error('删除失败');
    }
  };

  const handleActivate = async (record: Sprint) => {
    try {
      await updateSprint(record.id, { status: 'active' });
      message.success('Sprint 已启动');
      fetchSprints();
    } catch {
      message.error('启动失败');
    }
  };

  const handleComplete = async (record: Sprint) => {
    try {
      await updateSprint(record.id, { status: 'completed' });
      message.success('Sprint 已完成');
      fetchSprints();
    } catch {
      message.error('操作失败');
    }
  };

  // ── Board actions ──────────────────────────────────────────────

  const handleRemoveTicket = async (ticketId: string) => {
    if (!selectedSprintId) return;
    try {
      await removeTicketFromSprint(selectedSprintId, ticketId);
      message.success('已从 Sprint 移除');
      fetchBoard(selectedSprintId);
    } catch {
      message.error('移除失败');
    }
  };

  const handleAddToSprint = async (ticketId: string) => {
    if (!selectedSprintId) {
      message.warning('请先选择 Sprint');
      return;
    }
    try {
      await addTicketToSprint(selectedSprintId, ticketId);
      message.success('已添加到 Sprint');
      fetchBoard(selectedSprintId);
      fetchBacklog();
    } catch {
      message.error('添加失败');
    }
  };

  // ── Burndown calculation ───────────────────────────────────────

  const burndownPercent =
    burndownData.length > 0
      ? Math.round(
          (burndownData[burndownData.length - 1].remainingPoints /
            (burndownData[0].remainingPoints || 1)) *
            100
        )
      : 0;

  return {
    // State
    activeTab, setActiveTab,
    sprints, loading,
    modalVisible, setModalVisible, confirmLoading, setConfirmLoading,
    editingSprint, setEditingSprint,
    selectedSprintId, setSelectedSprintId,
    boardData, boardLoading,
    backlog, backlogLoading,
    burndownData, burndownLoading, burndownPercent,
    statusFilter, setStatusFilter,
    // Loaders
    fetchSprints, fetchBoard, fetchBacklog, fetchBurndown,
    // Handlers
    handleCreate, handleEdit, handleSave, handleDelete, handleActivate, handleComplete,
    handleRemoveTicket, handleAddToSprint,
  };
}
