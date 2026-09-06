/**
 * ViolationsTab.tsx - Violations Tab
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { buildViolationColumns } from './ApiGovernanceColumns';
import type { GovernanceViolation } from '@/api/api-governance';

export interface ViolationsTabProps {
  violations: GovernanceViolation[];
  loading: boolean;
  onRefresh: () => void;
}

export const ViolationsTab: React.FC<ViolationsTabProps> = ({
  violations,
  loading,
  onRefresh,
}) => (
  <Card
    title="Governance Violations"
    extra={
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        Refresh
      </Button>
    }
  >
    <Table
      columns={buildViolationColumns()}
      dataSource={violations}
      rowKey="id"
      loading={loading}
    />
  </Card>
);

export default ViolationsTab;
