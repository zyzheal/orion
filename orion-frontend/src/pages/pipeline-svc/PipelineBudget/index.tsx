/**
 * Pipeline Budget Page
 * Phase 1 - Budget configuration and monitoring UI
 *
 * Split into components (P2-9 Phase 152):
 * - types.ts / constants.ts / usePipelineBudgetState.ts
 * - Components/{PipelineBudgetHeader,ConfigCard,UsageCard}.tsx
 */
import React from 'react';
import { Alert, Col, Row, Spin } from 'antd';
import { usePipelineBudgetState } from './usePipelineBudgetState';
import { PipelineBudgetHeader } from './Components/PipelineBudgetHeader';
import { ConfigCard } from './Components/ConfigCard';
import { UsageCard } from './Components/UsageCard';
import { spacing } from '@/tokens';

const PipelineBudget: React.FC = () => {
  const { pipelineId, config, usage, loading, saving, form, loadBudget, handleSave, handleReset } =
    usePipelineBudgetState();

  return (
    <div style={{ padding: 0 }}>
      <PipelineBudgetHeader onRefresh={loadBudget} loading={loading} />

      {!pipelineId && (
        <Alert
          message="未指定 Pipeline ID"
          description="请在 URL 中包含 pipelineId 参数，例如: /pipelines/xxx/budget"
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      <Row gutter={24}>
        <Col span={14}>
          <Spin spinning={loading}>
            <ConfigCard
              form={form}
              config={config}
              saving={saving}
              onSubmit={handleSave}
              onReset={handleReset}
            />
          </Spin>
        </Col>

        <Col span={10}>
          <Spin spinning={loading}>
            <UsageCard usage={usage} config={config} />
          </Spin>
        </Col>
      </Row>
    </div>
  );
};

export default PipelineBudget;
