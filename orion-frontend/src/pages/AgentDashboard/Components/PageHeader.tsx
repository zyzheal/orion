/**
 * AgentDashboard PageHeader
 * 抽取自 index.tsx (P2-9 Phase 205)
 */
import { Button, Space, Typography } from 'antd';
import {
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

interface Props {
  agentCount: number;
  approvalCount: number;
  loading: boolean;
  onRefresh: () => void;
  onTrigger: () => void;
  onCreate: () => void;
}

export const PageHeader = ({
  agentCount,
  approvalCount,
  loading,
  onRefresh,
  onTrigger,
  onCreate,
}: Props) => (
  <div
    style={ {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    } }
  >
    <div>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <RobotOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        AI Agent 编排
      </Title>
      <Text type="secondary">
        共 {agentCount} 个 Agent · {approvalCount} 个待审批
      </Text>
    </div>
    <Space>
      <Button icon={<ReloadOutlined />} onClick={onRefresh} loading={loading}>
        刷新
      </Button>
      <Button icon={<PlayCircleOutlined />} onClick={onTrigger} data-testid="trigger-run-button">
        触发运行
      </Button>
      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={onCreate}
        data-testid="create-agent-button"
      >
        创建 Agent
      </Button>
    </Space>
  </div>
);
