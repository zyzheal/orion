/**
 * AgentRunDetail Page
 * - Status banner: run status + progress
 * - Decision timeline: step-by-step agent decisions (action, input, output, reasoning)
 * - Approval records: status and approver at each approval gate
 * - Final result: PR URL, fix summary, failure reason
 * - Actions: cancel, retry, replay
 *
 * P2-9 Phase 120 拆分:
 * - useAgentRunDetailState.tsx  状态 hook (5 useState + loadData + 2 handlers + 4 derived)
 * - constants.tsx              statusToBadge + actionIconMap + defaultActionIcon
 * - Components/AgentRunDetailStatusBanner.tsx
 * - Components/AgentRunDetailRunInfo.tsx
 * - Components/AgentRunDetailDecisionTimeline.tsx
 * - Components/AgentRunDetailDecisionDetails.tsx
 * - Components/AgentRunDetailApprovals.tsx
 * - Components/AgentRunDetailResult.tsx
 */
import React from 'react';
import { Button, Spin, Empty } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useAgentRunDetailState } from './useAgentRunDetailState';
import { AgentRunDetailStatusBanner } from './Components/AgentRunDetailStatusBanner';
import { AgentRunDetailRunInfo } from './Components/AgentRunDetailRunInfo';
import { AgentRunDetailDecisionTimeline } from './Components/AgentRunDetailDecisionTimeline';
import { AgentRunDetailDecisionDetails } from './Components/AgentRunDetailDecisionDetails';
import { AgentRunDetailApprovals } from './Components/AgentRunDetailApprovals';
import { AgentRunDetailResult } from './Components/AgentRunDetailResult';

const AgentRunDetail: React.FC = () => {
  const state = useAgentRunDetailState();
  const { run, loading, navigate } = state;

  if (!run) {
    return (
      <Spin spinning={loading} size="large">
        <div style={{ padding: spacing.lg, textAlign: 'center' }}>
          {!loading && (
            <Empty description="未找到该运行记录">
              <Button type="primary" onClick={() => navigate('/agents/dashboard')}>
                返回仪表盘
              </Button>
            </Empty>
          )}
        </div>
      </Spin>
    );
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 0 }} data-testid="agent-run-detail-page">
        {/* Breadcrumb / back */}
        <div style={{ marginBottom: spacing.md }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/agents/dashboard')}
            style={{ padding: 0 }}
          >
            返回 Agent 仪表盘
          </Button>
        </div>

        <AgentRunDetailStatusBanner state={state} />
        <AgentRunDetailRunInfo state={state} />
        <AgentRunDetailDecisionTimeline state={state} />
        <AgentRunDetailDecisionDetails state={state} />
        <AgentRunDetailApprovals state={state} />
        <AgentRunDetailResult state={state} />
      </div>
    </Spin>
  );
};

export default AgentRunDetail;
