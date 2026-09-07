/**
 * DeploymentDetail health check panel
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { Space, Tag, Typography } from 'antd';
import { spacing } from '@/tokens';
import CardPanel from '@/components/CardPanel';
import type { HealthCheckResult } from '@/api/deployments';
import { healthCheckIcon } from '../constants';

const { Text } = Typography;

interface HealthCheckPanelProps {
  healthChecks: HealthCheckResult[];
}

const healthBg = (status: string) => {
  if (status === 'healthy') return 'rgba(82, 196, 26, 0.04)';
  if (status === 'unhealthy') return 'rgba(245, 34, 45, 0.04)';
  return 'rgba(250, 173, 20, 0.04)';
};

export const HealthCheckPanel = ({ healthChecks }: HealthCheckPanelProps) => (
  <CardPanel title="健康检查">
    <Space direction="vertical" style={{ width: '100%' }} size={12}>
      {healthChecks && healthChecks.length > 0 ? (
        healthChecks.map((check) => (
          <div
            key={check.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: spacing[3],
              padding: '12px 16px',
              background: healthBg(check.status),
              borderRadius: 6,
            }}
          >
            <span style={{ fontSize: spacing[5] }}>{healthCheckIcon[check.status]}</span>
            <div style={{ flex: 1 }}>
              <Text strong style={{ fontSize: spacing[4] }}>
                {check.name}
              </Text>
              {check.message && (
                <div>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    {check.message}
                  </Text>
                </div>
              )}
            </div>
            {check.latency !== undefined && (
              <Tag
                color={
                  check.latency < 50 ? 'green' : check.latency < 200 ? 'orange' : 'red'
                }
              >
                {check.latency}ms
              </Tag>
            )}
          </div>
        ))
      ) : (
        <Text type="secondary">暂无健康检查数据</Text>
      )}
    </Space>
  </CardPanel>
);
