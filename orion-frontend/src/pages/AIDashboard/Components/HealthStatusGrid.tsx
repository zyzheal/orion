/**
 * HealthStatusGrid.tsx - 场景健康状态网格
 * 抽取自 index.tsx (P2-9 Phase 224)
 */
import { Card, Col, Row, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import type { AIGatewayHealth } from '@/api/ai-gateway';

const { Title, Text } = Typography;

const STATE_ICONS: Record<string, React.ReactNode> = {
  CLOSED: <CheckCircleOutlined style={{ color: colors.success[500] }} />,
  OPEN: <CloseCircleOutlined style={{ color: colors.error[500] }} />,
  HALF_OPEN: <WarningOutlined style={{ color: colors.warning[500] }} />,
};

interface Props {
  healthData: AIGatewayHealth[];
}

export const HealthStatusGrid = ({ healthData }: Props) => {
  if (healthData.length === 0) return null;

  return (
    <>
      <Title level={3} style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
        场景健康状态
      </Title>
      <Row gutter={[16, 16]}>
        {healthData.map((h) => (
          <Col key={h.scenario} xs={24} sm={12} md={8} lg={6}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }} >
                <Space>
                  {STATE_ICONS[h.circuitState] || <WarningOutlined />}
                  <Text strong>{h.scenario}</Text>
                </Space>
                <Space>
                  <Tag color={h.isHealthy ? 'green' : 'red'}>
                    {h.isHealthy ? '健康' : '异常'}
                  </Tag>
                  <Tag>{h.circuitState}</Tag>
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  请求: {h.metrics?.totalRequests || 0} | 延迟:{' '}
                  {Math.round(h.metrics?.avgLatency || 0)}ms
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
};
