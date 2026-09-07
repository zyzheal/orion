/**
 * ChaosExperiment table columns
 * 抽取自 index.tsx (P2-9 Phase 132)
 */
import { Typography, Space, Tag, Button, Tooltip } from 'antd';
import { ExperimentOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { colors } from '@/tokens/colors';
import type { ChaosExperiment } from '@/api/chaos';
import { faultTypeConfig, statusConfig, envConfig } from './constants';

const { Text } = Typography;

interface ExperimentColumnsDeps {
  openDetail: (exp: ChaosExperiment) => void;
  handleRunExperiment: (experimentId: string) => void;
  runningId: string | null;
}

export const buildExperimentColumns = ({
  openDetail,
  handleRunExperiment,
  runningId,
}: ExperimentColumnsDeps): ColumnsType<ChaosExperiment> => [
  {
    title: '实验名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    render: (v: string, record?: ChaosExperiment) =>
      record ? (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => openDetail(record)}
          >
            <ExperimentOutlined style={{ marginRight: 6 }} />
            {v}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.description?.substring(0, 40) || '-'}
          </Text>
        </Space>
      ) : null,
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
    render: (_: unknown, record?: ChaosExperiment) =>
      record ? (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="link"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => openDetail(record)}
            />
          </Tooltip>
          {record.status === 'active' && (
            <Tooltip title="运行实验">
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                loading={runningId === record.id}
                onClick={() => handleRunExperiment(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      ) : null,
  },
];
