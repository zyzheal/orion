/**
 * Traffic Governance table columns
 * 抽取自 index.tsx (P2-9 Phase 157)
 */
import { Button, Popconfirm, Progress, Space, Tag, Tooltip, Typography } from 'antd';
import {
  ApartmentOutlined,
  DeleteOutlined,
  RocketOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import { STATUS_COLOR_MAP, STATUS_LABEL_MAP, getEnvColor } from './constants';
import type { TrafficRule } from './types';

const { Text } = Typography;

export interface TrafficColumnDeps {
  handlePromote: (record: TrafficRule) => void;
  handleRollback: (record: TrafficRule) => void;
  handleEdit: (record: TrafficRule) => void;
  handleDelete: (id: string) => void;
}

export function buildColumns(deps: TrafficColumnDeps): ColumnsType<TrafficRule> {
  const { handlePromote, handleRollback, handleEdit, handleDelete } = deps;
  return [
    {
      title: '服务名',
      dataIndex: 'serviceName',
      key: 'serviceName',
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => <Tag color={getEnvColor(env)}>{env}</Tag>,
    },
    {
      title: 'Canary 版本',
      dataIndex: 'canaryVersion',
      key: 'canaryVersion',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '基线版本',
      dataIndex: 'baselineVersion',
      key: 'baselineVersion',
    },
    {
      title: '流量切分',
      key: 'trafficSplit',
      render: (_: unknown, record: TrafficRule) => (
        <Space>
          <Progress
            type="circle"
            size={60}
            percent={record.canaryWeight}
            format={(p) => `${p}%`}
            strokeColor={colors.primary[500]}
          />
          <Text type="secondary">Canary</Text>
          <Progress
            type="circle"
            size={60}
            percent={record.baselineWeight}
            format={(p) => `${p}%`}
            strokeColor={colors.neutral[400]}
          />
          <Text type="secondary">Baseline</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={STATUS_COLOR_MAP[status]}>{STATUS_LABEL_MAP[status]}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: TrafficRule) => (
        <Space size="small">
          <Tooltip title="全量发布">
            <Button
              size="small"
              type="primary"
              icon={<RocketOutlined />}
              onClick={() => handlePromote(record)}
              disabled={record.status !== 'active'}
            >
              发布
            </Button>
          </Tooltip>
          <Tooltip title="回滚">
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record)}
              disabled={record.status !== 'active'}
            >
              回滚
            </Button>
          </Tooltip>
          <Tooltip title="编辑流量权重">
            <Button size="small" icon={<ApartmentOutlined />} onClick={() => handleEdit(record)}>
              权重
            </Button>
          </Tooltip>
          <Popconfirm title="确认删除此流量规则？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];
}
