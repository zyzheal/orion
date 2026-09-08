/**
 * MainTabs - 服务门户 3 个 Tab（目录/我的工单/详情）
 * 抽取自 index.tsx (P2-9 Phase 214)
 */
import { useMemo } from 'react';
import { Badge, Card, Tabs } from 'antd';
import {
  AppstoreOutlined,
  FileTextOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { spacing, componentRadius, shadows } from '@/tokens';
import type { ServiceCategory, ServiceItem, SelfServiceTicket } from '@/api/self-service';
import {
  ServiceCatalogView,
  MyTicketsView,
  TicketDetailView,
} from '../ServicePortalModals';

interface Props {
  categories: ServiceCategory[];
  services: ServiceItem[];
  catalogLoading: boolean;
  selectedCategory?: string;
  setSelectedCategory: (v: string | undefined) => void;
  loadServices: () => Promise<void>;
  handleOpenRequestModal: (s: ServiceItem) => void;

  filteredTickets: SelfServiceTicket[];
  ticketsLoading: boolean;
  ticketStatusFilter?: string;
  setTicketStatusFilter: (v: string | undefined) => void;
  loadTickets: () => Promise<void>;
  handleViewTicket: (t: SelfServiceTicket) => void;
  handleCancelTicket: (t: SelfServiceTicket) => void;
  actionLoading: string | null;

  selectedTicket: SelfServiceTicket | null;
  setSelectedTicket: (t: SelfServiceTicket | null) => void;
  pendingCount: number;
}

export const MainTabs = ({
  categories,
  services,
  catalogLoading,
  selectedCategory,
  setSelectedCategory,
  loadServices,
  handleOpenRequestModal,
  filteredTickets,
  ticketsLoading,
  ticketStatusFilter,
  setTicketStatusFilter,
  loadTickets,
  handleViewTicket,
  handleCancelTicket,
  actionLoading,
  selectedTicket,
  setSelectedTicket,
  pendingCount,
}: Props) => {
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
    catalogLoading,
    selectedCategory,
    setSelectedCategory,
    loadServices,
    handleOpenRequestModal,
    filteredTickets,
    ticketsLoading,
    ticketStatusFilter,
    setTicketStatusFilter,
    loadTickets,
    handleViewTicket,
    handleCancelTicket,
    actionLoading,
    selectedTicket,
    setSelectedTicket,
    pendingCount,
  ]);

  return (
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
  );
};
