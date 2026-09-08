import { Space, Select, Button } from 'antd';
import { RadarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { POLLING_INTERVAL_MS, dayRangeOptions } from '../constants';

interface Props {
  loading: boolean;
  isPolling: boolean;
  days: number;
  setDays: (v: number) => void;
  handleRefresh: () => void;
}

export function PageHeader({ loading, isPolling, days, setDays, handleRefresh }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: spacing.md,
      }}
    >
      <div>
        <h2
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: 4,
            fontSize: 20,
            fontWeight: 600,
            color: colors.neutral[900],
          }}
        >
          <RadarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          运行监控
        </h2>
        {/* 实时监控指示器 */}
        {isPolling && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginTop: 4,
              fontSize: 12,
              color: colors.success[500],
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: colors.success[500],
                marginRight: 6,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
            实时监控中
            <span style={{ marginLeft: 4, color: colors.neutral[500] }}>
              (每 {POLLING_INTERVAL_MS / 1000}s 刷新)
            </span>
          </div>
        )}
      </div>
      <Space>
        <Select value={days} onChange={setDays} style={{ width: 120 }} options={dayRangeOptions} />
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
          刷新
        </Button>
      </Space>
    </div>
  );
}
