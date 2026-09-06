/**
 * OnCallColumns.tsx - OnCall 表格列定义
 * 抽取自 OnCall/index.tsx (P2-9 Phase 78)
 */
import { Typography, Space, Tag, Tooltip, Badge, Avatar, Button, Popconfirm } from 'antd';
import { EyeOutlined, SwapOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { colors } from '@/tokens/colors';
import { rotationTypeLabel, rotationTypeColor } from './constants';
import type { OnCallSchedule, CurrentOnCallResult } from '@/api/oncall';

const { Text } = Typography;

interface UseOnCallColumnsParams {
  currentOnCall: Record<string, CurrentOnCallResult>;
  resolveUserName: (userId: string) => string;
  openDetail: (schedule: OnCallSchedule) => void;
  openOverrideModal: (schedule: OnCallSchedule) => void;
  handleDelete: (id: string) => void;
}

export const makeOnCallColumns = ({
  currentOnCall,
  resolveUserName,
  openDetail,
  openOverrideModal,
  handleDelete,
}: UseOnCallColumnsParams) => [
  {
    title: '排班名称',
    dataIndex: 'name',
    key: 'name',
    width: 200,
    render: (text: string, record: OnCallSchedule) => (
      <Space direction="vertical" size={0}>
        <Text strong style={{ cursor: 'pointer' }} onClick={() => openDetail(record)}>
          {text}
        </Text>
        <Text type="secondary" style={{ fontSize: 12 }}>
          {record.timezone}
        </Text>
      </Space>
    ),
  },
  {
    title: '轮换方式',
    key: 'rotationType',
    width: 110,
    render: (_: unknown, record: OnCallSchedule) => (
      <Tag color={rotationTypeColor[record.rotationType]}>
        {rotationTypeLabel[record.rotationType]}
      </Tag>
    ),
  },
  {
    title: '当前值班',
    key: 'currentOnCall',
    width: 160,
    render: (_: unknown, record: OnCallSchedule) => {
      const oncall = currentOnCall[record.id];
      const userId = oncall?.primaryUserId || record.teamMembers[0];
      if (!userId) return <Text type="secondary">-</Text>;
      return (
        <Space>
          <Badge status={oncall?.isOnCall ? 'success' : 'default'} />
          <Avatar
            size="small"
            icon={<UserOutlined />}
            style={{ backgroundColor: colors.primary[500] }}
          />
          <Text>{resolveUserName(userId)}</Text>
        </Space>
      );
    },
  },
  {
    title: '团队成员',
    key: 'teamMembers',
    width: 240,
    render: (_: unknown, record: OnCallSchedule) => (
      <Space wrap>
        {record.teamMembers.slice(0, 3).map((uid) => (
          <Tag key={uid} icon={<UserOutlined />}>
            {resolveUserName(uid)}
          </Tag>
        ))}
        {record.teamMembers.length > 3 && <Tag>+{record.teamMembers.length - 3}</Tag>}
      </Space>
    ),
  },
  {
    title: '开始时间',
    key: 'startDate',
    width: 140,
    render: (_: unknown, record: OnCallSchedule) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(record.startDate).format('YYYY-MM-DD HH:mm')}
      </Text>
    ),
  },
  {
    title: '升级规则',
    key: 'escalations',
    width: 120,
    render: (_: unknown, record: OnCallSchedule) => {
      if (!record.escalations || record.escalations.length === 0) {
        return <Text type="secondary">无</Text>;
      }
      return (
        <Tooltip
          title={record.escalations
            .map(
              (e) =>
                `L${e.level}: ${e.timeoutMinutes}分钟 -> ${e.targets.map(resolveUserName).join(', ')}`,
            )
            .join('; ')}
        >
          <Tag color="orange">{record.escalations.length} 级</Tag>
        </Tooltip>
      );
    },
  },
  {
    title: '更新时间',
    key: 'updatedAt',
    width: 130,
    render: (_: unknown, record: OnCallSchedule) => (
      <Text type="secondary" style={{ fontSize: 12 }}>
        {dayjs(record.updatedAt).fromNow()}
      </Text>
    ),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (_: unknown, record: OnCallSchedule) => (
      <Space size="small" wrap>
        <Tooltip title="详情">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetail(record)}
          >
            详情
          </Button>
        </Tooltip>
        <Tooltip title="设置代班">
          <Button
            type="link"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => openOverrideModal(record)}
          >
            代班
          </Button>
        </Tooltip>
        <Tooltip title="删除">
          <Popconfirm title="确认删除该值班排班?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Tooltip>
      </Space>
    ),
  },
];
