/**
 * FilterBar - Pipeline/Status/DateRange/Refresh 筛选栏
 * 抽取自 index.tsx（P2-9 Phase 38）
 */
import React from 'react';
import { Card, Space, Select, DatePicker, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';
import type { PipelineSummary } from './types';
import { statusConfig } from './constants';

const { RangePicker } = DatePicker;
const { Option } = Select;

export interface FilterBarProps {
  pipelines: PipelineSummary[];
  selectedPipeline: string | null;
  setSelectedPipeline: (v: string | null) => void;
  selectedStatus: string | null;
  setSelectedStatus: (v: string | null) => void;
  dateRange: [dayjs.Dayjs, dayjs.Dayjs] | null;
  setDateRange: (v: [dayjs.Dayjs, dayjs.Dayjs] | null) => void;
  loading: boolean;
  loadRuns: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  pipelines,
  selectedPipeline,
  setSelectedPipeline,
  selectedStatus,
  setSelectedStatus,
  dateRange,
  setDateRange,
  loading,
  loadRuns,
}) => (
  <Card style={{ marginBottom: spacing.md }}>
    <Space wrap>
      <Select
        placeholder="Pipeline"
        allowClear
        style={{ width: 200 }}
        value={selectedPipeline || undefined}
        onChange={(v) => setSelectedPipeline(v || null)}
      >
        {pipelines.map((p) => (
          <Option key={p.id} value={p.id}>
            {p.name}
          </Option>
        ))}
      </Select>
      <Select
        placeholder="Status"
        allowClear
        style={{ width: 120 }}
        value={selectedStatus || undefined}
        onChange={(v) => setSelectedStatus(v || null)}
      >
        {Object.keys(statusConfig).map((s) => (
          <Option key={s} value={s}>
            {statusConfig[s].label}
          </Option>
        ))}
      </Select>
      <RangePicker
        value={dateRange}
        onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
        style={{ width: 250 }}
      />
      <Button icon={<ReloadOutlined />} onClick={loadRuns} loading={loading}>
        Refresh
      </Button>
    </Space>
  </Card>
);
