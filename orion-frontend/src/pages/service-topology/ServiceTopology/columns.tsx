/**
 * columns.tsx - ServiceTopology 依赖关系表格列定义
 * 抽取自 index.tsx (P2-9 Phase 226)
 */
import { Tag, Typography } from 'antd';
import type { TableColumn } from '@/components/Table';
import { colors } from '@/tokens';
import type { TopologyEdge } from '@/api/service-topology';
import { DEPENDENCY_TYPE_COLORS, DEPENDENCY_DESCRIPTIONS } from './constants';

const { Text } = Typography;

const edgeTypeTag = (type: string) => {
  const color = DEPENDENCY_TYPE_COLORS[type] || colors.neutral[500];
  const label = type === 'calls' ? '调用' : type;
  return <Tag color={color}>{label}</Tag>;
};

export function buildDependencyColumns(): TableColumn<TopologyEdge>[] {
  return [
    {
      key: 'source',
      title: '源服务',
      dataIndex: 'source',
      width: '25%',
      render: (value: unknown) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'target',
      title: '目标服务',
      dataIndex: 'target',
      width: '25%',
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'type',
      title: '依赖类型',
      dataIndex: 'type',
      width: '15%',
      render: (value: unknown) => edgeTypeTag(String(value)),
    },
    {
      key: 'description',
      title: '描述',
      dataIndex: 'type',
      width: '35%',
      render: (value: unknown) => {
        const type = String(value);
        return <Text type="secondary">{DEPENDENCY_DESCRIPTIONS[type] || '未知依赖类型'}</Text>;
      },
    },
  ];
}
