/**
 * PageHeader - Pipeline 实时执行面板 页头
 * 抽取自 index.tsx (P2-9 Phase 216)
 */
import { Button, Space, Typography, Badge } from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import StatusBadge, { type StatusType } from '@/components/StatusBadge';

const { Title, Text } = Typography;

interface Props {
  pipeline?: Record<string, unknown> | null;
  runId?: string;
  id?: string;
  isConnected: boolean;
  error: unknown;
  onBack: () => void;
}

export const PageHeader = ({ pipeline, runId, id, isConnected, error, onBack }: Props) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.lg,
    }}
  >
    <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>
      返回列表
    </Button>
    <div style={{ flex: 1 }}>
      <Title
        level={2}
        style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}
      >
        <PlayCircleOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
        {(pipeline?.name as string) || 'Pipeline'} 实时执行
      </Title>
      <Space size="middle">
        <Text type="secondary">
          运行 #{(pipeline?.runNumber as number) || runId || id}
        </Text>
        <Badge
          status={isConnected ? 'success' : 'error'}
          text={isConnected ? 'SSE 已连接' : 'SSE 未连接'}
        />
        {error instanceof Error && (
          <Text type="danger" style={{ fontSize: 12 }}>
            连接错误: {error.message}
          </Text>
        )}
      </Space>
    </div>
    <div style={{ marginLeft: 'auto' }}>
      <Space>
        {pipeline && (
          <StatusBadge
            status={((pipeline.status as string) || 'running') as StatusType}
            size="medium"
          />
        )}
      </Space>
    </div>
  </div>
);
