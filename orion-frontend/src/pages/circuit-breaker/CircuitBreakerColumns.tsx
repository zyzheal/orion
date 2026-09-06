/**
 * CircuitBreakerColumns.tsx - 熔断器表格列配置 + 筛选定义
 * 抽取自 CircuitBreakerPage.tsx (P2-9 Phase 81)
 */
import { Typography, Space, Tag, Switch, Button, Tooltip, Popconfirm, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  EditOutlined,
  DeleteOutlined,
  RestOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { FilterDefinition } from '@/components/SearchFilterBar';
import type { CircuitBreakerConfig, CircuitState } from '@/api/circuit-breaker';
import { stateColor, stateLabel, stateIcon } from './constants';

const { Text } = Typography;

interface CircuitBreakerColumnsProps {
  openEdit: (breaker: CircuitBreakerConfig) => void;
  openDetail: (breaker: CircuitBreakerConfig) => void;
  handleReset: (breaker: CircuitBreakerConfig) => void;
  handleDelete: (breaker: CircuitBreakerConfig) => void;
  onToggleEnabled: (id: string, enabled: boolean) => void;
}

export const makeCircuitBreakerColumns = (props: CircuitBreakerColumnsProps): ColumnsType<CircuitBreakerConfig> => [
  {
    title: '名称',
    dataIndex: 'name',
    key: 'name',
    width: 160,
    render: (text: string) => <Text strong>{text}</Text>,
  },
  {
    title: '服务',
    dataIndex: 'service',
    key: 'service',
    width: 140,
    render: (text: string) => <Text code>{text}</Text>,
  },
  {
    title: '端点',
    dataIndex: 'endpoint',
    key: 'endpoint',
    width: 160,
    ellipsis: true,
    render: (text?: string) =>
      text ? <Text code style={{ fontSize: 12 }}>{text}</Text> : '-',
  },
  {
    title: '状态',
    dataIndex: 'state',
    key: 'state',
    width: 100,
    filters: Object.entries(stateLabel).map(([value, text]) => ({ text, value })),
    onFilter: (value, record) => record.state === value,
    render: (state: CircuitState) => (
      <Tag color={stateColor[state]} icon={stateIcon[state]}>
        {stateLabel[state]}
      </Tag>
    ),
  },
  {
    title: '失败阈值',
    key: 'threshold',
    width: 100,
    render: (_: unknown, record) => (
      <Text>
        {record.failureThreshold} 次 / {record.timeoutSeconds}s
      </Text>
    ),
  },
  {
    title: '失败率',
    key: 'failureRate',
    width: 120,
    render: (_: unknown, record) => {
      const rate =
        record.totalRequests > 0
          ? Math.round((record.totalFailures / record.totalRequests) * 100)
          : 0;
      return (
        <Progress
          percent={rate}
          size="small"
          strokeColor={
            rate > 50 ? colors.error[500] : rate > 20 ? colors.warning[500] : colors.success[500]
          }
          format={() => `${rate}%`}
        />
      );
    },
  },
  {
    title: '启用',
    key: 'enabled',
    width: 80,
    render: (_: unknown, record) => (
      <Switch
        size="small"
        checked={record.enabled}
        checkedChildren="开"
        unCheckedChildren="关"
        onChange={(checked) => props.onToggleEnabled(record.id, checked)}
      />
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 160,
    render: (_: unknown, record) => (
      <Space size="small">
        <Tooltip title="详情">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => props.openDetail(record)} />
        </Tooltip>
        <Tooltip title="重置">
          <Button type="link" size="small" icon={<RestOutlined />} onClick={() => props.handleReset(record)} />
        </Tooltip>
        <Tooltip title="编辑">
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => props.openEdit(record)} />
        </Tooltip>
        <Popconfirm title="确认删除?" onConfirm={() => props.handleDelete(record)}>
          <Tooltip title="删除">
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Tooltip>
        </Popconfirm>
      </Space>
    ),
  },
];

export const circuitBreakerFilterDefs: FilterDefinition[] = [
  {
    key: 'state',
    label: '熔断状态',
    options: [
      { label: '全部', value: 'all' },
      { label: '正常', value: 'closed' },
      { label: '熔断', value: 'open' },
      { label: '半开', value: 'half-open' },
    ],
    placeholder: '按状态筛选',
  },
];
