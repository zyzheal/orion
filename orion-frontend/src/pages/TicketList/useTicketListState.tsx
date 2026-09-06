/**
 * useTicketListState.tsx - TicketList 状态 Hook
 * 抽取自 TicketList/index.tsx (P2-9 Phase 62)
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { message, Modal, Select } from 'antd';
import {
  getTickets,
  deleteTicket,
  transitionStatus,
  resolveTicket,
  closeTicket,
  assignTicket,
} from '@/api/ticketing';
import { listUsers, type User } from '@/api/users';
import { categoryLabels, calculateSLA } from './constants';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import type { Ticket } from './types';

export const useTicketListState = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [dispatchPanelOpen, setDispatchPanelOpen] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [engineers, setEngineers] = useState<string[]>([]);
  const [engineersLoading, setEngineersLoading] = useState(false);

  // Load engineers for assignee filter
  useEffect(() => {
    const load = async () => {
      setEngineersLoading(true);
      try {
        const res = await listUsers({ limit: 200 });
        const users: User[] = res.data?.data || [];
        setEngineers(users.map((u) => u.name || u.username).filter(Boolean));
      } catch {
        setEngineers([]);
      } finally {
        setEngineersLoading(false);
      }
    };
    load();
  }, []);

  // Load tickets from API
  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: 1, pageSize: 50, ...filters };
      const response = await getTickets(params);
      setTickets((response.data?.items ?? []) as unknown as Ticket[]);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载工单列表失败：${error.message}`);
      } else {
        message.error('加载工单列表失败');
      }
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  // Filter tickets based on search and filters
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [
          ticket.id,
          ticket.title,
          ticket.assignee || '',
          ticket.reporter,
          ticket.category,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }

      const statusFilter = filters.status;
      if (statusFilter && statusFilter !== 'all' && ticket.status !== statusFilter) return false;

      const priorityFilter = filters.priority;
      if (priorityFilter && priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;

      const categoryFilter = filters.category;
      if (categoryFilter && categoryFilter !== 'all' && ticket.category !== categoryFilter) return false;

      const assigneeFilter = filters.assignee;
      if (assigneeFilter && assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned' && ticket.assignee !== null) return false;
        if (assigneeFilter !== 'unassigned' && ticket.assignee !== assigneeFilter) return false;
      }

      return true;
    });
  }, [searchQuery, filters, tickets]);

  // Summary metrics
  const openCount = useMemo(
    () => tickets.filter((t) => t.status === 'open' || t.status === 'assigned').length,
    [tickets],
  );
  const inProgressCount = useMemo(
    () => tickets.filter((t) => t.status === 'in-progress').length,
    [tickets],
  );
  const overdueCount = useMemo(
    () => tickets.filter((t) => calculateSLA(t).overdue).length,
    [tickets],
  );
  const slaBreached = useMemo(
    () => tickets.filter((t) => calculateSLA(t).overdue).length,
    [tickets],
  );

  // Filter definitions
  const filterDefs = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'status',
        label: '状态',
        options: [
          { label: '全部', value: 'all' },
          { label: '待处理', value: 'open' },
          { label: '已分配', value: 'assigned' },
          { label: '处理中', value: 'in-progress' },
          { label: '已解决', value: 'resolved' },
          { label: '已关闭', value: 'closed' },
        ],
      },
      {
        key: 'priority',
        label: '优先级',
        options: [
          { label: '全部', value: 'all' },
          { label: '紧急', value: 'critical' },
          { label: '高', value: 'high' },
          { label: '中', value: 'medium' },
          { label: '低', value: 'low' },
        ],
      },
      {
        key: 'category',
        label: '分类',
        options: [
          { label: '全部', value: 'all' },
          ...Object.entries(categoryLabels).map(([key, label]) => ({ label, value: key })),
        ],
      },
      {
        key: 'assignee',
        label: '负责人',
        options: [
          { label: '全部', value: 'all' },
          { label: '未分配', value: 'unassigned' },
          ...(engineersLoading ? [] : engineers.map((name) => ({ label: name, value: name }))),
        ],
      },
    ],
    [engineers, engineersLoading],
  );

  // Action handlers
  const handleRefresh = useCallback(() => {
    loadTickets();
  }, [loadTickets]);

  const handleAssign = useCallback(
    (ticket: Ticket) => {
      let assigneeValue: string | null = null;
      Modal.confirm({
        title: '分配工单',
        content: (
          <div>
            <p>工单: {ticket.id}</p>
            <Select
              style={{ width: '100%', marginTop: 8 }}
              placeholder="选择工程师"
              onChange={(v) => {
                assigneeValue = v;
              }}
              options={engineers.map((name) => ({ label: name, value: name }))}
              loading={engineersLoading}
            />
          </div>
        ),
        okText: '确认',
        cancelText: '取消',
        onOk: async () => {
          if (!assigneeValue) {
            message.warning('请选择工程师');
            throw new Error('validation');
          }
          try {
            await assignTicket(ticket.id, { assignee: assigneeValue });
            message.success(`工单已分配给 ${assigneeValue}`);
            loadTickets();
          } catch (error: unknown) {
            if (error instanceof Error && error.message !== 'validation') {
              message.error(`分配失败：${error.message}`);
            }
          }
        },
      });
    },
    [engineers, engineersLoading, loadTickets],
  );

  const handleAutoDispatch = useCallback(() => {
    setDispatchPanelOpen(true);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setCreateModalOpen(false);
    loadTickets();
  }, [loadTickets]);

  const handleEdit = useCallback((ticket: Ticket) => {
    setEditingTicket(ticket);
    setEditModalOpen(true);
  }, []);

  const handleEditSuccess = useCallback(() => {
    setEditModalOpen(false);
    setEditingTicket(null);
    loadTickets();
  }, [loadTickets]);

  const handleDelete = useCallback(
    async (ticket: Ticket) => {
      try {
        await deleteTicket(ticket.id);
        message.success('工单已删除');
        loadTickets();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`删除失败：${error.message}`);
        } else {
          message.error('删除失败');
        }
      }
    },
    [loadTickets],
  );

  const handleStatusTransition = useCallback(
    async (ticket: Ticket, action: string) => {
      try {
        if (action === 'start') {
          await transitionStatus(ticket.id, { toStatus: 'in-progress', performedBy: 'current-user' });
        } else if (action === 'resolve') {
          await resolveTicket(ticket.id);
        } else if (action === 'close') {
          await closeTicket(ticket.id);
        }
        message.success('状态更新成功');
        loadTickets();
      } catch (error: unknown) {
        if (error instanceof Error) {
          message.error(`状态更新失败：${error.message}`);
        } else {
          message.error('状态更新失败');
        }
      }
    },
    [loadTickets],
  );

  return {
    searchQuery, setSearchQuery,
    filters, setFilters,
    loading,
    createModalOpen, setCreateModalOpen,
    editModalOpen, setEditModalOpen,
    editingTicket, setEditingTicket,
    dispatchPanelOpen, setDispatchPanelOpen,
    tickets,
    engineers, engineersLoading,
    filteredTickets,
    openCount, inProgressCount, overdueCount, slaBreached,
    filterDefs,
    loadTickets,
    handleRefresh,
    handleAssign,
    handleAutoDispatch,
    handleCreateSuccess,
    handleEdit,
    handleEditSuccess,
    handleDelete,
    handleStatusTransition,
  };
};
