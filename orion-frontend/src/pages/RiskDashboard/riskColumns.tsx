/**
 * RiskDashboard column definitions
 * 抽取自 index.tsx (P2-9 Phase 123)
 */
import React from 'react';
import { Typography, Tag, Space, Button } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import type { RiskAssessment, RiskEvent } from '@/api/risk';
import { riskLevelColor, eventTypeIconMap } from './constants';

const { Text } = Typography;

export interface RiskColumnsDeps {
  openDetail: (record: RiskAssessment) => void;
  handleAcknowledge: (id: string) => void;
}

export const buildAssessmentColumns = ({ openDetail, handleAcknowledge }: RiskColumnsDeps): {
  title: string;
  dataIndex?: string;
  key: string;
  render?: (value: unknown, record?: RiskAssessment) => React.ReactNode;
}[] => [
  {
    title: '目标类型',
    dataIndex: 'targetType',
    key: 'targetType',
    render: (type) => (
      <Space>
        <FileTextOutlined />
        <Text>{String(type)}</Text>
      </Space>
    ),
  },
  {
    title: '目标 ID',
    dataIndex: 'targetId',
    key: 'targetId',
    render: (id) => <Text code>{String(id)}</Text>,
  },
  {
    title: '风险等级',
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    render: (level) => <Tag color={riskLevelColor[String(level)]}>{String(level).toUpperCase()}</Tag>,
  },
  {
    title: '风险评分',
    dataIndex: 'riskScore',
    key: 'riskScore',
    render: (score) => {
      const n = Number(score) || 0;
      return (
        <Tag color={n > 70 ? 'red' : n > 40 ? 'orange' : 'green'}>{n.toFixed(0)}</Tag>
      );
    },
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status) => {
      const s = String(status);
      return (
        <Tag color={s === 'completed' ? 'green' : s === 'pending' ? 'orange' : 'red'}>
          {s === 'completed' ? '已完成' : s === 'pending' ? '评估中' : '失败'}
        </Tag>
      );
    },
  },
  {
    title: '评估时间',
    dataIndex: 'assessedAt',
    key: 'assessedAt',
    render: (ts) => new Date(String(ts)).toLocaleString(),
  },
  {
    title: '操作',
    key: 'action',
    render: (_: unknown, record?: RiskAssessment) =>
      record ? (
        <Button type="link" size="small" onClick={() => openDetail(record)}>
          详情
        </Button>
      ) : null,
  },
];

export const buildEventColumns = ({ handleAcknowledge }: Pick<RiskColumnsDeps, 'handleAcknowledge'>): {
  title: string;
  dataIndex?: string;
  key: string;
  render?: (value: unknown, record?: RiskEvent) => React.ReactNode;
}[] => [
  {
    title: '事件类型',
    dataIndex: 'eventType',
    key: 'eventType',
    render: (type) => (
      <Space>
        {eventTypeIconMap[String(type)]}
        <Text>{String(type)}</Text>
      </Space>
    ),
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
  },
  {
    title: '风险等级',
    dataIndex: 'riskLevel',
    key: 'riskLevel',
    render: (level) => <Tag color={riskLevelColor[String(level)]}>{String(level).toUpperCase()}</Tag>,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (ts) => new Date(String(ts)).toLocaleString(),
  },
  {
    title: '操作',
    key: 'action',
    render: (_: unknown, record?: RiskEvent) => {
      if (!record) return null;
      return record.acknowledged ? (
        <Tag color="green">已确认</Tag>
      ) : (
        <Button type="link" size="small" onClick={() => handleAcknowledge(record.id)}>
          确认
        </Button>
      );
    },
  },
];
