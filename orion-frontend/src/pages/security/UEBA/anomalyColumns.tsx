/**
 * UEBA table columns
 * 抽取自 index.tsx (P2-9 Phase 135)
 */
import { Typography, Tag, Space, Button, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UserOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { colors } from '@/tokens';
import type { AnomalyEvent, EventStatus } from './types';
import { anomalyTypeColor, methodColor, commonStyle } from './constants';
import { getScoreColor } from './helpers';

const { Text } = Typography;

const statusIconMap: Record<EventStatus, React.ReactNode> = {
  待调查: <SearchOutlined />,
  已确认: <CheckCircleOutlined />,
  误报: <CloseCircleOutlined />,
};

const renderStatus = (status: EventStatus) => {
  const colorMap: Record<EventStatus, string> = {
    待调查: colors.neutral[400],
    已确认: commonStyle.success,
    误报: commonStyle.info,
  };
  return (
    <Tag color={colorMap[status]}>
      {statusIconMap[status]} {status}
    </Tag>
  );
};

export const buildAnomalyColumns = (): ColumnsType<AnomalyEvent> => [
  {
    title: '用户名',
    dataIndex: 'username',
    key: 'username',
    render: (text: string) => (
      <Space size={6}>
        <UserOutlined style={{ color: commonStyle.neutral }} />
        <Text strong>{text}</Text>
      </Space>
    ),
  },
  {
    title: '异常类型',
    dataIndex: 'type',
    key: 'type',
    render: (type: AnomalyEvent['type']) => <Tag color={anomalyTypeColor[type]}>{type}</Tag>,
  },
  {
    title: '风险评分',
    dataIndex: 'score',
    key: 'score',
    render: (score: number) => {
      const color = getScoreColor(score);
      return (
        <Space size={6}>
          <Text strong style={{ color }}>
            {score}
          </Text>
          <Progress
            percent={score}
            size="small"
            strokeColor={color}
            trailColor={colors.neutral[100]}
            style={
              { width: 60 } as React.CSSProperties
            }
          />
        </Space>
      );
    },
  },
  {
    title: '检测方法',
    dataIndex: 'method',
    key: 'method',
    render: (method: AnomalyEvent['method']) => (
      <Tag color={methodColor[method]}>{method}</Tag>
    ),
  },
  {
    title: '发生时间',
    dataIndex: 'time',
    key: 'time',
    render: (text: string) => <Text type="secondary">{text}</Text>,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: EventStatus) => renderStatus(status),
  },
  {
    title: '操作',
    key: 'action',
    render: () => (
      <Space size={6}>
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          style={{ color: commonStyle.primary }}
          disabled
        >
          详情
        </Button>
        <Button
          type="link"
          size="small"
          icon={<CheckCircleOutlined />}
          style={{ color: commonStyle.success }}
          disabled
        >
          确认异常
        </Button>
        <Button
          type="link"
          size="small"
          icon={<CloseCircleOutlined />}
          style={{ color: commonStyle.info }}
          disabled
        >
          误报
        </Button>
      </Space>
    ),
  },
];
