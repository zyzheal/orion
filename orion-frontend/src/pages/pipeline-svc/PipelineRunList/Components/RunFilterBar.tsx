/**
 * PipelineRunList Filter Bar
 * 抽取自 index.tsx (P2-9 Phase 140)
 */
import React from 'react';
import { DatePicker } from 'antd';
import dayjs from 'dayjs';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { spacing } from '@/tokens';
import { FILTER_DEFS } from '../constants';
import type { DateRange, Filters } from '../types';

const { RangePicker } = DatePicker;

interface RunFilterBarProps {
  filters: Filters;
  setFilters: (v: Filters) => void;
  onSearch: (query: string) => void;
  dateRange: DateRange;
  setDateRange: (v: DateRange) => void;
}

export const RunFilterBar: React.FC<RunFilterBarProps> = ({
  filters,
  setFilters,
  onSearch,
  dateRange,
  setDateRange,
}) => (
  <div style={{ marginBottom: spacing.md }}>
    <SearchFilterBar
      onSearch={onSearch}
      onFilter={setFilters}
      filters={FILTER_DEFS as FilterDefinition[]}
      searchPlaceholder="搜索 Pipeline ID、触发人..."
      extra={
        <RangePicker
          value={dateRange}
          onChange={(dates) =>
            setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)
          }
          placeholder={['开始日期', '结束日期']}
          style={{ minWidth: 240 }}
        />
      }
    />
  </div>
);
