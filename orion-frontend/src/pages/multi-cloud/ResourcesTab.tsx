/**
 * ResourcesTab.tsx - Cloud Resources Tab
 * 抽取自 MultiCloudAdvancedPage.tsx (P2-9 Phase 47)
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { buildResourceColumns } from './MultiCloudAdvancedColumns';
import type { CloudResource } from '@/api/multi-cloud';

export interface ResourcesTabProps {
  resources: CloudResource[];
  loading: boolean;
  onRefresh: () => void;
}

export const ResourcesTab: React.FC<ResourcesTabProps> = ({ resources, loading, onRefresh }) => (
  <Card
    title="Cloud Resources"
    style={{ borderRadius: 12 }}
    extra={
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        Refresh
      </Button>
    }
  >
    <Table
      columns={buildResourceColumns()}
      dataSource={resources}
      rowKey={(r: any) => r.id || r.resource_id}
      loading={loading}
    />
  </Card>
);

export default ResourcesTab;
