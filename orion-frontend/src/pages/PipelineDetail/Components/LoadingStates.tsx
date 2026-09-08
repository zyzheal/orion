import { Typography, Button, Space, Tabs, Result, Card, Badge } from 'antd';
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
const { TabPane } = Tabs;

interface Props {
  state: State;
}

export function LoadingStates({ state: s }: Props) {
  // Loading state
  if (s.loading) {
    return (
      <div style={{ padding: 0 }}>
        <Result status="info" title="加载中..." />
      </div>
    );
  }

  // Error state
  if (s.apiError || !s.pipeline) {
    return (
      <div style={{ padding: 0 }}>
        <Result
          status="error"
          title="加载失败"
          subTitle={s.apiError}
          extra={
            <Button type="primary" onClick={() => window.location.reload()}>
              重新加载
            </Button>
          }
        />
      </div>
    );
  }

  return null;
}
