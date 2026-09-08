/**
 * LogPanel - 执行阶段 + 实时日志 双列布局
 * 抽取自 index.tsx (P2-9 Phase 216)
 */
import { Card, Space, Badge } from 'antd';
import { spacing } from '@/tokens';
import type { StageState, LogEntry } from '../types';
import { StageProgress } from '../StageProgress';
import { LiveLogViewer } from '../LiveLogViewer';

interface Props {
  stages: StageState[];
  currentStageId?: string;
  displayLogs: LogEntry[];
  autoScroll: boolean;
  searchText: string;
  isConnected: boolean;
}

export const LogPanel = ({
  stages,
  currentStageId,
  displayLogs,
  autoScroll,
  searchText,
  isConnected,
}: Props) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '380px 1fr',
      gap: spacing.md,
      alignItems: 'start',
    }}
  >
    <Card title="执行阶段" size="small">
      <StageProgress stages={stages} currentStageId={currentStageId} />
    </Card>
    <Card
      title={
        <Space>
          实时日志
          {isConnected && <Badge status="success" text="实时推送中" />}
        </Space>
      }
      size="small"
    >
      <LiveLogViewer logs={displayLogs} autoScroll={autoScroll} searchText={searchText} />
    </Card>
  </div>
);
