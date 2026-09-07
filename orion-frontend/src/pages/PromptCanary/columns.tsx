/**
 * PromptCanary columns
 * 抽取自 index.tsx (P2-9 Phase 183)
 */
import { Button, Space, Tag, Typography } from 'antd';
import { CodeOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PromptVersionInfo, PromptCanaryStatus } from './types';

const { Text } = Typography;

export const buildVersionColumns = (): ColumnsType<PromptVersionInfo> => [
  {
    title: '版本 ID',
    dataIndex: 'version',
    key: 'version',
    render: (val: string) => <Tag>v{val}</Tag>,
  },
  {
    title: '角色',
    key: 'role',
    width: 120,
    render: (_, record: PromptVersionInfo) => {
      if (record.is_active) return <Tag color="green">Active</Tag>;
      if (record.is_canary) return <Tag color="orange">Canary</Tag>;
      return <Tag>历史</Tag>;
    },
  },
  {
    title: '流量占比',
    dataIndex: 'traffic_percent',
    key: 'traffic_percent',
    width: 100,
    render: (val: number) => `${val}%`,
  },
  {
    title: '内容预览',
    dataIndex: 'content_preview',
    key: 'content_preview',
    ellipsis: { showTitle: true },
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 160,
  },
];

interface PromptColumnsDeps {
  onViewDetail: (name: string) => void;
}

export const buildPromptColumns = ({ onViewDetail }: PromptColumnsDeps): ColumnsType<PromptCanaryStatus> => [
  {
    title: 'Prompt 名称',
    dataIndex: 'name',
    key: 'name',
    render: (val: string) => (
      <Space>
        <CodeOutlined />
        <Text strong>{val}</Text>
      </Space>
    ),
  },
  {
    title: 'Active 版本',
    dataIndex: 'active_version',
    key: 'active_version',
    render: (val: string) => <Tag color="green">v{val}</Tag>,
  },
  {
    title: 'Canary 版本',
    key: 'canary_version',
    render: (_, record: PromptCanaryStatus) =>
      record.canary_version ? (
        <Tag color="orange">v{record.canary_version} ({record.traffic_percent}%)</Tag>
      ) : (
        <Tag>-</Tag>
      ),
  },
  {
    title: '版本总数',
    key: 'version_count',
    render: (_, record: PromptCanaryStatus) => record.versions?.length || 0,
    width: 100,
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (_, record: PromptCanaryStatus) => (
      <Button
        size="small"
        type="primary"
        icon={<EyeOutlined />}
        onClick={() => onViewDetail(record.name)}
      >
        详情
      </Button>
    ),
  },
];
