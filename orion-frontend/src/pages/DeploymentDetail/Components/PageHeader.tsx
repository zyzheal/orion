/**
 * DeploymentDetail PageHeader
 * 抽取自 index.tsx (P2-9 Phase 168)
 */
import { Button, Space, Typography } from 'antd';
import { ArrowLeftOutlined, RollbackOutlined, RocketOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';
import type { Deployment } from '@/api/deployments';
import { envConfig } from '../constants';

const { Title, Text } = Typography;

interface PageHeaderProps {
  deployment: Deployment;
  canRollback: boolean;
  isRollingBack: boolean;
  onOpenRollback: () => void;
}

const statusBadgeMap = (status: string): 'success' | 'running' | 'failed' | 'pending' | 'cancelled' | 'unknown' => {
  if (status === 'success') return 'success';
  if (status === 'running') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'pending') return 'pending';
  if (status === 'cancelled') return 'cancelled';
  return 'unknown';
};

export const PageHeader = ({
  deployment,
  canRollback,
  isRollingBack,
  onOpenRollback,
}: PageHeaderProps) => {
  const navigate = useNavigate();
  const env = envConfig[deployment.environment] || {
    color: 'default',
    label: deployment.environment,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        marginBottom: spacing.lg,
      }}
    >
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/deployments')}>
        返回列表
      </Button>
      <div style={{ flex: 1 }}>
        <Title level={2} style={{ marginBottom: spacing.sm }}>
          <RocketOutlined style={{ marginRight: spacing[2], color: colors.primary[500] }} />
          部署详情: {deployment.appName}
        </Title>
        <Text type="secondary">
          版本 {deployment.version} · 部署于 {env.label}
        </Text>
      </div>
      <Space>
        <StatusBadge status={statusBadgeMap(deployment.status as string)} size="medium" />
        {canRollback && (
          <Button
            danger
            icon={<RollbackOutlined />}
            onClick={onOpenRollback}
            loading={isRollingBack}
          >
            回滚到此版本
          </Button>
        )}
      </Space>
    </div>
  );
};
