/**
 * columns.tsx - 混沌实验表格列定义
 * 抽取自 ChaosEngineering/index.tsx (P2-9 Phase 91)
 */
import React from 'react';
import { Space, Text, Tag, Button, Tooltip } from 'antd';
import { ExperimentOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ChaosExperiment } from '@/api/chaos';
import { colors } from '@/tokens/colors';
import { faultTypeConfig, statusConfig, envConfig } from './constants';

interface ColumnDeps {
  runningId: string | null;
  openDetail: (exp: ChaosExperiment) => void;
  handleRunExperiment: (id: string) => void;
}

export const makeExperimentColumns = (deps: ColumnDeps): ColumnsType<ChaosExperiment> => [
  {
    title: '实验名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    render: (v: string, record: ChaosExperiment) => (
      <Space direction="vertical" size={0}>
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => deps.openDetail(record)}
        >
          <ExperimentOutlined style={{ marginRight: 6 }} />
          {v}
        </Text>
        <Text type="secondary" style={
            { fontSize: 12 } as React.CSSProperties
          }>
          {record.description?.substring(0, 40) || '-'}
        </Text>
      </Space>
    ),
  },
  {
    title: '环境',
    dataIndex: 'scope',
    key: 'environment',
    width: 100,
    render: (scope: { environment?: string }) => {
      const env = scope?.environment || 'staging';
      const cfg = envConfig[env] || envConfig.staging;
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (status: string) => {
      const cfg = statusConfig[status] || statusConfig.draft;
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: '故障类型',
    dataIndex: 'faults',
    key: 'faults',
    width: 200,
    render: (faults: Array<{ type: string }>) => (
      <Space wrap>
        {(faults || []).slice(0, 3).map((f, i) => {
          const cfg = faultTypeConfig[f.type] || { label: f.type, color: 'default' };
          return (
            <Tag key={String(i)} color={cfg.color}>
              {cfg.label}
            </Tag>
          );
        })}
        {(faults || []).length > 3 && <Tag>+{(faults || []).length - 3}</Tag>}
      </Space>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: (_: unknown, record: ChaosExperiment) => (
      <Space size="small">
        <Tooltip title="查看详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => deps.openDetail(record)}
          />
        </Tooltip>
        {record.status === 'active' && (
          <Tooltip title="运行实验">
            <Button
              type="link"
              size="small"
              icon={<PlayCircleOutlined />}
              loading={deps.runningId === record.id}
              onClick={() => deps.handleRunExperiment(record.id)}
            />
          </Tooltip>
        )}
      </Space>
    ),
  },
];
