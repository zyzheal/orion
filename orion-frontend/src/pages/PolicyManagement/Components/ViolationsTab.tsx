/**
 * ViolationsTab - 违规列表 Tab
 * 抽取自 index.tsx (P2-9 Phase 114)
 */
import React, { useMemo } from 'react';
import Table from '@/components/Table';
import { buildViolationColumns } from '../policyColumns';
import type { PolicyManagementState } from '../usePolicyManagementState';

interface ViolationsTabProps {
  state: PolicyManagementState;
}

export const ViolationsTab: React.FC<ViolationsTabProps> = ({ state }) => {
  const { loading, violations, handleResolveViolation } = state;

  const columns = useMemo(
    () => buildViolationColumns({ handleResolveViolation }),
    [handleResolveViolation]
  );

  return (
    <Table
      columns={columns}
      dataSource={violations}
      loading={loading}
      rowKey="id"
      size="middle"
      striped
    />
  );
};
