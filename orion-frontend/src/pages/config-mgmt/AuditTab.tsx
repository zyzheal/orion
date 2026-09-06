/**
 * AuditTab - 变更审计 Tab
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { ConfigAudit } from '@/api/distributedConfig';
import { auditColumns } from './columns';

export interface AuditTabProps {
  audits: ConfigAudit[];
  loadAudit: () => void;
}

export const AuditTab: React.FC<AuditTabProps> = ({ audits, loadAudit }) => (
  <Card
    title="变更审计"
    extra={
      <Button icon={<ReloadOutlined />} size="small" onClick={loadAudit}>
        刷新
      </Button>
    }
  >
    <Table
      columns={auditColumns}
      dataSource={audits}
      rowKey="id"
      pagination={{ pageSize: 10 }}
      size="small"
    />
  </Card>
);
