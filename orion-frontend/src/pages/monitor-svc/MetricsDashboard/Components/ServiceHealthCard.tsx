/**
 * MetricsDashboard service health table
 * 抽取自 index.tsx (P2-9 Phase 145)
 */
import React, { useMemo } from 'react';
import { Card } from 'antd';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import Table from '@/components/Table';
import SearchFilterBar from '@/components/SearchFilterBar';
import { SERVICE_OPTIONS } from '../constants';
import { buildServiceColumns } from '../serviceColumns';
import type { ServiceHealthRow } from '../types';

interface ServiceHealthCardProps {
  filteredServiceHealth: ServiceHealthRow[];
  loading: boolean;
  selectedService: string;
  onServiceChange: (v: string) => void;
}

export const ServiceHealthCard: React.FC<ServiceHealthCardProps> = ({
  filteredServiceHealth,
  loading,
  selectedService,
  onServiceChange,
}) => {
  const columns = useMemo(() => buildServiceColumns(), []);
  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        key: 'service',
        label: 'Service',
        options: SERVICE_OPTIONS,
        placeholder: 'Filter by service',
      },
    ],
    []
  );

  return (
    <Card title="Service Health Summary" size="small">
      <SearchFilterBar
        filters={filterDefinitions}
        showSearch={false}
        onFilter={(filters) => {
          if (filters.service) {
            onServiceChange(String(filters.service));
          }
        }}
        initialFilters={selectedService !== 'all' ? { service: selectedService } : {}}
      />
      <Table<ServiceHealthRow>
        columns={columns}
        dataSource={filteredServiceHealth}
        rowKey="key"
        loading={loading}
        size="small"
      />
    </Card>
  );
};
