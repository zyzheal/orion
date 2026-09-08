/**
 * PageHeader - AI Agent 管理页头
 * 抽取自 index.tsx (P2-9 Phase 207)
 */
import { Typography, Button } from 'antd';
import { RobotOutlined, ReloadOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Paragraph } = Typography;

interface Props {
  loading: boolean;
  onRefresh: () => void;
}

export const PageHeader = ({ loading, onRefresh }: Props) => (
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
        <RobotOutlined style={{ marginRight: spacing.sm, color: colors.purple[500] }} />
        AI Agent 管理
      </Title>
      <Paragraph type="secondary">管理 AI Agent 配置、执行任务、查看审计日志</Paragraph>
    </div>
    <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
      刷新
    </Button>
  </div>
);
