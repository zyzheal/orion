/**
 * ITSM Self-Service Portal
 *
 * 拆分自 index.tsx (P2-9 Phase 214)
 * - useServicePortalState.ts: state + loaders + handlers + stats
 * - Components/MainTabs.tsx: Tabs 3-way (catalog / my-tickets / ticket-detail)
 * - index.tsx: composition (Header + SummaryCards + MainTabs + RequestModal)
 */
import { useNavigate } from 'react-router-dom';
import { useServicePortalState } from './useServicePortalState';
import {
  ServicePortalHeader,
  SummaryCards,
  RequestModal,
} from './ServicePortalModals';
import { MainTabs } from './Components/MainTabs';

const ServicePortal = () => {
  const _navigate = useNavigate();
  void _navigate;

  const {
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
    pendingCount,
    fulfilledCount,
    filteredTickets,
    loadCategories,
    loadServices,
    loadTickets,
    handleOpenRequestModal,
    handleSubmitRequest,
    handleViewTicket,
    handleCancelTicket,
  } = useServicePortalState();

  return (
    <div data-testid="service-portal-page">
      <ServicePortalHeader
        onRefresh={() => {
          loadCategories();
          loadTickets();
        }}
      />

      <SummaryCards
        ticketsCount={tickets.length}
        pendingCount={pendingCount}
        fulfilledCount={fulfilledCount}
      />

      <MainTabs
        categories={categories}
        services={services}
        catalogLoading={catalogLoading}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        loadServices={loadServices}
        handleOpenRequestModal={handleOpenRequestModal}
        filteredTickets={filteredTickets}
        ticketsLoading={ticketsLoading}
        ticketStatusFilter={ticketStatusFilter}
        setTicketStatusFilter={setTicketStatusFilter}
        loadTickets={loadTickets}
        handleViewTicket={handleViewTicket}
        handleCancelTicket={handleCancelTicket}
        actionLoading={actionLoading}
        selectedTicket={selectedTicket}
        setSelectedTicket={setSelectedTicket}
        pendingCount={pendingCount}
      />

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
