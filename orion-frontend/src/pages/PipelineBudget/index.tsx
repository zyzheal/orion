/**
 * Pipeline Budget Page
 * Phase 1 - Budget configuration and monitoring UI
 *
 * Split into components (P2-9 Phase 149):
 * - usePipelineBudgetState.ts: state + loadBudget/loadUsage/handleSave/handleReset
 * - constants.ts: ALERT_LEVEL_CONFIG + POLICY_LABEL_MAP + TIME_POLICY_OPTIONS + COST_POLICY_OPTIONS
 * - Components/PipelineBudgetHeader.tsx
 * - Components/ConfigCard.tsx (time/cost/compute form)
 * - Components/UsageCard.tsx (alerts + stats + summary)
 */
import React from 'react';
import { Alert, Col, Row, Spin } from 'antd';
import { usePipelineBudgetState } from './usePipelineBudgetState';
import { PipelineBudgetHeader } from './Components/PipelineBudgetHeader';
import { ConfigCard } from './Components/ConfigCard';
import { UsageCard } from './Components/UsageCard';

const PipelineBudget: React.FC = () => {
  const state = usePipelineBudgetState();

  return (
    <div style={{ padding: 0 }}>
      <PipelineBudgetHeader loading={state.loading} onRefresh={state.loadBudget} />

      {!state.pipelineId && (
        <Alert
          message="未指定 Pipeline ID"
          description="请在 URL 中包含 pipelineId 参数，例如: /pipelines/xxx/budget"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={24}>
        {/* Left: Budget Configuration */}
        <Col span={14}>
          <Spin spinning={state.loading}>
            <ConfigCard
              form={state.form}
              config={state.config}
              saving={state.saving}
              onSave={state.handleSave}
              onReset={state.handleReset}
            />
          </Spin>
        </Col>

        {/* Right: Budget Usage */}
        <Col span={10}>
          <Spin spinning={state.loading}>
            <UsageCard config={state.config} usage={state.usage} />
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default PipelineBudget;
