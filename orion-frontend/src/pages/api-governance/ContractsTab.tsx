/**
 * ContractsTab.tsx - Contracts Tab
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { buildContractColumns } from './ApiGovernanceColumns';
import type { GovernanceContract } from '@/api/api-governance';
import type { ApiVersionType } from './useApiGovernanceState';

export interface ContractsTabProps {
  contracts: GovernanceContract[];
  loading: boolean;
  onCreateContract: () => void;
  onRefresh: () => void;
  onSelectForVerify: (record: GovernanceContract) => void;
  onEvaluate: (contractId: string) => void;
}

export const ContractsTab: React.FC<ContractsTabProps> = ({
  contracts,
  loading,
  onCreateContract,
  onRefresh,
  onSelectForVerify,
  onEvaluate,
}) => (
  <Card
    title="API Contracts"
    extra={
      <Space>
        <Button icon={<PlusOutlined />} onClick={onCreateContract}>
          New Contract
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
      </Space>
    }
  >
    <Table
      columns={buildContractColumns({ onSelectForVerify, onEvaluate })}
      dataSource={contracts}
      rowKey="id"
      loading={loading}
    />
  </Card>
);

export default ContractsTab;
