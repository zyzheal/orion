/**
 * Service Health Summary Card
 * 抽取自 index.tsx (P2-9 Phase 128)
 */
import React from 'react';
import { Card } from 'antd';
import Table, { TableColumn } from '@/components/Table';
import SearchFilterBar, { FilterDefinition } from '@/components/SearchFilterBar';
import { serviceColumns } from '../serviceColumns';
import { SERVICE_OPTIONS } from '../constants';
import type { ServiceHealthRow } from '../types';

interface ServiceHealthCardProps {
  filteredServiceHealth: ServiceHealthRow[];
  loading: boolean;
  selectedService: string;
  setSelectedService: (v: string) => void;
}

const FILTER_DEFINITIONS: FilterDefinition[] = [
  {
    key: 'service',
    label: 'Service',
    options: SERVICE_OPTIONS,
    placeholder: 'Filter by service',
  },
];

export const ServiceHealthCard: React.FC<ServiceHealthCardProps> = ({
  filteredServiceHealth,
  loading,
  selectedService,
  setSelectedService,
}) => (
  <Card title="Service Health Summary" size="small">
    <SearchFilterBar
      filters={FILTER_DEFINITIONS}
      showSearch={false}
      onFilter={(filters) => {
        if (filters.service) {
          setSelectedService(String(filters.service));
        }
      }}
      initialFilters={selectedService !== 'all' ? { service: selectedService } : {}}
    />

    <Table<ServiceHealthRow>
      columns={serviceColumns as TableColumn<ServiceHealthRow>[]}
      dataSource={filteredServiceHealth}
      rowKey="key"
      loading={loading}
      size="small"
    />
  </Card>
);
