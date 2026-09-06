/**
 * Data Pipeline Health Monitor (P3-17)
 * 数据管道健康度监控 — 管道状态 / SLA / 延迟告警 / 数据新鲜度
 *
 * Features:
 * - 统计卡片（总数 / 运行中 / 异常 / 平均延迟）
 * - 管道列表 Table（筛选 + 操作）
 * - SVG 管道拓扑图（DAG）
 * - 告警记录列表
 *
 * 主入口 (P2-9 Phase 107 refactor: 已抽取 types/constants/mockData/columns/hook/Components)
 */
import React from 'react';
import { Row, Col, Typography } from 'antd';
import { BranchesOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useDataPipelineMonitorState } from './useDataPipelineMonitorState';
import { StatsCards } from './Components/StatsCards';
import { PipelineTable } from './Components/PipelineTable';
import TopologyMap from './Components/TopologyMap';
import AlertRecords from './Components/AlertRecords';

const { Title, Text } = Typography;

const DataPipelineMonitor: React.FC = () => {
  const state = useDataPipelineMonitorState();

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Header */}
      <Row style={{ marginBottom: spacing.md }}>
        <Col>
          <Title level={2} style={{ marginBottom: 8 }}>
            <BranchesOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            数据管道健康度监控
          </Title>
          <Text type="secondary">管道状态 · SLA 监控 · 延迟告警 · 数据新鲜度</Text>
        </Col>
      </Row>

      {/* Stats Cards */}
      <StatsCards stats={state.stats} />

      {/* Main Content */}
      <Row gutter={spacing.md} style={{ marginBottom: spacing.md }}>
        <Col span={14}>
          <PipelineTable
            dataSource={state.filteredPipelines}
            filterStatus={state.filterStatus}
            filterFrequency={state.filterFrequency}
            onFilterStatusChange={state.setFilterStatus}
            onFilterFrequencyChange={state.setFilterFrequency}
          />
        </Col>
        <Col span={10}>
          <TopologyMap />
        </Col>
      </Row>

      {/* Alert Records */}
      <AlertRecords />
    </div>
  );
};

export default DataPipelineMonitor;
