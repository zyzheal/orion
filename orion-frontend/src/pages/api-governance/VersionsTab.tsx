/**
 * VersionsTab.tsx - Version Management Tab
 * 抽取自 ApiGovernancePage.tsx (P2-9 Phase 48)
 */
import React from 'react';
import { Card, Table, Button, Space } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { buildVersionColumns } from './ApiGovernanceColumns';
import type { ApiVersionType } from './useApiGovernanceState';

export interface VersionsTabProps {
  versions: ApiVersionType[];
  loading: boolean;
  onRegisterVersion: () => void;
  onRefresh: () => void;
  onDeprecate: (record: ApiVersionType) => void;
  onRetire: (versionId: string) => void;
}

export const VersionsTab: React.FC<VersionsTabProps> = ({
  versions,
  loading,
  onRegisterVersion,
  onRefresh,
  onDeprecate,
  onRetire,
}) => (
  <Card
    title="API Version Management & Deprecation Tracking"
    extra={
      <Space>
        <Button icon={<PlusOutlined />} onClick={onRegisterVersion}>
          Register Version
        </Button>
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          Refresh
        </Button>
      </Space>
    }
  >
    <Table
      columns={buildVersionColumns({ onDeprecate, onRetire })}
      dataSource={versions}
      rowKey="id"
      loading={loading}
    />
  </Card>
);

export default VersionsTab;
