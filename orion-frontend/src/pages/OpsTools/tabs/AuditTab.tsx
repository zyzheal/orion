/**
 * 运维工具 - 审计事件 Tab
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { auditColumns } from '../columns';
import type { AuditEvent } from '@/api/ops-tools';

interface AuditTabProps {
  auditEvents: AuditEvent[];
  auditPage: number;
  auditTotal: number;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
}

export const AuditTab: React.FC<AuditTabProps> = ({
  auditEvents,
  auditPage,
  auditTotal,
  onPageChange,
  onRefresh,
}) => (
  <Card
    title="审计事件"
    extra={
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
    }
    style={{ marginTop: spacing.md }}
  >
    <Table
      columns={auditColumns}
      dataSource={auditEvents}
      rowKey="id"
      size="middle"
      pagination={{ current: auditPage, total: auditTotal, onChange: onPageChange, pageSize: 10 }}
    />
  </Card>
);
