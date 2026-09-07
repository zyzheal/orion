/**
 * EphemeralEnvDetail Page
 * - Status banner: environment status + Preview link
 * - Services info table
 * - Resource allocation display
 * - Event timeline: Provisioning -> Running -> Idle -> Teardown
 * - Cost card
 * - Actions: wake, teardown, view logs
 *
 * 2026-08-26: 拆分 5 Card + state hook (P2-9 Phase 115)
 */
import React from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import { useEphemeralEnvDetailState } from './useEphemeralEnvDetailState';
import { StatusBannerCard } from './Components/StatusBannerCard';
import { EnvInfoCard } from './Components/EnvInfoCard';
import { ServicesCard } from './Components/ServicesCard';
import { EventTimelineCard } from './Components/EventTimelineCard';
import { CostCard } from './Components/CostCard';

const { Text } = Typography;

const EphemeralEnvDetail: React.FC = () => {
  const state = useEphemeralEnvDetailState();
  const { loading, env, navigate } = state;

  if (!env) {
    return (
      <div style={{ padding: spacing.lg, textAlign: 'center' }} data-testid="ephemeral-env-detail-page">
        {loading ? (
          <Text>Loading...</Text>
        ) : (
          <div>
            <Text type="secondary">未找到该环境</Text>
            <br />
            <Button type="link" onClick={() => navigate('/ephemeral-envs')}>
              返回环境列表
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }} data-testid="ephemeral-env-detail-page">
      <div style={{ marginBottom: spacing.md }}>
        <Button
          type="link"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/ephemeral-envs')}
          style={{ padding: 0 }}
        >
          返回环境列表
        </Button>
      </div>

      <StatusBannerCard state={state} />
      <EnvInfoCard state={state} />
      <ServicesCard state={state} />
      <EventTimelineCard state={state} />
      <CostCard state={state} />
    </div>
  );
};

export default EphemeralEnvDetail;
