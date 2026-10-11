/**
 * ServiceCatalog BreachTab
 * 抽取自 index.tsx (P2-9 Phase 189)
 */
import { Button, Card, Empty, Table } from 'antd';
import { BellOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SLABreach } from '@/api/service-catalog';
import { buildBreachColumns } from '../columns';

interface BreachTabProps {
  breaches: SLABreach[];
  onRefresh: () => void;
}

export const BreachTab = ({ breaches, onRefresh }: BreachTabProps) => (
  <Card
    title={
      <>
        <BellOutlined /> SLA 违约记录
      </>
    }
    role="region"
    aria-label="SLA 违约记录"
    extra={
      <Button
        icon={<ReloadOutlined />}
        size="small"
        onClick={onRefresh}
        aria-label="刷新 SLA 违约记录"
        tabIndex={0}
      >
        刷新
      </Button>
    }
  >
    {breaches.length === 0 ? (
      <div role="status" aria-live="polite" aria-atomic="true">
        <Empty description="暂无 SLA 违约记录" />
      </div>
    ) : (
      <div role="list" aria-label="SLA 违约列表" aria-live="polite" aria-atomic="false">
        <Table
          columns={buildBreachColumns()}
          dataSource={breaches}
          rowKey="requestId"
          size="small"
          pagination={{ pageSize: 10 }}
        />
      </div>
    )}
  </Card>
);
