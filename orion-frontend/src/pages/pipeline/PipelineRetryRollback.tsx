/**
 * Pipeline 重试与回滚页面
 * 功能：失败任务重试、部署版本回滚、操作审计
 *
 * 对接 API：getPipelineRuns, retryPipelineRun, cancelPipelineRun
 * 回滚功能使用前端模拟（后端未暴露 rollback 端点）
 *
 * 主入口 (P2-9 Phase 111 refactor: 已抽取 types/constants/columns/hook/Components)
 */
import React from 'react';
import { Typography, Row, Col } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { usePipelineRetryRollbackState } from './usePipelineRetryRollbackState';
import { StatsRow } from './Components/StatsRow';
import { RunsList } from './Components/RunsList';
import { RunDetail } from './Components/RunDetail';
import { RetryRollbackModals } from './Components/RetryRollbackModals';

const { Title, Text } = Typography;

const PipelineRetryRollback: React.FC = () => {
  const state = usePipelineRetryRollbackState();

  return (
    <div style={{ padding: spacing.lg }}>
      {/* ===== 标题 ===== */}
      <Title level={2} style={{ marginBottom: 8, color: colors.neutral[900], fontWeight: 600 }}>
        <ReloadOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        Pipeline 重试与回滚
      </Title>
      <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
        失败任务重试 · 部署版本回滚 · 操作审计
      </Text>

      {/* ===== 顶部统计 ===== */}
      <StatsRow state={state} />

      {/* ===== 主体区域 ===== */}
      <Row gutter={[spacing.md, spacing.md]}>
        {/* 左侧：Pipeline Run 列表 */}
        <Col flex="1 1 60%">
          <RunsList state={state} />
        </Col>

        {/* 右侧：选中 Run 详情面板 */}
        <Col flex="1 1 40%">
          <RunDetail state={state} />
        </Col>
      </Row>

      {/* ===== Modals ===== */}
      <RetryRollbackModals state={state} />
    </div>
  );
};

export default PipelineRetryRollback;
