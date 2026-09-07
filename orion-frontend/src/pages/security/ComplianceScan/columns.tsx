/**
 * ComplianceScan columns
 * 抽取自 index.tsx (P2-9 Phase 188)
 */
import { Button, Progress, Tag, Typography } from 'antd';
import { PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { ComplianceBaseline, ComplianceFinding, ComplianceLevel, FrameworkType, ScanStatus } from './types';
import { frameworkConfig, levelConfig, statusConfig } from './constants';
import { colors } from '@/tokens';

const { Text } = Typography;

interface BuildBaselineColumnsDeps {
  scanning: string | null;
  onScan: (id: string, name: string) => void;
}

export const buildBaselineColumns = (
  deps: BuildBaselineColumnsDeps
): ColumnsType<ComplianceBaseline> => [
  {
    title: '基线名称',
    dataIndex: 'name',
    key: 'name',
    render: (val: string) => <Text strong>{val}</Text>,
  },
  {
    title: '合规框架',
    dataIndex: 'framework',
    key: 'framework',
    width: 140,
    render: (val: string) => {
      const cfg = frameworkConfig[val as FrameworkType];
      return <Tag color={cfg?.color || 'default'}>{cfg?.label || val}</Tag>;
    },
  },
  {
    title: '规则数',
    dataIndex: 'rules',
    key: 'rules',
    width: 80,
  },
  {
    title: '合规率',
    dataIndex: 'passRate',
    key: 'passRate',
    width: 100,
    render: (val: number) => (
      <Progress
        type="circle"
        percent={val}
        size={40}
        strokeColor={val >= 80 ? colors.success[500] : val >= 50 ? colors.warning[500] : colors.error[500]}
      />
    ),
  },
  {
    title: '最后扫描',
    dataIndex: 'lastScan',
    key: 'lastScan',
    width: 160,
  },
  {
    title: '操作',
    key: 'action',
    width: 120,
    render: (_: unknown, record: ComplianceBaseline) => (
      <Button
        size="small"
        type="primary"
        icon={<PlayCircleOutlined />}
        loading={deps.scanning === record.id}
        onClick={() => deps.onScan(record.id, record.name)}
      >
        扫描
      </Button>
    ),
  },
];

export const buildFindingColumns = (): ColumnsType<ComplianceFinding> => [
  {
    title: '规则 ID',
    dataIndex: 'rule',
    key: 'rule',
    width: 120,
    render: (val: string) => <Text code>{val}</Text>,
  },
  {
    title: '检测目标',
    dataIndex: 'target',
    key: 'target',
    render: (val: string) => <Text>{val}</Text>,
  },
  {
    title: '风险等级',
    dataIndex: 'level',
    key: 'level',
    width: 90,
    render: (val: ComplianceLevel) => (
      <Tag color={levelConfig[val].color}>{levelConfig[val].label}</Tag>
    ),
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (val: ScanStatus) => (
      <Tag color={statusConfig[val].color}>{statusConfig[val].label}</Tag>
    ),
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  {
    title: '发现时间',
    dataIndex: 'detectedAt',
    key: 'detectedAt',
    width: 160,
  },
];
