/**
 * columns.tsx - Artifact 版本列表列定义
 * 抽取自 index.tsx (P2-9 Phase 210)
 */
import { Space, Button, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EyeOutlined, RocketOutlined } from '@ant-design/icons';
import type { ArtifactVersion } from '@/api/artifactVersions';
import { colors } from '@/tokens';
import { spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Text } = Typography;

export function buildArtifactVersionColumns(
  showDetail: (v: ArtifactVersion) => void,
  handleDeploy: (v: ArtifactVersion, env: string) => void
): ColumnsType<ArtifactVersion> {
  return [
    {
      title: 'Artifact',
      dataIndex: 'artifactName',
      width: 180,
      render: (v: string, r: ArtifactVersion) => (
        <Space direction="vertical" size={0}>
          <Text strong>{v}</Text>
          <Text type="secondary" style={{ fontSize: spacing[2] }}>
            v{r.version}
          </Text>
        </Space>
      ),
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 140,
      render: (v: string, r: ArtifactVersion) => (
        <Text
          strong
          style={{ cursor: 'pointer', color: colors.primary[500] }}
          onClick={() => showDetail(r)}
        >
          {v}
        </Text>
      ),
    },
    {
      title: '分支',
      dataIndex: 'branch',
      width: 120,
      render: (v: string) => (v ? <Tag color="geekblue">{v}</Tag> : '-'),
    },
    {
      title: 'Stage',
      dataIndex: 'stageName',
      width: 100,
    },
    {
      title: 'Commit',
      dataIndex: 'commitSha',
      width: 100,
      render: (v: string) => (v ? <Text code>{v.slice(0, 7)}</Text> : '-'),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '操作',
      width: 200,
      render: (_: unknown, r: ArtifactVersion) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => showDetail(r)}>
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<RocketOutlined />}
            onClick={() => handleDeploy(r, 'dev')}
          >
            部署到 dev
          </Button>
        </Space>
      ),
    },
  ];
}
