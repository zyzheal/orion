/**
 * RulesTab.tsx - Governance Rules Tab
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { buildRuleColumns } from './ApiGovernanceColumns';
import type { GovernanceRule } from '@/api/api-governance';

export interface RulesTabProps {
  rules: GovernanceRule[];
  loading: boolean;
  onCreateRule: () => void;
  onRefresh: () => void;
}

export const RulesTab: React.FC<RulesTabProps> = ({
  rules,
  loading,
  onCreateRule,
  onRefresh,
}) => (
  <Card
    title="Governance Rules"
    extra={
      <Space>
        <Button icon={<PlusOutlined />} onClick={onCreateRule}>
          New Rule
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
      </Space>
    }
  >
    <Table columns={buildRuleColumns()} dataSource={rules} rowKey="id" loading={loading} />
  </Card>
);

export default RulesTab;
