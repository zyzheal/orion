import { Button, Card, Empty, Space, Table, Tooltip, Typography } from 'antd';
import { CloudUploadOutlined, DiffOutlined, ExportOutlined, PlusOutlined, TagOutlined } from '@ant-design/icons';
import type { TabsProps } from 'antd';
import { componentRadius, spacing } from '@/tokens';
import type { PipelineVersion } from '@/api/pipeline-versions';
import type { ArtifactVersion } from '@/api/artifactVersions';
import { buildPipelineColumns, artifactColumns } from '../Columns';
import type { } from '../useVersionManagementState';

const { Text } = Typography;

const cardStyle = {
  borderRadius: componentRadius.card,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
};

interface Props {
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: (keys: React.Key[]) => void;
  pipelineVersions: PipelineVersion[];
  artifactVersions: ArtifactVersion[];
  loading: boolean;
  onCompare: () => void;
  onRollback: (record: PipelineVersion) => void;
  onSetBaseline: (record: PipelineVersion) => void;
}

export function VersionTabs({
  selectedRowKeys,
  setSelectedRowKeys,
  pipelineVersions,
  artifactVersions,
  loading,
  onCompare,
  onRollback,
  onSetBaseline,
}: Props): TabsProps['items'] {
  const pipelineColumns = buildPipelineColumns({ onRollback, onSetBaseline });
  return [
    {
      key: 'pipeline',
      label: (
        <Space>
          <CloudUploadOutlined />
          Pipeline 版本
        </Space>
      ),
      children: (
        <Card style={cardStyle}>
          <div style={{ marginBottom: spacing.md, display: 'flex', justifyContent: 'space-between' }}>
            <Space>
              <Tooltip title="版本由 Pipeline 运行自动生成">
                <Button type="primary" icon={<PlusOutlined />} disabled>
                  新建版本
                </Button>
              </Tooltip>
              <Button icon={<DiffOutlined />} onClick={onCompare} disabled={selectedRowKeys.length !== 2}>
                对比版本
              </Button>
            </Space>
            <Text type="secondary">选择 2 个版本进行对比</Text>
          </div>
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              type: 'checkbox',
            }}
            columns={pipelineColumns}
            dataSource={pipelineVersions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      ),
    },
    {
      key: 'artifact',
      label: (
        <Space>
          <TagOutlined />
          制品版本
        </Space>
      ),
      children: (
        <Card style={cardStyle}>
          <div style={{ marginBottom: spacing.md }}>
            <Tooltip title="制品版本由构建流程自动生成">
              <Button type="primary" icon={<PlusOutlined />} disabled>
                新建版本
              </Button>
            </Tooltip>
          </div>
          <Table
            columns={artifactColumns}
            dataSource={artifactVersions}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showSizeChanger: true }}
          />
        </Card>
      ),
    },
    {
      key: 'deploy',
      label: (
        <Space>
          <ExportOutlined />
          部署版本
        </Space>
      ),
      children: (
        <Card style={cardStyle}>
          <Empty description="部署版本数据由 Deploy 服务提供" />
        </Card>
      ),
    },
  ];
}
