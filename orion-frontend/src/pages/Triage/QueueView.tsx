import React, { useMemo } from 'react';
import { Card, List, Space, Input, Select, Pagination, Empty, Spin } from 'antd';
import type { TriageItem, TimeRange } from '../../api/triage';
import { TriageItemRow } from '../../components/triage/TriageItemRow';
import { BulkActionBar } from '../../components/triage/BulkActionBar';
import { TimeRangeSelector } from '../../components/triage/TimeRangeSelector';

interface Props {
  items: TriageItem[];
  loading: boolean;
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
  onPageChange: (p: number) => void;
  onAction: (item: TriageItem, action: 'acknowledge' | 'assign') => void;
  onBatchAcknowledge: (items: TriageItem[]) => void;
  onBatchAssign: (items: TriageItem[]) => void;
}

export const QueueView: React.FC<Props> = ({
  items,
  loading,
  page,
  pageSize,
  total,
  hasMore,
  onPageChange,
  onAction,
  onBatchAcknowledge,
  onBatchAssign,
}) => {
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [range, setRange] = React.useState<TimeRange>('24h');

  const selectedItems = useMemo(
    () => items.filter((it) => selectedIds.includes(it.id)),
    [items, selectedIds],
  );

  return (
    <Card size="small" className="orion-card">
      <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between' }}>
        <Space>
          <Input.Search
            placeholder="搜索标题/ID..."
            allowClear
            aria-label="搜索 Triage 项目"
            style={{ width: 240 }}
          />
          <Select
            placeholder="严重度"
            allowClear
            aria-label="按严重度过滤"
            options={[
              { value: 'critical', label: '严重' },
              { value: 'warning', label: '警告' },
              { value: 'info', label: '信息' },
            ]}
            style={{ width: 120 }}
          />
          <Select
            placeholder="状态"
            allowClear
            aria-label="按状态过滤"
            options={[
              { value: 'open', label: '待处理' },
              { value: 'acknowledged', label: '已确认' },
              { value: 'assigned', label: '已分配' },
              { value: 'in_progress', label: '处理中' },
              { value: 'resolved', label: '已解决' },
            ]}
            style={{ width: 120 }}
          />
        </Space>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      <BulkActionBar
        selectedCount={selectedIds.length}
        onAcknowledge={() => onBatchAcknowledge(selectedItems)}
        onAssign={() => onBatchAssign(selectedItems)}
        onClear={() => setSelectedIds([])}
      />

      <Spin spinning={loading}>
        {items.length === 0 ? (
          <Empty description="暂无待处理项" />
        ) : (
          <List
            dataSource={items}
            renderItem={(item) => (
              <div
                key={item.id}
                style={{ display: 'flex', gap: 8, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  aria-label={`选择 ${item.title}`}
                  checked={selectedIds.includes(item.id)}
                  onChange={(e) => {
                    const ids = e.target.checked
                      ? [...selectedIds, item.id]
                      : selectedIds.filter((id) => id !== item.id);
                    setSelectedIds(ids);
                  }}
                />
                <div style={{ flex: 1 }}>
                  <TriageItemRow item={item} onAction={onAction} />
                </div>
              </div>
            )}
          />
        )}
      </Spin>

      <div style={{ marginTop: 12, textAlign: 'right' }}>
        <Pagination
          current={page}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showQuickJumper
          onChange={onPageChange}
          aria-label="分页"
        />
      </div>
    </Card>
  );
};

export default QueueView;
