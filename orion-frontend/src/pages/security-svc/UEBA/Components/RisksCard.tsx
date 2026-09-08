/**
 * RisksCard.tsx - 高风险用户卡片
 * 抽取自 index.tsx (P2-9 Phase 242)
 */
import { Card, Table, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import type { UEBAStats } from '@/api/ueba';
import { riskColumns } from '../Columns';

interface Props {
  risks: UEBAStats[];
  loading: boolean;
  onRefresh: () => void;
}

export function RisksCard({ risks, loading, onRefresh }: Props) {
  return (
    <Card
      title="高风险用户"
      extra={
        <Button icon={<ReloadOutlined />} onClick={onRefresh}>
          刷新
        </Button>
      }
    >
      <Table
        dataSource={risks}
        columns={riskColumns}
        rowKey="userId"
        pagination={{ pageSize: 10 }}
        loading={loading}
      />
    </Card>
  );
}
