import { Row, Col } from 'antd';
import { colors, spacing } from '@/tokens';
import { SuccessRateChart } from '../SuccessRateChart';
import { DurationDistribution } from '../DurationDistribution';
import { TopSlowRuns } from '../TopSlowRuns';
import { BottleneckTable } from '../BottleneckTable';
import type { PipelineRunAnalyticsState } from '../usePipelineRunAnalyticsState';

interface Props {
  state: PipelineRunAnalyticsState;
}

export function AnalyticsPanels({ state: s }: Props) {
  return (
    <>
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={8}>
          <SuccessRateChart stats={s.stats} status={s.successRateProgress.status} />
        </Col>
        <Col span={8}>
          <DurationDistribution buckets={s.durationBuckets} successCount={s.stats.success} />
        </Col>
        <Col span={8}>
          <TopSlowRuns topSlow={s.topSlow} pipelines={s.pipelines} stats={s.stats} />
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        <Col span={24}>
          <BottleneckTable bottlenecks={s.bottlenecks} runs={s.runs} />
        </Col>
      </Row>
    </>
  );
}
