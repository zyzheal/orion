/**
 * Executive Dashboard error/empty states
 * 抽取自 index.tsx (P2-9 Phase 158)
 */
import { Button, Card, Empty, Result } from 'antd';
import { SyncOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

interface EmptyStateProps {
  onRetry: () => void;
}

export const EmptyState = ({ onRetry }: EmptyStateProps) => (
  <div style={{ padding: 0 }}>
    <Result
      status="info"
      title="暂无数据"
      subTitle={
        <div>
          <div>效能仪表盘 API 尚未返回数据。</div>
          <div style={{ marginTop: spacing.sm, fontSize: 12, color: colors.neutral[500] }}>
            请确认后端 <code>orion-ticket-svc</code> 服务已正确部署并返回数据。
          </div>
        </div>
      }
      extra={
        <Button type="primary" icon=<SyncOutlined /> onClick={onRetry}>
          刷新页面
        </Button>
      }
    />
  </div>
);

export const ErrorState = ({ onRetry }: EmptyStateProps) => (
  <div style={{ padding: 0 }}>
    <Result
      status="warning"
      title="数据加载失败"
      subTitle={
        <div>
          <div>
            效能仪表盘依赖后端 <code>orion-ticket-svc</code> 微服务，该服务当前未部署或未启动。
          </div>
          <div style={{ marginTop: spacing.sm, fontSize: 12, color: colors.neutral[500] }}>
            请确认后端服务已启动后刷新页面，或联系运维人员检查服务状态。
          </div>
        </div>
      }
      extra={
        <Button type="primary" icon=<SyncOutlined /> onClick={onRetry}>
          刷新页面
        </Button>
      }
    />
    <Card title="工单量趋势（近14天）" style={{ marginTop: spacing.md }}>
      <Empty description="暂无趋势数据" />
    </Card>
  </div>
);
