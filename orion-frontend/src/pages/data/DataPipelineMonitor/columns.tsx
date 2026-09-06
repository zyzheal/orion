/**
 * Data Pipeline Monitor 列定义
 * 抽取自 index.tsx (P2-9 Phase 107)
 */
import { Button, Space, Tag, Typography, Tooltip, Switch } from 'antd';
const { Text } = Typography;
import { EyeOutlined, SyncOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import type { Pipeline, AlertRecord } from './types';
import { FREQUENCY_CONFIG, STATUS_CONFIG, ALERT_TYPE_CONFIG, ALERT_STATUS_CONFIG } from './constants';

export const buildPipelineColumns = (): ColumnsType<Pipeline> => [
  {
    title: '管道名称',
    dataIndex: 'name',
    key: 'name',
    width: 180,
    render: (text: string) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
  },
  {
    title: '源 → 目标',
    key: 'sourceTarget',
    width: 220,
    render: (_: unknown, record: Pipeline) => (
      <Space direction="vertical" size={0}>
        <Text style={{ fontSize: 12, color: colors.neutral[500] }}>源：{record.source}</Text>
        <Text style={{ fontSize: 12, color: colors.neutral[500] }}>目标：{record.target}</Text>
      </Space>
    ),
  },
  {
    title: '频率',
    dataIndex: 'frequency',
    key: 'frequency',
    width: 80,
    render: (freq: string) => (
      <Tag color={FREQUENCY_CONFIG[freq]?.color || colors.neutral[400]}>
        {FREQUENCY_CONFIG[freq]?.label || freq}
      </Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (st: string) => (
      <Tag color={STATUS_CONFIG[st]?.color || colors.neutral[400]}>
        {STATUS_CONFIG[st]?.label || st}
      </Tag>
    ),
  },
  {
    title: '最近运行',
    dataIndex: 'lastRun',
    key: 'lastRun',
    width: 150,
    render: (t: string) => <Text style={{ fontSize: 12 }}>{t}</Text>,
  },
  {
    title: '延迟(分)',
    dataIndex: 'latency',
    key: 'latency',
    width: 80,
    render: (val: number) => {
      if (val === 0) return <Text type="secondary">—</Text>;
      const color =
        val > 30 ? colors.error[500] : val > 10 ? colors.warning[500] : colors.success[500];
      return <Text style={{ color, fontWeight: 500 }}>{val}</Text>;
    },
  },
  {
    title: '成功率(%)',
    dataIndex: 'successRate',
    key: 'successRate',
    width: 90,
    render: (val: number) => {
      if (val === 0) return <Text type="secondary">—</Text>;
      const color =
        val >= 99 ? colors.success[500] : val >= 90 ? colors.warning[500] : colors.error[500];
      return <Text style={{ color, fontWeight: 500 }}>{val.toFixed(1)}%</Text>;
    },
  },
  {
    title: '操作',
    key: 'actions',
    width: 240,
    render: (_: unknown, record: Pipeline) => (
      <Space size="small" wrap>
        <Tooltip title="详情查看功能开发中">
          <Button size="small" type="link" icon={<EyeOutlined />} disabled>
            详情
          </Button>
        </Tooltip>
        <Tooltip title="手动触发功能开发中">
          <Button size="small" type="link" icon={<SyncOutlined />} disabled>
            触发
          </Button>
        </Tooltip>
        <Tooltip title="暂停/恢复功能开发中">
          <Switch
            size="small"
            checked={record.isPaused}
            checkedChildren="暂停"
            unCheckedChildren="运行"
            disabled
          />
        </Tooltip>
      </Space>
    ),
  },
];

export const buildAlertColumns = (): ColumnsType<AlertRecord> => [
  {
    title: '管道名',
    dataIndex: 'pipelineName',
    key: 'pipelineName',
    width: 160,
    render: (text: string) => <Text strong style={{ fontSize: 12 }}>{text}</Text>,
  },
  {
    title: '告警类型',
    dataIndex: 'alertType',
    key: 'alertType',
    width: 120,
    render: (t: string) => (
      <Tag color={ALERT_TYPE_CONFIG[t]?.color || colors.neutral[400]}>
        {ALERT_TYPE_CONFIG[t]?.label || t}
      </Tag>
    ),
  },
  {
    title: '描述',
    dataIndex: 'message',
    key: 'message',
    render: (text: string) => <Text style={{ fontSize: 12 }}>{text}</Text>,
  },
  {
    title: '时间',
    dataIndex: 'time',
    key: 'time',
    width: 160,
    render: (t: string) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {t}
      </Text>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    render: (st: string) => (
      <Tag color={ALERT_STATUS_CONFIG[st]?.color || colors.neutral[400]}>
        {ALERT_STATUS_CONFIG[st]?.label || st}
      </Tag>
    ),
  },
];
