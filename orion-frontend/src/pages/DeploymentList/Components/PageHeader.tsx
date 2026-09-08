/**
 * DeploymentList PageHeader
 * 抽取自 index.tsx (P2-9 Phase 198)
 */
import { Button, Typography } from 'antd';
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  totalCount: number;
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ totalCount, loading, onRefresh }: PageHeaderProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RocketOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        部署管理
      </Title>
      <Text type="secondary">共 {totalCount} 条部署记录</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
