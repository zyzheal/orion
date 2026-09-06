/**
 * TrackingTab.tsx - SLA 追踪记录 Tab (筛选 + 创建按钮 + 表格)
 * 抽取自 SLA/index.tsx (P2-9 Phase 55)
 */
import React, { useMemo } from 'react';
import { Button, Space, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import Table from '@/components/Table';
import { spacing } from '@/tokens';
import type { SLADefinition, SLATracking } from '@/api/sla';
import { TRACKING_STATUS_OPTIONS, ENTITY_TYPE_OPTIONS } from './config';
import { getTrackingColumns } from './columns';

export interface TrackingTabProps {
  trackings: SLATracking[];
  trackingTotal: number;
  loading: boolean;
  trackingStatusFilter: string | undefined;
  setTrackingStatusFilter: (v: string | undefined) => void;
  trackingEntityFilter: string | undefined;
  setTrackingEntityFilter: (v: string | undefined) => void;
  handleOpenCreateTrackingModal: () => void;
  handleUpdateTrackingStatus: (id: string, status: string) => void;
  handleMarkBreach: (id: string) => void;
  definitionMap: Record<string, SLADefinition>;
}

const toolbarStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: spacing.md,
  flexWrap: 'wrap',
  gap: spacing.sm,
};

export const TrackingTab: React.FC<TrackingTabProps> = (props) => {
  const {
    trackings,
    loading,
    trackingStatusFilter,
    setTrackingStatusFilter,
    trackingEntityFilter,
    setTrackingEntityFilter,
    handleOpenCreateTrackingModal,
    handleUpdateTrackingStatus,
    handleMarkBreach,
    definitionMap,
  } = props;

  const trackingColumns = useMemo(
    () => getTrackingColumns({
      onStatusUpdate: handleUpdateTrackingStatus,
      onBreach: handleMarkBreach,
      definitionMap,
    }),
    [handleUpdateTrackingStatus, handleMarkBreach, definitionMap],
  );

  return (
    <>
      <div style={toolbarStyle}>
        <Space size="middle" wrap>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 130 }}
            value={trackingStatusFilter}
            onChange={setTrackingStatusFilter}
            options={[TRACKING_STATUS_OPTIONS].slice()}
          />
          <Select
            placeholder="实体类型"
            allowClear
            style={{ width: 120 }}
            value={trackingEntityFilter}
            onChange={setTrackingEntityFilter}
            options={[ENTITY_TYPE_OPTIONS].slice()}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleOpenCreateTrackingModal}>
          创建追踪
        </Button>
      </div>
      <Table columns={trackingColumns} dataSource={trackings} loading={loading} rowKey="id" size="middle" striped />
    </>
  );
};
