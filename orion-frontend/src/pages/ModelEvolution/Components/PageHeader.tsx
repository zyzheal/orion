/**
 * ModelEvolution PageHeader
 * 抽取自 index.tsx (P2-9 Phase 199)
 */
import { Button, Typography } from 'antd';
import { ReloadOutlined, RocketOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: PageHeaderProps) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.md,
    }}
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RocketOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        AI 模型技术演进
      </Title>
      <Text type="secondary">模型能力矩阵、版本对比、采用率与灰度状态（A7）</Text>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
