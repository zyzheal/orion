/**
 * TenantQuotaPage Alerts Card
 * 抽取自 index.tsx (P2-9 Phase 136)
 */
import React from 'react';
import { Card, Table, Button } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import type { QuotaAlert } from '@/api/tenantQuota';
import { buildAlertColumns } from '../columns';

interface AlertsCardProps {
  alerts: QuotaAlert[];
  loadAlerts: () => void;
}

export const AlertsCard: React.FC<AlertsCardProps> = ({ alerts, loadAlerts }) =>
  alerts.length > 0 ? (
    <Card
      title={
        <>
          <WarningOutlined /> 超额告警
        </>
      }
      extra={
        <Button icon={<ReloadOutlined />} size="small" onClick={loadAlerts}>
          刷新
        </Button>
      }
    >
      <Table
        columns={buildAlertColumns()}
        dataSource={alerts}
        rowKey="id"
        size="small"
        pagination={{ pageSize: 10 }}
      />
    </Card>
  ) : null;
