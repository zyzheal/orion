import { Button, Popconfirm, Space, Tag, Tooltip } from 'antd';
import { DeleteOutlined, ExportOutlined, RollbackOutlined, TagOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PipelineVersion } from '@/api/pipeline-versions';
import type { ArtifactVersion } from '@/api/artifactVersions';

interface PipelineColumnsProps {
  onRollback: (record: PipelineVersion) => void;
  onSetBaseline: (record: PipelineVersion) => void;
}

export function buildPipelineColumns({ onRollback, onSetBaseline }: PipelineColumnsProps): ColumnsType<PipelineVersion> {
  return [
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: 'Pipeline', dataIndex: 'pipelineName', key: 'pipelineName' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'success' ? 'green' : status === 'failed' ? 'red' : 'default'}>
          {status}
        </Tag>
      ),
    },
    {
      title: '基线',
      dataIndex: 'isBaseline',
      key: 'isBaseline',
      render: (isBaseline: boolean) =>
        isBaseline ? <Tag color="blue">基线</Tag> : <Tag>普通</Tag>,
    },
    { title: '创建人', dataIndex: 'createdBy', key: 'createdBy' },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: PipelineVersion) => (
        <Space size="small">
          <Tooltip title="回滚到此版本">
            <Button size="small" icon={<RollbackOutlined />} onClick={() => onRollback(record)}>
              回滚
            </Button>
          </Tooltip>
          <Tooltip title="设为基线版本">
            <Button size="small" icon={<TagOutlined />} onClick={() => onSetBaseline(record)}>
              基线
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];
}

export const artifactColumns: ColumnsType<ArtifactVersion> = [
  { title: '版本', dataIndex: 'version', key: 'version' },
  { title: '制品名', dataIndex: 'artifactName', key: 'artifactName' },
  { title: '构建号', dataIndex: 'buildNumber', key: 'buildNumber' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    render: (status: string) => (
      <Tag color={status === 'published' ? 'green' : status === 'draft' ? 'orange' : 'default'}>
        {status}
      </Tag>
    ),
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    render: (d: string) => new Date(d).toLocaleString(),
  },
  {
    title: '操作',
    key: 'action',
    render: () => (
      <Space size="small">
        <Tooltip title="查看部署历史">
          <Button size="small" icon={<ExportOutlined />}>
            部署
          </Button>
        </Tooltip>
        <Popconfirm title="确认删除此版本？">
          <Button size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    ),
  },
];
