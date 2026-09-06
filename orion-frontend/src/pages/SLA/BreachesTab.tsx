/**
 * BreachesTab.tsx - SLA 违约事件 Tab (筛选 + 表格)
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 */
import React from 'react';
import { Input } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import { colors, spacing } from '@/tokens';
import type { SLABreachEvent } from '@/api/sla';
import { breachColumns } from './columns';

export interface BreachesTabProps {
  breaches: SLABreachEvent[];
  breachTotal: number;
  loading: boolean;
  breachTrackingFilter: string | undefined;
  setBreachTrackingFilter: (v: string | undefined) => void;
}

export const BreachesTab: React.FC<BreachesTabProps> = (props) => {
  const {
    breaches,
    loading,
    breachTrackingFilter,
    setBreachTrackingFilter,
  } = props;

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: spacing.md,
          gap: spacing.sm,
        }}
      >
        <Input
          placeholder="按追踪 ID 筛选"
          allowClear
          style={{ width: 260 }}
          value={breachTrackingFilter}
          onChange={(e) => setBreachTrackingFilter(e.target.value || undefined)}
          prefix={<ExclamationCircleOutlined style={{ color: colors.neutral[400] }} />}
        />
      </div>
      <Table columns={breachColumns} dataSource={breaches} loading={loading} rowKey="id" size="middle" striped />
    </>
  );
};
