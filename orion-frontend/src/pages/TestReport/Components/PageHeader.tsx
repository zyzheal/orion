/**
 * TestReport PageHeader
 * 抽取自 index.tsx (P2-9 Phase 167)
 */
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined, FileSearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { colors, spacing } from '@/tokens';

const { Title: TTitle, Text: TText } = Typography;

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
      <div style={{ flex: 1 }}>
        <TTitle level={2} style={{ marginBottom: spacing.sm }}>
          <FileSearchOutlined
            style={{ marginRight: spacing[3], color: colors.primary[500] }}
          />
          测试报告
        </TTitle>
        <TText type="secondary">Run: {runId}</TText>
      </div>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
    </div>
  );
};
