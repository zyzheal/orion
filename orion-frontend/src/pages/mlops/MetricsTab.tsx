/**
 * MLOps Overview Tab - metrics dashboard
 */
import React, { useEffect, useState } from 'react';
import { Button, Card, Col, Empty, Row, Statistic, Typography, message } from 'antd';
import { BarChartOutlined, ReloadOutlined } from '@ant-design/icons';
import { getMLOpsMetrics, type MLOpsMetrics } from '@/api/mlops';
import { colors, spacing } from '@/tokens';
import { headerRowStyle, sectionTitleStyle } from './config';

const { Title, Text } = Typography;

interface MetricCardProps {
  title: string;
  value: number;
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, color }) => (
  <Card>
    <Statistic
      title={title}
      value={value}
      valueStyle={color ? { color } : undefined}
    />
  </Card>
);

export const MetricsTab: React.FC = () => {
  const [metrics, setMetrics] = useState<MLOpsMetrics | null>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getMLOpsMetrics();
      setMetrics((res.data as { data?: MLOpsMetrics })?.data ?? null);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载 MLOps 指标失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!metrics) {
    return <Empty description="暂无 MLOps 指标数据" />;
  }

  return (
    <div>
      <div style={headerRowStyle}>
        <div>
          <Title level={3} style={sectionTitleStyle}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            MLOps 概览
          </Title>
          <Text type="secondary">实验、模型和训练任务的汇总指标</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          刷新
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <MetricCard title="总实验数" value={metrics.totalExperiments} />
        </Col>
        <Col span={6}>
          <MetricCard
            title="运行中实验"
            value={metrics.runningExperiments}
            color={colors.primary[500]}
          />
        </Col>
        <Col span={6}>
          <MetricCard title="总模型数" value={metrics.totalModels} />
        </Col>
        <Col span={6}>
          <MetricCard
            title="生产中模型"
            value={metrics.productionModels}
            color={colors.success[500]}
          />
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <MetricCard title="训练任务总数" value={metrics.totalJobs} />
        </Col>
        <Col span={6}>
          <MetricCard
            title="运行中任务"
            value={metrics.runningJobs}
            color={colors.primary[500]}
          />
        </Col>
        <Col span={6}>
          <MetricCard
            title="失败实验"
            value={metrics.failedExperiments}
            color={colors.error[500]}
          />
        </Col>
        <Col span={6}>
          <MetricCard title="失败任务" value={metrics.failedJobs} color={colors.error[500]} />
        </Col>
      </Row>
    </div>
  );
};
