/**
 * columns.tsx - DisasterRecovery 表格列
 * 抽取自 DisasterRecovery/index.tsx (P2-9 Phase 100)
 */
import { Space, Tag, Button, Tooltip, Typography } from 'antd';
import { DatabaseOutlined, ClockCircleOutlined, ExperimentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens';
import {
  type RtoRpoRecord,
  type DrillRecord,
  type RtoRpoStatus,
  type DrillResult,
  type DrLevel,
  statusConfig,
  drLevelConfig,
  drillResultConfig,
} from './constants';

const { Text } = Typography;

interface RtoRpoColumnDeps {
  rtoRpoRecords: RtoRpoRecord[];
  selectedRecordId: string | null;
  testingType: 'rto' | 'rpo' | null;
  handleTest: (id: string, type: 'rto' | 'rpo') => void;
}

export const buildRtoRpoColumns = (deps: RtoRpoColumnDeps): ColumnsType<RtoRpoRecord> => {
  const { rtoRpoRecords, selectedRecordId, testingType, handleTest } = deps;
  return [
    {
      title: '系统/服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (v: string) => (
        <Space>
          <DatabaseOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'RTO 目标',
      dataIndex: 'rtoTarget',
      key: 'rtoTarget',
      render: (v: number) => `${v} min`,
    },
    {
      title: 'RTO 实际',
      dataIndex: 'rtoActual',
      key: 'rtoActual',
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">-</Text>;
        const record = rtoRpoRecords.find((r) => r.rtoActual === v);
        const isOver = record && v > record.rtoTarget;
        return (
          <Text style={{ color: isOver ? colors.error[500] : colors.success[500] }}>
            {v} min {isOver ? '↑' : '✓'}
          </Text>
        );
      },
    },
    {
      title: 'RPO 目标',
      dataIndex: 'rpoTarget',
      key: 'rpoTarget',
      render: (v: number) => `${v} min`,
    },
    {
      title: 'RPO 实际',
      dataIndex: 'rpoActual',
      key: 'rpoActual',
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">-</Text>;
        const record = rtoRpoRecords.find((r) => r.rpoActual === v);
        const isOver = record && v > record.rpoTarget;
        return (
          <Text style={{ color: isOver ? colors.error[500] : colors.success[500] }}>
            {v} min {isOver ? '↑' : '✓'}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: RtoRpoStatus) => {
        const cfg = statusConfig[v];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '灾备级别',
      dataIndex: 'drLevel',
      key: 'drLevel',
      render: (v: DrLevel) => {
        const cfg = drLevelConfig[v];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: RtoRpoRecord) => (
        <Space size={4}>
          <Tooltip title="测试 RTO">
            <Button
              type="text"
              size="small"
              icon={<ClockCircleOutlined />}
              disabled={record.status === 'untested'}
              loading={selectedRecordId === record.id && testingType === 'rto'}
              onClick={() => handleTest(record.id, 'rto')}
            />
          </Tooltip>
          <Tooltip title="测试 RPO">
            <Button
              type="text"
              size="small"
              icon={<ExperimentOutlined />}
              disabled={record.status === 'untested'}
              loading={selectedRecordId === record.id && testingType === 'rpo'}
              onClick={() => handleTest(record.id, 'rpo')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];
};

export const buildDrillColumns = (): ColumnsType<DrillRecord> => [
  {
    title: '时间',
    dataIndex: 'time',
    key: 'time',
    render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
  },
  {
    title: '类型',
    dataIndex: 'drillType',
    key: 'drillType',
  },
  {
    title: '结果',
    dataIndex: 'result',
    key: 'result',
    render: (v: DrillResult) => {
      const cfg = drillResultConfig[v];
      return (
        <Tag color={cfg.color} icon={cfg.icon}>
          {cfg.label}
        </Tag>
      );
    },
  },
  {
    title: '耗时',
    dataIndex: 'duration',
    key: 'duration',
    render: (v: number) => `${v} min`,
  },
];
