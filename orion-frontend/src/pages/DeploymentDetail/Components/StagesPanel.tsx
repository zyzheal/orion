/**
 * DeploymentDetail stage progress panel
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { Card, Space, Typography } from 'antd';
import { colors, spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import StatusBadge from '@/components/StatusBadge';
import type { Deployment } from '@/api/deployments';
import { stageStatusColor } from '../constants';

const { Text } = Typography;

interface StagesPanelProps {
  stages: Deployment['stages'];
}

const stageBadge = (s: string): 'success' | 'running' | 'failed' | 'pending' | 'cancelled' | 'unknown' => {
  if (s === 'success') return 'success';
  if (s === 'running') return 'running';
  if (s === 'failed') return 'failed';
  if (s === 'pending') return 'pending';
  if (s === 'cancelled') return 'cancelled';
  return 'unknown';
};

export const StagesPanel = ({ stages }: StagesPanelProps) => (
  <CardPanel title="部署阶段">
    {stages && stages.length > 0 ? (
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {stages.map((stage, index) => (
          <Card
            key={stage.id || stage.name}
            size="small"
            style={{
              borderLeft: `4px solid ${stageStatusColor[stage.status] || colors.neutral[300]}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Space>
                <Text strong style={{ fontSize: spacing[4] }}>
                  {index + 1}. {stage.name}
                </Text>
              </Space>
              <Space>
                {stage.details && (
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {stage.details}
                  </Text>
                )}
                <StatusBadge status={stageBadge(stage.status)} size="small" />
              </Space>
            </div>
          </Card>
        ))}
      </Space>
    ) : (
      <Text type="secondary">暂无阶段数据</Text>
    )}
  </CardPanel>
);
