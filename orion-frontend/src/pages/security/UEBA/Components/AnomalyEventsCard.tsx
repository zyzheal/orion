/**
 * UEBA Anomaly Events Card
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import React from 'react';
import { Card, Space, Select, Table, Empty } from 'antd';
import { RadarChartOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { AnomalyType, AnomalyEvent, RiskLevel } from '../types';
import { plainCardStyle } from '../constants';
import { buildAnomalyColumns } from '../anomalyColumns';

const { Option } = Select;

interface AnomalyEventsCardProps {
  filteredEvents: AnomalyEvent[];
  typeFilter: AnomalyType | 'all';
  setTypeFilter: (v: AnomalyType | 'all') => void;
  levelFilter: RiskLevel;
  setLevelFilter: (v: RiskLevel) => void;
}

export const AnomalyEventsCard: React.FC<AnomalyEventsCardProps> = ({
  filteredEvents,
  typeFilter,
  setTypeFilter,
  levelFilter,
  setLevelFilter,
}) => (
  <Card
    title={
      <Space>
        <RadarChartOutlined />
        <span>异常事件列表</span>
      </Space>
    }
    style={plainCardStyle}
  >
    <div style={{ marginBottom: spacing.md, display: 'flex', gap: spacing.sm }}>
      <Select
        placeholder="筛选异常类型"
        value={typeFilter}
        onChange={setTypeFilter}
        style={{ width: 180 }}
      >
        <Option value="all">全部类型</Option>
        <Option value="异常登录">异常登录</Option>
        <Option value="权限滥用">权限滥用</Option>
        <Option value="数据外泄">数据外泄</Option>
        <Option value="异常时间">异常时间</Option>
        <Option value="高频操作">高频操作</Option>
      </Select>
      <Select
        placeholder="筛选风险等级"
        value={levelFilter}
        onChange={setLevelFilter}
        style={{ width: 160 }}
      >
        <Option value="all">全部等级</Option>
        <Option value="high">高风险 (&gt;=80)</Option>
        <Option value="medium">中风险 (40-79)</Option>
        <Option value="low">低风险 (&lt;40)</Option>
      </Select>
    </div>

    <Table
      columns={buildAnomalyColumns()}
      dataSource={filteredEvents}
      rowKey="key"
      size="small"
      pagination={{ pageSize: 8, showSizeChanger: false, showQuickJumper: true }}
      scroll={{ x: 1000 }}
      style={{ marginTop: spacing.sm }}
      locale={
        {
          emptyText: (
            <Empty
              description="UEBA 异常事件数据尚未接入，API 开发中"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ),
        } as React.ComponentProps<typeof Table>['locale']
      }
    />
  </Card>
);
