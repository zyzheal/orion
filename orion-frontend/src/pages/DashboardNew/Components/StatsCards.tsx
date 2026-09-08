import { Row, Col } from 'antd';
import { StatCard } from '@/components/charts';
import { spacing } from '@/tokens';

interface Props {
  pipelineStats: { total: number; running: number; success: number; failed: number };
  taskStats: { todo: number };
}

export function StatsCards({ pipelineStats, taskStats }: Props) {
  return (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} lg={6}>
        <StatCard
          title="Pipeline 总数"
          value={pipelineStats.total}
          trend={{ value: 0, direction: 'up', good: 'up' }}
        />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="运行中" value={pipelineStats.running} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="成功" value={pipelineStats.success} />
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <StatCard title="待处理任务" value={taskStats.todo} />
      </Col>
    </Row>
  );
}
