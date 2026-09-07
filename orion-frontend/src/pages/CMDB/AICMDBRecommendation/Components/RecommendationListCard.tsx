/**
 * AICMDBRecommendation list card
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import React from 'react';
import { Card, Button, Space, Select, Table, Empty } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { spacing } from '@/tokens';
import type { RecommendationItem, RecommendationType, RecommendationStatus } from '@/api/cmdb';
import { buildRecommendationColumns } from '../recommendationColumns';

const { Option } = Select;

interface RecommendationListCardProps {
  recommendType: RecommendationType | 'all';
  setRecommendType: (v: RecommendationType | 'all') => void;
  recommendStatus: RecommendationStatus | 'all';
  setRecommendStatus: (v: RecommendationStatus | 'all') => void;
  filteredRecommendations: RecommendationItem[];
  handleAccept: (id: string) => void;
  handleReject: (id: string) => void;
  fetchRecommendations: () => void;
}

const tablePageSize = 5;

export const RecommendationListCard: React.FC<RecommendationListCardProps> = ({
  recommendType,
  setRecommendType,
  recommendStatus,
  setRecommendStatus,
  filteredRecommendations,
  handleAccept,
  handleReject,
  fetchRecommendations,
}) => (
  <Card
    title="智能推荐列表"
    extra={
      <Button icon={<ReloadOutlined />} size="small" onClick={() => fetchRecommendations()}>
        刷新
      </Button>
    }
    style={{ height: '100%' }}
  >
    <Space style={{ marginBottom: spacing.md }} size={spacing.sm}>
      <Select
        style={{ width: 140 }}
        value={recommendType}
        onChange={setRecommendType}
        allowClear
      >
        <Option value="all">全部类型</Option>
        <Option value="auto-link">自动关联</Option>
        <Option value="attribute-fill">属性补全</Option>
        <Option value="anomaly-detect">异常检测</Option>
        <Option value="topology-fix">拓扑修正</Option>
      </Select>
      <Select
        style={{ width: 140 }}
        value={recommendStatus}
        onChange={setRecommendStatus}
        allowClear
      >
        <Option value="all">全部状态</Option>
        <Option value="pending">待确认</Option>
        <Option value="accepted">已采纳</Option>
        <Option value="rejected">已拒绝</Option>
      </Select>
    </Space>
    {filteredRecommendations.length === 0 ? (
      <Empty description="暂无智能推荐，请确保 CMDB 中已有 CI 数据" />
    ) : (
      <Table
        columns={buildRecommendationColumns({ handleAccept, handleReject })}
        dataSource={filteredRecommendations}
        rowKey="id"
        pagination={{ pageSize: tablePageSize, size: 'small', showSizeChanger: false }}
        size="small"
        rowHoverable
      />
    )}
  </Card>
);
