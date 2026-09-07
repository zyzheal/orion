/**
 * RiskDashboard table columns
 * 抽取自 index.tsx (P2-9 Phase 143)
 */
import React from 'react';
import { Button, Space, Tag, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RiskAssessment, RiskEvent } from '@/api/risk';
import { RISK_LEVEL_COLOR } from './constants';

const { Text } = Typography;

const EVENT_ICON_MAP: Record<string, React.ReactNode> = {
  risk_detected: <ExclamationCircleOutlined />,
  risk_escalated: <WarningOutlined />,
  risk_mitigated: <CheckCircleOutlined />,
};

export const buildAssessmentColumns = (deps: {
  openDrawer: (record: RiskAssessment) => void;
}): ColumnsType<RiskAssessment> => {
  const { openDrawer } = deps;
  return [
    {
      title: '目标类型',
      dataIndex: 'targetType',
      key: 'targetType',
      render: (type: string) => (
        <Space>
          <FileTextOutlined />
          <Text>{type}</Text>
        </Space>
      ),
    },
    {
      title: '目标 ID',
      dataIndex: 'targetId',
      key: 'targetId',
      render: (id: string) => <Text code>{id}</Text>,
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      render: (level: string) => <Tag color={RISK_LEVEL_COLOR[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '风险评分',
      dataIndex: 'riskScore',
      key: 'riskScore',
      render: (score: number) => (
        <Tag color={score > 70 ? 'red' : score > 40 ? 'orange' : 'green'}>
          {(score ?? 0).toFixed(0)}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'completed' ? 'green' : status === 'pending' ? 'orange' : 'red'}>
          {status === 'completed' ? '已完成' : status === 'pending' ? '评估中' : '失败'}
        </Tag>
      ),
    },
    {
      title: '评估时间',
      dataIndex: 'assessedAt',
      key: 'assessedAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record?: RiskAssessment) =>
        record ? (
          <Button type="link" size="small" onClick={() => openDrawer(record)}>
            详情
          </Button>
        ) : null,
    },
  ];
};

export const buildEventColumns = (deps: {
  handleAcknowledge: (id: string) => Promise<void>;
}): ColumnsType<RiskEvent & { key: string }> => {
  const { handleAcknowledge } = deps;
  return [
    {
      title: '事件类型',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string) => (
        <Space>
          {EVENT_ICON_MAP[type]}
          <Text>{type}</Text>
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
      render: (level: string) => <Tag color={RISK_LEVEL_COLOR[level]}>{level.toUpperCase()}</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (ts: string) => new Date(ts).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record?: RiskEvent & { key: string }) =>
        record && !record.acknowledged ? (
          <Button type="link" size="small" onClick={() => handleAcknowledge(record.id)}>
            确认
          </Button>
        ) : (
          <Tag color="green">已确认</Tag>
        ),
    },
  ];
};
