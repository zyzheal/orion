/**
 * ApprovalEscalation (P3-03)
 * 审批超时升级页面 - SLA 监控、超时自动升级、审批时效分析
 * 纯前端 Mock 数据
 *
 * 拆分结构（P2-9 Phase 30）:
 * - types.ts: EscalationStatus / ApprovalRecord / EscalationRule / TrendDay
 * - constants.tsx: MOCK_* + statusConfig + formatWaitTime + statusTag
 * - TrendChart.tsx: SVG 双线趋势图
 * - StatsCards.tsx: 4 张统计卡（Mock 数值）
 * - EscalationRulesCard.tsx: 升级策略配置卡（含新建规则 Modal）
 * - TrendCard.tsx: 近 7 天审批时效趋势卡
 * - ApprovalTableColumns.tsx: 超时审批表格列配置 Hook
 * - ApprovalDetailModal.tsx: 审批详情 Modal（含升级路径 Timeline）
 * P2-9 Phase 289: 151->104 行 (-31%), 新增 Components/{PageHeader,ApprovalTableCard}.tsx
 */
import React, { useState, useMemo } from 'react';
import { Row, Col, message } from 'antd';
import { spacing, themeVars } from '@/tokens';
import { MOCK_APPROVALS } from './constants';
import type { ApprovalRecord, EscalationStatus } from './types';
import { StatsCards } from './StatsCards';
import { EscalationRulesCard } from './EscalationRulesCard';
import { TrendCard } from './TrendCard';
import { useApprovalTableColumns } from './ApprovalTableColumns';
import { ApprovalDetailModal } from './ApprovalDetailModal';
import { PageHeader } from './Components/PageHeader';
import { ApprovalTableCard } from './Components/ApprovalTableCard';

const ApprovalEscalation: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState<EscalationStatus | 'all'>('all');
  const [approvals] = useState<ApprovalRecord[]>(MOCK_APPROVALS);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ApprovalRecord | null>(null);

  const filteredData = useMemo(
    () =>
      approvals.filter((a) => {
        if (statusFilter === 'all') return true;
        return a.status === statusFilter;
      }),
    [approvals, statusFilter]
  );

  const handleEscalate = (record: ApprovalRecord) => {
    message.success(`审批单 ${record.requestNo} 已手动升级至上一级审批人`);
  };

  const handleUrgent = (record: ApprovalRecord) => {
    message.info(`已向审批人 ${record.approver} 发送催办通知`);
  };

  const handleViewDetail = (record: ApprovalRecord) => {
    setSelectedRecord(record);
    setDetailVisible(true);
  };

  const columns = useApprovalTableColumns({
    handleEscalate,
    handleUrgent,
    handleViewDetail,
  });

  return (
    <div
      style={{
        padding: spacing.lg,
        background: themeVars.bgSecondary,
        minHeight: '100vh',
      }}
    >
      <PageHeader />

      <StatsCards />

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <ApprovalTableCard
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            filteredData={filteredData}
            columns={columns}
          />
        </Col>

        <Col span={10}>
          <EscalationRulesCard />
        </Col>
      </Row>

      <TrendCard />

      <ApprovalDetailModal
        visible={detailVisible}
        record={selectedRecord}
        onClose={() => setDetailVisible(false)}
        onUrgent={handleUrgent}
        onEscalate={handleEscalate}
      />
    </div>
  );
};

export default ApprovalEscalation;
