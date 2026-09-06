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
 */
import React, { useState, useMemo } from 'react';
import { Typography, Card, Table, Select, Space, Row, Col, message } from 'antd';
import {
  ClockCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens/colors';
import { spacing, themeVars } from '@/tokens';
import { MOCK_APPROVALS } from './constants';
import type { ApprovalRecord, EscalationStatus } from './types';
import { StatsCards } from './StatsCards';
import { EscalationRulesCard } from './EscalationRulesCard';
import { TrendCard } from './TrendCard';
import { useApprovalTableColumns } from './ApprovalTableColumns';
import { ApprovalDetailModal } from './ApprovalDetailModal';

const { Title, Text } = Typography;
const { Option } = Select;

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
      <Title level={2} style={{ marginBottom: 8 }}>
        <ClockCircleOutlined style={{ marginRight: 12, color: colors.warning[500] }} />
        审批超时升级
      </Title>
      <Text type="secondary">SLA 监控 · 超时自动升级 · 审批时效分析</Text>
      <br />

      <StatsCards />

      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <Card
            title={
              <Space>
                <WarningOutlined style={{ color: colors.error[500] }} />
                <Text strong>超时审批列表</Text>
              </Space>
            }
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: spacing.md,
              }}
            >
              <div>
                <Text type="secondary" style={{ marginRight: 8 }}>
                  状态筛选：
                </Text>
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  style={{ width: 180 }}
                  size="small"
                >
                  <Option value="all">全部</Option>
                  <Option value="warning">即将超时</Option>
                  <Option value="timeout">已超时</Option>
                  <Option value="escalated">已升级</Option>
                  <Option value="normal">正常</Option>
                </Select>
              </div>
              <Text type="secondary">共 {filteredData.length} 条记录</Text>
            </div>
            <Table
              columns={columns}
              dataSource={filteredData}
              rowKey="id"
              size="middle"
              rowClassName={() => 'ant-table-row-hoverable'}
              pagination={{ pageSize: 8, showSizeChanger: false }}
            />
          </Card>
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
