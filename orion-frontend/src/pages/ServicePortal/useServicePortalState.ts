/**
 * useServicePortalState.ts - ServicePortal 状态管理 Hook
 * 抽取自 index.tsx (P2-9 Phase 214)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message } from 'antd';
import {
  getServiceCategories,
  getCatalogServices,
  getMyTickets,
  getMyTicket,
  createMyTicket,
  cancelMyTicket,
  type ServiceCategory,
  type ServiceItem,
  type SelfServiceTicket,
  type CreateSelfServiceTicketPayload,
} from '@/api/self-service';

export function useServicePortalState() {
  // ---- Catalog State ----
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  // ---- Tickets State ----
  const [tickets, setTickets] = useState<SelfServiceTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string | undefined>(undefined);
  const [selectedTicket, setSelectedTicket] = useState<SelfServiceTicket | null>(null);

  // ---- Modals & Forms ----
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [requestForm] = Form.useForm();

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadCategories = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const res = await getServiceCategories();
      setCategories(res.data || []);
    } catch (err: unknown) {
      message.error(`加载服务分类失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadServices = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (selectedCategory) params.category_id = selectedCategory;
      const res = await getCatalogServices(params);
      setServices(res.data || []);
    } catch (err: unknown) {
      message.error(`加载服务目录失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedCategory]);

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 50, offset: 0 };
      if (ticketStatusFilter) params.status = ticketStatusFilter;
      const res = await getMyTickets(params);
      setTickets(res.data || []);
    } catch (err: unknown) {
      message.error(`加载我的工单失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setTicketsLoading(false);
    }
  }, [ticketStatusFilter]);

  const loadTicketDetail = useCallback(async (id: string) => {
    try {
      const detail = await getMyTicket(id);
      setSelectedTicket(detail);
    } catch (err: unknown) {
      message.error(`加载工单详情失败: ${err instanceof Error ? err.message : '未知错误'}`);
    }
  }, []);

  useEffect(() => {
    loadCategories();
    loadTickets();
  }, [loadCategories, loadTickets]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  // ============================================================================
  // Request Submission
  // ============================================================================

  const handleOpenRequestModal = useCallback(
    (service: ServiceItem) => {
      setSelectedService(service);
      requestForm.resetFields();
      requestForm.setFieldsValue({ priority: 'medium' });
      setRequestModalOpen(true);
    },
    [requestForm]
  );

  const handleSubmitRequest = useCallback(async () => {
    if (!selectedService) return;
    try {
      const values = await requestForm.validateFields();
      setActionLoading('request-submit');
      const payload: CreateSelfServiceTicketPayload = {
        service_id: selectedService.id,
        title: values.title,
        description: values.description || '',
        priority: values.priority || 'medium',
        form_data: values.form_data || {},
      };
      await createMyTicket(payload);
      message.success('服务请求已提交');
      setRequestModalOpen(false);
      loadTickets();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return;
      message.error(`提交失败: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setActionLoading(null);
    }
  }, [selectedService, requestForm, loadTickets]);

  // ============================================================================
  // Ticket Actions
  // ============================================================================

  const handleViewTicket = useCallback(
    async (ticket: SelfServiceTicket) => {
      await loadTicketDetail(ticket.id);
    },
    [loadTicketDetail]
  );

  const handleCancelTicket = useCallback(
    async (ticket: SelfServiceTicket) => {
      try {
        setActionLoading(`cancel-${ticket.id}`);
        await cancelMyTicket(ticket.id);
        message.success('工单已取消');
        loadTickets();
        if (selectedTicket?.id === ticket.id) {
          setSelectedTicket(null);
        }
      } catch (err: unknown) {
        message.error(`取消失败: ${err instanceof Error ? err.message : '未知错误'}`);
      } finally {
        setActionLoading(null);
      }
    },
    [selectedTicket, loadTickets]
  );

  // ============================================================================
  // Stats
  // ============================================================================

  const pendingCount = useMemo(
    () => tickets.filter((t) => t.status === 'pending').length,
    [tickets]
  );
  const fulfilledCount = useMemo(
    () => tickets.filter((t) => t.status === 'fulfilled').length,
    [tickets]
  );
  const filteredTickets = useMemo(() => {
    if (!ticketStatusFilter || ticketStatusFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === ticketStatusFilter);
  }, [tickets, ticketStatusFilter]);

  return {
    // State
    categories,
    services,
    catalogLoading,
    selectedCategory,
    setSelectedCategory,
    selectedService,
    tickets,
    ticketsLoading,
    ticketStatusFilter,
    setTicketStatusFilter,
    selectedTicket,
    setSelectedTicket,
    requestModalOpen,
    setRequestModalOpen,
    actionLoading,
    requestForm,
    // Stats
    pendingCount,
    fulfilledCount,
    filteredTickets,
    // Actions
    loadCategories,
    loadServices,
    loadTickets,
    handleOpenRequestModal,
    handleSubmitRequest,
    handleViewTicket,
    handleCancelTicket,
  };
}
