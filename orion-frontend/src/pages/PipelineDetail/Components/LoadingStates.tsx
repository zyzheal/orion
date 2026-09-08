import { Button, Result } from 'antd';
import type { usePipelineDetailState } from '../usePipelineDetailState';

type State = ReturnType<typeof usePipelineDetailState>;

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
