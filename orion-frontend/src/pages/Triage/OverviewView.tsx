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
    return <Skeleton active />;
  }
  if (error) {
    return (
      <Card>
        <div role="alert">加载失败: {error}</div>
        <button onClick={onRefresh}>重试</button>
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
          <Card size="small" className="orion-card">
            <Row gutter={16}>
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
