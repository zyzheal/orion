import { Typography, Card, Space, Badge } from 'antd';
import type { TabsProps } from 'antd';
import {
  PlayCircleOutlined,
  CodeOutlined,
  ApartmentOutlined,
  HistoryOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { StageTimeline } from '../StageTimeline';
import { LogViewer } from '../LogViewer';
import { DAGTab } from '../DAGTab';
import { RunsHistoryTab } from '../RunsHistoryTab';
import { TaskOutputsTable } from '../TaskOutputsTable';
import type { usePipelineDetailState } from '../usePipelineDetailState';

type State = ReturnType<typeof usePipelineDetailState>;

const { Text } = Typography;

interface Props {
  state: State;
}

export function buildTabItems({ state: s }: Props): TabsProps['items'] {
  return [
    {
      key: 'stages',
      label: (
        <Space>
          <PlayCircleOutlined />
          阶段详情
        </Space>
      ),
      children: (
        <StageTimeline
          pipeline={s.pipeline!}
          retryingStageId={s.retryingStageId}
          formatDuration={s.formatDuration}
          onRetryFromStage={s.handleRetryFromStage}
        />
      ),
    },
    {
      key: 'logs',
      label: (
        <Space>
          <CodeOutlined />
          执行日志
        </Space>
      ),
      children: <LogViewer pipeline={s.pipeline!} />,
    },
    {
      key: 'dag',
      label: (
        <Space>
          <ApartmentOutlined />
          DAG 视图
        </Space>
      ),
      children: <DAGTab pipeline={s.pipeline!} />,
    },
    {
      key: 'runs',
      label: (
        <Space>
          <HistoryOutlined />
          运行历史
          <Badge count={s.runs.length} style={{ backgroundColor: colors.primary[500] }} />
        </Space>
      ),
      children: (
        <RunsHistoryTab
          id={s.id}
          runs={s.runs}
          runsLoading={s.runsLoading}
          isRerunning={s.isRerunning}
          onNavigate={(path) => s.navigate(path)}
          onRerun={s.handleRerun}
        />
      ),
    },
    {
      key: 'outputs',
      label: (
        <Space>
          <SwapOutlined />
          任务输出
        </Space>
      ),
      children: (
        <Card style={{ marginBottom: spacing.lg }} title="任务输出与变量传播">
          <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
            以下列出各阶段任务产生的输出变量及其传播目标。
          </Text>
          <TaskOutputsTable />
        </Card>
      ),
    },
  ];
}
