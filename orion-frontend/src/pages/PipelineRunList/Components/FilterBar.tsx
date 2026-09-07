/**
 * PipelineRunList FilterBar
 * 抽取自 index.tsx (P2-9 Phase 180)
 */
import React, { useMemo } from 'react';
import { DatePicker } from 'antd';
import { spacing } from '@/tokens';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { STATUS_FILTER_OPTIONS } from '../constants';
import dayjs from 'dayjs';

const { RangePicker } = DatePicker;

interface FilterBarProps {
  onSearch: (v: string) => void;
  onFilter: (v: Record<string, string | string[] | undefined>) => void;
  dateRange: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null;
  setDateRange: (v: [dayjs.Dayjs | null, dayjs.Dayjs | null] | null) => void;
}

export const FilterBar = ({ onSearch, onFilter, dateRange, setDateRange }: FilterBarProps) => {
  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [{ key: 'status', label: '状态', options: STATUS_FILTER_OPTIONS }],
    []
  );

  return (
    <div style={{ marginBottom: spacing.md }}>
      <SearchFilterBar
        onSearch={onSearch}
        onFilter={onFilter}
        filters={filterDefs}
        searchPlaceholder="搜索 Pipeline ID、触发人..."
        extra={
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null] | null)}
            placeholder={['开始日期', '结束日期']}
            style={{ minWidth: 240 }}
          />
        }
      />
    </div>
  );
};
