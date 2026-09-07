/**
 * ModulesListTab - 模块列表 Tab (SearchFilterBar + Table)
 * 抽取自 index.tsx (P2-9 Phase 117)
 */
import React, { useMemo } from 'react';
import { Card, Table } from 'antd';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import type { ModuleDescriptor } from '@/api/module-manager';
import { LEVEL_OPTIONS, STATUS_OPTIONS } from '../constants';
import { buildModuleColumns } from '../moduleColumns';
import type { ModuleManagerState } from '../useModuleManagerState';

interface ModulesListTabProps {
  state: ModuleManagerState;
}

const FILTER_DEFS: FilterDefinition[] = [
  {
    key: 'level',
    label: '模块层级',
    options: LEVEL_OPTIONS,
    placeholder: '按层级筛选',
  },
  {
    key: 'status',
    label: '模块状态',
    options: STATUS_OPTIONS,
    placeholder: '按状态筛选',
  },
];

export const ModulesListTab: React.FC<ModulesListTabProps> = ({ state }) => {
  const {
    loading,
    filteredModules,
    setSearchQuery,
    setLevelFilter,
    setStatusFilter,
    toggleLoading,
    handleToggleModule,
  } = state;

  const columns = useMemo(
    () => buildModuleColumns({ toggleLoading, handleToggleModule }),
    [toggleLoading, handleToggleModule]
  );

  return (
    <Card>
      <div style={{ marginBottom: spacing[4] }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          filters={FILTER_DEFS}
          searchPlaceholder="搜索模块名称、ID或描述..."
          onFilter={(filters) => {
            if (filters.level) setLevelFilter(String(filters.level));
            if (filters.status) setStatusFilter(String(filters.status));
          }}
          initialFilters={{ level: 'all', status: 'all' }}
        />
      </div>

      <Table<ModuleDescriptor>
        columns={columns}
        dataSource={filteredModules}
        rowKey="id"
        loading={loading}
        size="middle"
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 个模块`,
        }}
      />
    </Card>
  );
};
