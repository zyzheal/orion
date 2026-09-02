/**
 * Requests Tab — filter bar + change requests table
 *
 * Extracted from index.tsx tabItems array.
 */
import { Card, Space, Select, Button } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { spacing, radius, shadows } from '@/tokens';
import { statusConfig, typeConfig, priorityConfig } from './config';
import Table from '@/components/Table';
import type { ChangeRequest } from '@/api/change';

interface RequestsTabProps {
  changes: ChangeRequest[];
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  filterStatus: string | undefined;
  filterType: string | undefined;
  filterPriority: string | undefined;
  changeColumns: any[];
  onFilterStatusChange: (v: string | null) => void;
  onFilterTypeChange: (v: string | null) => void;
  onFilterPriorityChange: (v: string | null) => void;
  onRefresh: () => void;
  onCreate: () => void;
  onPageChange: (p: number, ps: number) => void;
}

export function RequestsTab({
  changes,
  loading,
  total,
  page,
  pageSize,
  filterStatus,
  filterType,
  filterPriority,
  changeColumns,
  onFilterStatusChange,
  onFilterTypeChange,
  onFilterPriorityChange,
  onRefresh,
  onCreate,
  onPageChange,
}: RequestsTabProps) {
  return (
    <>
      <Card
        size="small"
        style={{
          marginBottom: spacing.md,
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        <Space size="middle" wrap>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 130 }}
            value={filterStatus}
            onChange={(v) => onFilterStatusChange(v)}
          >
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <Select.Option key={key} value={key}>
                {cfg.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="类型筛选"
            allowClear
            style={{ width: 120 }}
            value={filterType}
            onChange={(v) => onFilterTypeChange(v)}
          >
            {Object.entries(typeConfig).map(([key, cfg]) => (
              <Select.Option key={key} value={key}>
                {cfg.label}
              </Select.Option>
            ))}
          </Select>
          <Select
            placeholder="优先级筛选"
            allowClear
            style={{ width: 120 }}
            value={filterPriority}
            onChange={(v) => onFilterPriorityChange(v)}
          >
            {Object.entries(priorityConfig).map(([key, cfg]) => (
              <Select.Option key={key} value={key}>
                {cfg.label}
              </Select.Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
            新建变更
          </Button>
        </Space>
      </Card>

      <Card
        style={{
          borderRadius: radius.lg,
          boxShadow: shadows.card,
        }}
      >
        <Table<ChangeRequest>
          columns={changeColumns}
          dataSource={changes}
          loading={loading}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
          }}
          onPaginationChange={onPageChange}
        />
      </Card>
    </>
  );
}
