/**
 * Serverless Page - MetricsTab
 * 从 ServerlessPage.tsx 抽出的 MetricsTab tab。
 */
import React, { useEffect } from 'react';
import { Typography, Table, Button, message, Card, Row, Col, Statistic, Empty } from 'antd';
import { ReloadOutlined, BarChartOutlined } from '@ant-design/icons';
import { getAggregateMetrics, getAutoScalingRecommendations, type AutoScalingRecommendation, type AggregateMetrics } from '@/api/serverless';
import { useQuery } from '@/providers/QueryProvider';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { autoscalingColumns } from './ServerlessColumns';

const { Title, Text } = Typography;


export const MetricsTab: React.FC = () => {
  const {
    data,
    isLoading: loading,
    isError,
    error,
    refetch: loadData,
  } = useQuery<{ aggregate: AggregateMetrics | null; recommendations: AutoScalingRecommendation[] }>({
    queryKey: ['serverless-metrics'],
    queryFn: async () => {
      const [aggRes, scaleRes] = await Promise.all([
        getAggregateMetrics(),
        getAutoScalingRecommendations(),
      ]);
      return {
        aggregate: (aggRes.data as { data?: AggregateMetrics })?.data ?? null,
        recommendations: (scaleRes.data as { data?: AutoScalingRecommendation[] })?.data ?? [],
      };
    },
    staleTime: 30_000,
  });

  const aggregate = data?.aggregate ?? null;
  const recommendations = data?.recommendations ?? [];

  // 加载失败反馈：本仓库锁定的 react-query 构建不触发 useQuery 的 onError 选项
  // （QueryObserver 未实现 observer 级回调），统一用 isError + useEffect 呈现。
  useEffect(() => {
    if (!isError) return;
    message.error(error instanceof Error ? error.message : '加载指标失败');
  }, [isError, error]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <div>
          <Title level={3} style={{ marginBottom: spacing.sm }}>
            <BarChartOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Serverless 指标
          </Title>
          <Text type="secondary">函数运行指标、错误率与自动扩缩容建议</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => loadData()} loading={loading}>
          刷新
        </Button>
      </div>

      {aggregate && (
        <Row gutter={16} style={{ marginBottom: spacing.md }}>
          <Col span={4}>
            <Card>
              <Statistic title="函数总数" value={aggregate.totalFunctions} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="已部署"
                value={aggregate.deployedFunctions}
                valueStyle={{ color: colors.success[500] }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="总调用" value={aggregate.totalInvocations} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="错误数"
                value={aggregate.totalErrors}
                valueStyle={{
                  color: aggregate.totalErrors > 0 ? colors.error[500] : colors.success[500],
                }}
              />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic title="平均耗时" value={`${aggregate.avgDuration}ms`} />
            </Card>
          </Col>
          <Col span={4}>
            <Card>
              <Statistic
                title="错误率"
                value={`${aggregate.errorRate}%`}
                valueStyle={{
                  color: aggregate.errorRate > 1 ? colors.error[500] : colors.success[500],
                }}
              />
            </Card>
          </Col>
        </Row>
      )}

      <Card title="自动扩缩容建议">
        <Table
          columns={autoscalingColumns}
          dataSource={recommendations}
          rowKey="functionId"
          loading={loading}
          pagination={false}
          size="small"
          locale={{
            emptyText: <Empty description="无扩缩容建议" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
          }}
        />
      </Card>
    </div>
  );
};
