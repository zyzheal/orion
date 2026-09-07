/**
 * Service Registry Page (Phase 6 Service Governance)
 *
 * Features:
 * - Service list with health status, address, port, protocol, version
 * - Search by service name
 * - Filter by health status
 * - Register new service via Modal form
 * - Deregister service with confirmation
 * - Refresh service list
 * - Empty state with guided action
 *
 * 拆分 (P2-9 Phase 142): types / constants / useServiceRegistryState / serviceColumns / Components/*
 */
import React, { useMemo } from 'react';
import { useServiceRegistryState } from './useServiceRegistryState';
import { buildServiceColumns } from './serviceColumns';
import { ServiceRegistryHeader } from './Components/ServiceRegistryHeader';
import { ServiceFilterBar } from './Components/ServiceFilterBar';
import { ServiceTable } from './Components/ServiceTable';
import { RegisterServiceModal } from './Components/RegisterServiceModal';

const ServiceRegistry: React.FC = () => {
  const state = useServiceRegistryState();

  const columns = useMemo(
    () =>
      buildServiceColumns({
        deregisteringId: state.deregisteringId,
        deregisterLoading: state.deregisterLoading,
        handleDeregister: state.handleDeregister,
        loadServices: state.loadServices,
      }),
    [state.deregisteringId, state.deregisterLoading, state.handleDeregister, state.loadServices]
  );

  return (
    <div style={{ padding: 0 }}>
      <ServiceRegistryHeader
        total={state.services.length}
        loading={state.loading}
        onRefresh={state.handleRefresh}
        onOpenRegister={state.openRegister}
      />
      <ServiceFilterBar
        searchText={state.searchText}
        onSearchChange={(e) => state.setSearchText(e.target.value)}
        healthFilter={state.healthFilter}
        onHealthFilterChange={(v) => state.setHealthFilter(v || undefined)}
      />
      <ServiceTable
        services={state.services}
        loading={state.loading}
        columns={columns}
        onOpenRegister={state.openRegister}
      />
      <RegisterServiceModal
        visible={state.registerModalVisible}
        loading={state.registerLoading}
        form={state.registerForm}
        onClose={state.closeRegister}
        onSubmit={state.handleRegister}
      />
    </div>
  );
};

export default ServiceRegistry;
