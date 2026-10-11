import React from 'react';
import { Row, Col, Card, Statistic, Skeleton } from 'antd';
import type { MyOverview } from '../../api/triage';
import { OnCallStatusCard } from '../../components/triage/OnCallStatusCard';
import { SeveritySourceMatrix } from '../../components/triage/SeveritySourceMatrix';
import { RecentActivityFeed } from '../../components/triage/RecentActivityFeed';

interface Props {
  overview: MyOverview | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export const OverviewView: React.FC<Props> = ({ overview, loading, error, onRefresh }) => {
  if (loading && !overview) {
    // S1-17: loading 骨架屏标记 aria-busy，屏幕阅读器可跳过
    return (
      <div role="status" aria-busy="true" aria-live="polite">
        <Skeleton active />
      </div>
    );
  }
  if (error) {
    return (
      <Card aria-label="加载失败">
        {/* S1-17: 错误态用 aria-live="assertive"，打断式播报 */}
        <div role="alert" aria-live="assertive">加载失败: {error}</div>
        <button type="button" onClick={onRefresh} aria-label="重试加载 Triage 数据" tabIndex={0}>
          重试
        </button>
      </Card>
    );
  }
  if (!overview) return null;

  return (
    <div role="region" aria-label="Triage 总览">
      <Row gutter={[16, 16]}>
        <Col span={8}>
          <OnCallStatusCard info={overview.me} onHandoff={onRefresh} />
        </Col>
        <Col span={16}>
          <Card size="small" className="orion-card" aria-label="关键指标">
            <Row gutter={16} aria-live="polite" aria-atomic="true">
              <Col span={8}>
                <Statistic title="我负责的" value={overview.assigned_to_me} />
              </Col>
              <Col span={8}>
                <Statistic title="团队未处理" value={overview.team_open} />
              </Col>
              <Col span={8}>
                <Statistic title="最近生成" value={new Date(overview.generated_at).toLocaleTimeString()} />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={24}>
          <SeveritySourceMatrix
            openBySeverity={overview.open_by_severity}
            openByStatus={overview.open_by_status}
          />
        </Col>
        <Col span={24}>
          <RecentActivityFeed items={overview.recent_activity ?? []} />
        </Col>
      </Row>
    </div>
  );
};

export default OverviewView;
