/**
 * AccountsTab.tsx - Cloud Accounts Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { buildAccountColumns } from './MultiCloudAdvancedColumns';
import type { CloudAccount } from '@/api/multi-cloud';

export interface AccountsTabProps {
  accounts: CloudAccount[];
  loading: boolean;
  onRegister: () => void;
  onRefresh: () => void;
}

export const AccountsTab: React.FC<AccountsTabProps> = ({
  accounts,
  loading,
  onRegister,
  onRefresh,
}) => (
  <Card
    title="Cloud Account Management"
    style={{ borderRadius: 12 }}
    extra={
      <Space>
        <Button icon={<PlusOutlined />} onClick={onRegister}>
          Register Account
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
      </Space>
    }
  >
    <Table
      columns={buildAccountColumns()}
      dataSource={accounts}
      rowKey={(r: any) => r.id || r.account_id}
      loading={loading}
    />
  </Card>
);

export default AccountsTab;
