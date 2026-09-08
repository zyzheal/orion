/**
 * ModelEvolution InfoRow
 * 能力分布 + 总请求数 + 版本趋势
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
import { Card, Col, Row, Space, Statistic, Tag, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import { CAPABILITY_COLORS, CAPABILITY_LABEL } from '../constants';
import type { ModelEntry } from '../types';

const { Text } = Typography;

interface InfoRowProps {
  models: ModelEntry[];
  totalRequests: number;
}

export const InfoRow = ({ models, totalRequests }: InfoRowProps) => (
  <Row gutter={spacing.md} style={{ marginTop: spacing.md }}>
    <Col span={8}>
      <Card size="small" title="能力分布">
        <Space direction="vertical">
          {Object.entries(CAPABILITY_LABEL).map(([key, label]) => {
            const count = models.filter((m) => m.capability === key).length;
            return (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Tag color={CAPABILITY_COLORS[key]}>{label}</Tag>
                <Text strong>{count}</Text>
              </div>
            );
          })}
        </Space>
      </Card>
    </Col>
    <Col span={8}>
      <Card size="small" title="总请求数">
        <Statistic value={totalRequests} valueStyle={{ color: colors.purple[500] }} />
      </Card>
    </Col>
    <Col span={8}>
      <Card size="small" title="版本趋势">
        <Space direction="vertical" size={4}>
          <Text type="secondary">模型版本管理、灰度策略与回滚能力</Text>
          <Tag color="blue">v1.0 稳定</Tag>
          <Tag color="orange">v2.0 灰度 10%</Tag>
          <Tag color="red">v3.0 实验</Tag>
        </Space>
      </Card>
    </Col>
  </Row>
);
