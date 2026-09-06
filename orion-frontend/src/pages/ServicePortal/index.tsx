/**
 * ITSM Self-Service Portal
 *
 * End-user facing portal for:
 * - Browsing service catalog by category
 * - Submitting service requests (with dynamic form fields)
 * - Viewing own tickets with status tracking
 * - Canceling pending tickets
 * - Viewing ticket details with timeline
 *
 * Aligned with backend /api/v1/self-service/* routes
 *
 * Layout notes: this file keeps the state + data-loading + action handlers.
 * Rendering was split into sibling modules to keep each file reviewable:
 * - ./config              : status/priority/icon maps, priority options
 * - ./columns             : "我的工单" table columns (factory function)
 * - ./ServicePortalModals : header, summary cards, views and request modal
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Badge, Card, Form, Tabs, message } from 'antd';
import { AppstoreOutlined, FileTextOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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
import { spacing, componentRadius, shadows } from '@/tokens';
import { DEFAULT_REQUEST_VALUES } from './config';
import {
  ServicePortalHeader,
  SummaryCards,
  ServiceCatalogView,
  MyTicketsView,
  TicketDetailView,
  RequestModal,
} from './ServicePortalModals';

// ============================================================================
// ServicePortal Page Component
// ============================================================================

const ServicePortal: React.FC = () => {
  const _navigate = useNavigate();
  void _navigate;

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

  const handleOpenRequestModal = (service: ServiceItem) => {
    setSelectedService(service);
    requestForm.resetFields();
    requestForm.setFieldsValue(DEFAULT_REQUEST_VALUES);
    setRequestModalOpen(true);
  };

  const handleSubmitRequest = async () => {
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
  };

  // ============================================================================
  // Ticket Actions
  // ============================================================================

  const handleViewTicket = async (ticket: SelfServiceTicket) => {
    await loadTicketDetail(ticket.id);
  };

  const handleCancelTicket = async (ticket: SelfServiceTicket) => {
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
  };

  // ============================================================================
  // Stats
  // ============================================================================

  const pendingCount = useMemo(
    () => tickets.filter((t) => t.status === 'pending').length,
    [tickets]
  );
  const inProgressCount = useMemo(
    () => tickets.filter((t) => t.status === 'in_progress').length,
    [tickets]
  );
  void inProgressCount;
  const fulfilledCount = useMemo(
    () => tickets.filter((t) => t.status === 'fulfilled').length,
    [tickets]
  );
  const filteredTickets = useMemo(() => {
    if (!ticketStatusFilter || ticketStatusFilter === 'all') return tickets;
    return tickets.filter((t) => t.status === ticketStatusFilter);
  }, [tickets, ticketStatusFilter]);

  // ============================================================================
  // Tab Items
  // ============================================================================

  const tabItems = useMemo(() => {
    const items = [
      {
        key: 'catalog',
        label: (
          <span>
            <AppstoreOutlined />
            服务目录
          </span>
        ),
        children: (
          <ServiceCatalogView
            categories={categories}
            services={services}
            loading={catalogLoading}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onRefresh={loadServices}
            onRequestService={handleOpenRequestModal}
          />
        ),
      },
      {
        key: 'my-tickets',
        label: (
          <span>
            <FileTextOutlined />
            我的工单
            {pendingCount > 0 && (
              <Badge
                count={pendingCount}
                size="small"
                style={{ marginLeft: 6 }}
                overflowCount={99}
              />
            )}
          </span>
        ),
        children: (
          <MyTicketsView
            filteredTickets={filteredTickets}
            loading={ticketsLoading}
            statusFilter={ticketStatusFilter}
            onStatusFilterChange={setTicketStatusFilter}
            onRefresh={loadTickets}
            handleViewTicket={handleViewTicket}
            handleCancelTicket={handleCancelTicket}
            actionLoading={actionLoading}
          />
        ),
      },
    ];

    if (selectedTicket) {
      items.push({
        key: 'ticket-detail',
        label: (
          <span>
            <EyeOutlined />
            工单详情
          </span>
        ),
        children: (
          <TicketDetailView
            ticket={selectedTicket}
            actionLoading={actionLoading}
            onBack={() => setSelectedTicket(null)}
            handleCancelTicket={handleCancelTicket}
          />
        ),
      });
    }

    return items;
  }, [
    services,
    categories,
    selectedCategory,
    selectedService,
    tickets,
    selectedTicket,
    ticketStatusFilter,
    pendingCount,
    actionLoading,
  ]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div data-testid="service-portal-page">
      {/* Page header */}
      <ServicePortalHeader
        onRefresh={() => {
          loadCategories();
          loadTickets();
        }}
      />

      {/* Summary cards */}
      <SummaryCards
        ticketsCount={tickets.length}
        pendingCount={pendingCount}
        fulfilledCount={fulfilledCount}
      />

      {/* Main content tabs */}
      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: shadows.card,
        }}
        styles={
          {
            body: { padding: spacing.lg },
          } as const
        }
      >
        <Tabs
          activeKey={selectedTicket ? 'ticket-detail' : 'catalog'}
          onChange={(key) => {
            if (key === 'catalog') setSelectedTicket(null);
            if (key === 'my-tickets') setSelectedTicket(null);
          }}
          items={tabItems}
          destroyInactiveTabPane={false}
        />
      </Card>

      {/* Request Modal */}
      <RequestModal
        service={selectedService}
        open={requestModalOpen}
        form={requestForm}
        submitting={actionLoading === 'request-submit'}
        onSubmit={handleSubmitRequest}
        onClose={() => setRequestModalOpen(false)}
      />
    </div>
  );
};

export default ServicePortal;
