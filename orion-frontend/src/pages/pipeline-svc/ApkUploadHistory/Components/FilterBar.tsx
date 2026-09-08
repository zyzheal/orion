/**
 * FilterBar - 筛选市场 / 状态 / 刷新
 * 抽取自 index.tsx (P2-9 Phase 215)
 */
import { Card, Space, Select, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { MARKET_NAMES, STATUS_CONFIG, type ApkUploadStatus } from '@/api/apk-upload-history';

interface Props {
  filters: { market?: string; status?: ApkUploadStatus };
  onFiltersChange: (v: { market?: string; status?: ApkUploadStatus }) => void;
  onRefresh: () => void;
}

export const FilterBar = ({ filters, onFiltersChange, onRefresh }: Props) => (
  <Card style={{ marginBottom: spacing.md }}>
    <Space>
      <Select
        placeholder="筛选市场"
        allowClear
        style={{ width: 180 }}
        value={filters.market}
        onChange={(value) => onFiltersChange({ ...filters, market: value })}
        options={Object.entries(MARKET_NAMES).map(([value, label]) => ({
          value,
          label,
        }))}
      />
      <Select
        placeholder="筛选状态"
        allowClear
        style={{ width: 120 }}
        value={filters.status}
        onChange={(value) => onFiltersChange({ ...filters, status: value as ApkUploadStatus })}
        options={Object.entries(STATUS_CONFIG).map(([value, config]) => ({
          value,
          label: config.text,
        }))}
      />
      <Button icon={<ReloadOutlined />} onClick={onRefresh}>
        刷新
      </Button>
    </Space>
  </Card>
);
