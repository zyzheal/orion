/**
 * AlertsCard.tsx - 异常告警卡片 (含时间筛选)
 * 抽取自 index.tsx (P2-9 Phase 242)
 */
import { Card, Table, Button, Space, Select } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { AnomalyAlert } from '@/api/ueba';
import { alertColumns } from '../Columns';

interface Props {
  alerts: AnomalyAlert[];
  loading: boolean;
  hours: number;
  setHours: (v: number) => void;
  onRefresh: () => void;
}

export function AlertsCard({ alerts, loading, hours, setHours, onRefresh }: Props) {
  return (
    <Card
      title="异常告警"
      extra={
        <Space>
          <Select value={hours} onChange={setHours} style={{ width: 100 }}>
            <Select.Option value={6}>6小时</Select.Option>
            <Select.Option value={24}>24小时</Select.Option>
            <Select.Option value={72}>3天</Select.Option>
            <Select.Option value={168}>7天</Select.Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={onRefresh}>
            刷新
          </Button>
        </Space>
      }
      style={{ marginBottom: spacing.md }}
    >
      <Table
        dataSource={alerts}
        columns={alertColumns}
        rowKey="timestamp"
        pagination={false}
        loading={loading}
        size="small"
      />
    </Card>
  );
}
