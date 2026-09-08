/**
 * PageHeader - Pipeline 实时执行页头
 * 抽取自 index.tsx (P2-9 Phase 211)
 */
import { Typography, Button, Space, Badge } from 'antd';
import { CloudUploadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge from '@/components/StatusBadge';

const { Title, Text } = Typography;

interface Props {
  pipelineName: string;
  runId: string | undefined;
  id: string | undefined;
  isConnected: boolean;
  error: Error | null;
  pipelineStatus?: import('@/components/StatusBadge').StatusType;
  onBack: () => void;
}

export const PageHeader = ({
  pipelineName,
  runId,
  id,
  isConnected,
  error,
  pipelineStatus,
  onBack,
}: Props) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: spacing.lg,
    }}
  >
    <div>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <CloudUploadOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        {pipelineName} 实时执行
      </Title>
      <Space size="middle" wrap>
        <Text type="secondary">运行 #{runId || id}</Text>
        <Badge
          status={isConnected ? 'success' : 'error'}
          text={isConnected ? 'SSE 已连接' : 'SSE 未连接'}
        />
        {error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            连接错误: {error.message}
          </Text>
        )}
        {pipelineStatus && <StatusBadge status={pipelineStatus} size="small" />}
      </Space>
    </div>
    <Space>
      <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
        返回列表
      </Button>
    </Space>
  </div>
);
