/**
 * PageHeader - APM Service Topology 页头
 * 抽取自 index.tsx (P2-9 Phase 218)
 */
import { Button, Typography } from 'antd';
import { DeploymentUnitOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: Props) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.lg }}>
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <DeploymentUnitOutlined
          style={{ marginRight: spacing[3], color: colors.primary[500] }}
        />
        服务依赖拓扑
      </Title>
      <Text type="secondary" style={{ color: colors.neutral[500], fontSize: 14 }}>
        服务间调用关系与依赖拓扑可视化
      </Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
