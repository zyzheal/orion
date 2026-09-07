/**
 * AICMDBRecommendation table columns
 * 抽取自 index.tsx (P2-9 Phase 139)
 */
import { Typography, Space, Tag, Button, Popconfirm } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type {
  RecommendationItem,
  RecommendationType,
  RecommendationStatus,
} from '@/api/cmdb';
import { getConfidenceColor, getConfidenceLabel, typeConfig, statusConfig } from './constants';

const { Text } = Typography;

interface RecommendationColumnsDeps {
  handleAccept: (id: string) => void;
  handleReject: (id: string) => void;
}

export const buildRecommendationColumns = ({
  handleAccept,
  handleReject,
}: RecommendationColumnsDeps): ColumnsType<RecommendationItem> => [
  {
    title: '推荐类型',
    dataIndex: 'type',
    key: 'type',
    width: 100,
    render: (value) => {
      const cfg = typeConfig[value as RecommendationType];
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: '源 CI',
    dataIndex: 'sourceCI',
    key: 'sourceCI',
    width: 150,
    render: (_value, record) => (
      <Text style={{ fontSize: 12 }}>{record.sourceCiName || record.sourceCi}</Text>
    ),
  },
  {
    title: '目标 / 建议',
    dataIndex: 'targetCI',
    key: 'targetCI',
    render: (_value, record) => (
      <Space direction="vertical" size={2}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {String(
            (record as unknown as { targetCIName?: string; targetCI?: string }).targetCIName ||
              (record as unknown as { targetCIName?: string; targetCI?: string }).targetCI
          )}
        </Text>
        <Text style={{ fontSize: 12 }}>{record.suggestion}</Text>
      </Space>
    ),
  },
  {
    title: '置信度',
    dataIndex: 'confidence',
    key: 'confidence',
    width: 100,
    render: (value) => {
      const conf = Number(value);
      return (
        <Tag color={getConfidenceLabel(conf)} style={{ color: getConfidenceColor(conf) }}>
          {conf.toFixed(0)}%
        </Tag>
      );
    },
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (value) => {
      const cfg = statusConfig[value as RecommendationStatus];
      return <Tag color={cfg.color}>{cfg.label}</Tag>;
    },
  },
  {
    title: '推荐时间',
    dataIndex: 'recommendTime',
    key: 'recommendTime',
    width: 160,
    render: (value) => <Text style={{ fontSize: 12 }}>{String(value) || '-'}</Text>,
  },
  {
    title: '操作',
    key: 'action',
    dataIndex: 'action',
    width: 120,
    render: (_value, record) => {
      if (record.status !== 'pending') return <Text type="secondary">-</Text>;
      return (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<CheckOutlined />}
            onClick={() => handleAccept(record.id)}
          >
            采纳
          </Button>
          <Popconfirm
            title="确认拒绝该推荐？"
            description="拒绝后该推荐将从待确认列表中移除"
            onConfirm={() => handleReject(record.id)}
            okText="拒绝"
            okButtonProps={{ danger: true }}
            cancelText="取消"
          >
            <Button size="small" danger icon={<CloseOutlined />}>
              拒绝
            </Button>
          </Popconfirm>
        </Space>
      );
    },
  },
];
