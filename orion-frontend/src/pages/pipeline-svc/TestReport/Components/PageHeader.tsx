/**
 * TestReport PageHeader
 * 抽取自 index.tsx (P2-9 Phase 191)
 */
import { Button, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, ExperimentOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface PageHeaderProps {
  runId?: string;
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ runId, loading, onRefresh }: PageHeaderProps) => {
  const navigate = useNavigate();
  return (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg }}
    >
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
        返回
      </Button>
      <div style={{ flex: 1 }} />
      <div style={{ flex: 1 }}>
        <Title
          level={2}
          style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
        >
          <ExperimentOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          测试报告
        </Title>
        <Text type="secondary">Run: {runId}</Text>
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </div>
  );
};
