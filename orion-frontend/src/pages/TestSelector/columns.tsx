/**
 * TestSelector table columns
 * 抽取自 index.tsx (P2-9 Phase 173)
 */
import { Typography, Tag, Space, Button, message } from 'antd';
import { PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { colors } from '@/tokens';
import type { TableColumn } from '@/components/Table';
import type { TestCase } from './types';
import { getStatusColor, getStatusLabel, getStatusIcon } from './constants';

const { Text } = Typography;

export function buildColumns(): TableColumn<TestCase>[] {
  return [
    {
      key: 'name',
      title: 'Test Name',
      dataIndex: 'name',
      sortable: true,
      render: (value: unknown) => (
        <Text
          strong
          style={{
            maxWidth: 320,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={String(value)}
        >
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'suite',
      title: 'Suite',
      dataIndex: 'suite',
      sortable: true,
      filterable: true,
      render: (value: unknown) => <Tag color={colors.primary[400]}>{String(value)}</Tag>,
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      sortable: true,
      render: (_value: unknown, record: TestCase) => (
        <Tag color={getStatusColor(record.status)} icon={getStatusIcon(record.status)}>
          {getStatusLabel(record.status)}
        </Tag>
      ),
    },
    {
      key: 'duration',
      title: 'Duration',
      dataIndex: 'duration',
      sortable: true,
    },
    {
      key: 'lastRun',
      title: 'Last Run',
      dataIndex: 'lastRun',
      sortable: true,
    },
    {
      key: 'tags',
      title: 'Tags',
      dataIndex: 'tags',
      filterable: true,
      render: (value: unknown) => (
        <Space size={4} wrap>
          {(value as string[]).map((tag) => (
            <Tag key={tag} color={colors.neutral[300]} style={{ fontSize: 11 }}>
              {tag}
            </Tag>
          ))}
        </Space>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      render: (_value: unknown, record: TestCase) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<PlayCircleOutlined />}
            style={{ color: colors.primary[500], padding: 0 }}
            onClick={() => {
              message.info(`Running test: ${record.name}`);
            }}
          >
            Run
          </Button>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            style={{ color: colors.neutral[500], padding: 0 }}
            onClick={() => {
              message.info(`Viewing detail: ${record.name}`);
            }}
          >
            Detail
          </Button>
        </Space>
      ),
    },
  ];
}
