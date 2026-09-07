/**
 * SecretsTable - Secret 列表表
 * 抽取自 index.tsx (P2-9 Phase 124)
 */
import React from 'react';
import Table from '@/components/Table';
import type { Secret } from '@/api/secrets';
import { buildSecretColumns } from '../secretColumns';
import type { SecretsManagementState } from '../useSecretsManagementState';

interface SecretsTableProps {
  state: SecretsManagementState;
}

export const SecretsTable: React.FC<SecretsTableProps> = ({ state }) => {
  const { loading, filteredSecrets, openEdit, handleDelete } = state;

  const columns = buildSecretColumns({ openEdit, handleDelete });

  return (
    <Table<Secret>
      columns={columns}
      dataSource={filteredSecrets}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  );
};
