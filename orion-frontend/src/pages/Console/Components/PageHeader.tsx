/**
 * Console PageHeader
 * 抽取自 index.tsx (P2-9 Phase 196)
 */
import { Button, Typography } from 'antd';
import { ControlOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: PageHeaderProps) => (
  <div
    style={{
      marginBottom: spacing.lg,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <ControlOutlined style={{ marginRight: spacing[3], color: colors.purple[500] }} />
        系统控制台
      </Title>
      <Text type="secondary">管理系统插件、配置和功能开关</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
