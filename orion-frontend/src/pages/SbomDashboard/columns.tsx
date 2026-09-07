/**
 * SBOM Dashboard table column builders
 */
import { Button, Space, Tag, Typography } from 'antd';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import type { TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import type { SbomDocument } from './types';
import { SBOM_STATUS_TO_BADGE } from './constants';

dayjs.extend(relativeTime);

const { Text } = Typography;

interface BuildColumnsDeps {
  navigate: (path: string) => void;
}

export function buildSbomColumns(deps: BuildColumnsDeps): TableColumn<SbomDocument>[] {
  const { navigate } = deps;
  return [
    {
      key: 'documentId',
      title: 'Document',
      dataIndex: 'documentId',
      width: 200,
      sortable: true,
      render: (_value: unknown, record: SbomDocument) => (
        <Space direction="vertical" size={0}>
          <Text
            strong
            style={{ cursor: 'pointer', color: colors.primary[500] }}
            onClick={() => navigate(`/sbom/${record.id}`)}
          >
            {record.documentId}
          </Text>
          <Text type="secondary" style={{ fontSize: spacing[3] }}>
            Build: {record.buildId}
          </Text>
        </Space>
      ),
    },
    {
      key: 'format',
      title: '格式',
      dataIndex: 'format',
      width: 120,
      render: (value: unknown) => (
        <Tag color={String(value) === 'cyclonedx' ? 'green' : 'blue'}>{String(value)}</Tag>
      ),
    },
    {
      key: 'packageCount',
      title: '包数量',
      dataIndex: 'packageCount',
      width: 100,
      sortable: true,
      render: (value: unknown) => <Text>{String(value)}</Text>,
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 120,
      render: (value: unknown) => (
        <StatusBadge status={SBOM_STATUS_TO_BADGE[String(value)] || 'unknown'} size="small" />
      ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 160,
      render: (_: unknown, record: SbomDocument) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/sbom/${record.id}`)}
          >
            查看
          </Button>
          <Button type="link" size="small" icon={<DownloadOutlined />}>
            下载
          </Button>
        </Space>
      ),
    },
  ];
}
