/**
 * Version Compare Drawer - Shows diff between two artifact versions
 * Displays: commit diff, branch diff, metadata changes
 */
import React from 'react';
import {
  Drawer,
  Descriptions,
  Tag,
  Table as AntTable,
  Space,
  Typography,
  Alert,
  Divider,
  Card,
  Empty,
} from 'antd';
import {
  ArrowRightOutlined,
  PlusOutlined,
  MinusOutlined,
  EditOutlined,
  GithubOutlined,
  BranchesOutlined,
} from '@ant-design/icons';
import type { ArtifactVersion, VersionDiff } from '@/api/artifactVersions';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface VersionCompareDrawerProps {
  open: boolean;
  onClose: () => void;
  versionA: ArtifactVersion | null;
  versionB: ArtifactVersion | null;
  diff: VersionDiff | null;
  loading: boolean;
}

const VersionCompareDrawer: React.FC<VersionCompareDrawerProps> = ({
  open,
  onClose,
  versionA,
  versionB,
  diff,
  loading,
}) => {
  // Metadata diff table columns
  const metaDiffColumns = [
    {
      title: '变更类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: string) => {
        if (type === 'added') return <Tag color="green"><PlusOutlined /> 新增</Tag>;
        if (type === 'removed') return <Tag color="red"><MinusOutlined /> 删除</Tag>;
        return <Tag color="blue"><EditOutlined /> 变更</Tag>;
      },
    },
    {
      title: '键',
      dataIndex: 'key',
      key: 'key',
      width: 150,
    },
    {
      title: '版本 A',
      dataIndex: 'oldValue',
      key: 'oldValue',
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
    {
      title: '版本 B',
      dataIndex: 'newValue',
      key: 'newValue',
      render: (v: string) => v || <Text type="secondary">-</Text>,
    },
  ];

  // Build metadata diff data
  const metaDiffData = React.useMemo(() => {
    if (!diff) return [];
    const rows: Array<{ key: string; type: string; oldValue?: string; newValue?: string }> = [];

    diff.changes.metadataAdded.forEach((k) =>
      rows.push({ key: k, type: 'added', newValue: versionB?.metadata[k] })
    );
    diff.changes.metadataRemoved.forEach((k) =>
      rows.push({ key: k, type: 'removed', oldValue: versionA?.metadata[k] })
    );
    diff.changes.metadataChanged.forEach((c) =>
      rows.push({ key: c.key, type: 'changed', oldValue: c.oldValue, newValue: c.newValue })
    );

    return rows;
  }, [diff, versionA, versionB]);

  return (
    <Drawer
      title="版本对比"
      open={open}
      onClose={onClose}
      width={720}
      destroyOnClose
    >
      {!versionA || !versionB ? (
        <Empty description="请选择两个版本进行对比" />
      ) : (
        <>
          {/* Version Headers */}
          <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 24 }}>
            <Card size="small" style={{ flex: 1 }}>
              <Title level={5} style={{ margin: 0 }}>
                版本 A: {versionA.version}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(versionA.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Card>
            <ArrowRightOutlined style={{ fontSize: 20, color: '#999', margin: '0 12px' }} />
            <Card size="small" style={{ flex: 1 }}>
              <Title level={5} style={{ margin: 0 }}>
                版本 B: {versionB.version}
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {dayjs(versionB.createdAt).format('YYYY-MM-DD HH:mm:ss')}
              </Text>
            </Card>
          </Space>

          {/* Basic Info Comparison */}
          <Descriptions
            bordered
            size="small"
            title="基本信息对比"
            column={1}
            style={{ marginBottom: 16 }}
          >
            <Descriptions.Item label="Commit SHA">
              <Space>
                {versionA.commitSha ? (
                  <Text code style={{ fontSize: 11 }}>{versionA.commitSha.slice(0, 7)}</Text>
                ) : (
                  <Text type="secondary">-</Text>
                )}
                <ArrowRightOutlined style={{ fontSize: 12, color: '#999' }} />
                {versionB.commitSha ? (
                  <Text code style={{ fontSize: 11 }}>{versionB.commitSha.slice(0, 7)}</Text>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="分支">
              <Space>
                {versionA.branch ? (
                  <Tag color="geekblue">{versionA.branch}</Tag>
                ) : (
                  <Text type="secondary">-</Text>
                )}
                <ArrowRightOutlined style={{ fontSize: 12, color: '#999' }} />
                {versionB.branch ? (
                  <Tag color="geekblue">{versionB.branch}</Tag>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Space>
            </Descriptions.Item>
            <Descriptions.Item label="阶段">
              <Space>
                <Tag color="blue">{versionA.stageName}</Tag>
                <ArrowRightOutlined style={{ fontSize: 12, color: '#999' }} />
                <Tag color="blue">{versionB.stageName}</Tag>
              </Space>
            </Descriptions.Item>
          </Descriptions>

          {/* Commit & Branch Diff Summary */}
          {diff && (
            <>
              <Title level={5}>
                <GithubOutlined /> 代码变更
              </Title>
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message={
                  <Space>
                    <span>Commit: </span>
                    <Text code style={{ fontSize: 11 }}>
                      {diff.changes.commitDiff?.from?.slice(0, 7) || 'unknown'}
                    </Text>
                    <ArrowRightOutlined style={{ fontSize: 12 }} />
                    <Text code style={{ fontSize: 11 }}>
                      {diff.changes.commitDiff?.to?.slice(0, 7) || 'unknown'}
                    </Text>
                    {diff.changes.branchDiff?.from !== diff.changes.branchDiff?.to && (
                      <>
                        <Divider type="vertical" />
                        <BranchesOutlined />
                        <span>分支: </span>
                        <Tag color="geekblue" style={{ fontSize: 11 }}>
                          {diff.changes.branchDiff?.from || 'unknown'}
                        </Tag>
                        <ArrowRightOutlined style={{ fontSize: 12 }} />
                        <Tag color="geekblue" style={{ fontSize: 11 }}>
                          {diff.changes.branchDiff?.to || 'unknown'}
                        </Tag>
                      </>
                    )}
                  </Space>
                }
              />

              {/* Metadata Changes */}
              <Title level={5}>
                <EditOutlined /> 元数据变更
              </Title>
              {metaDiffData.length > 0 ? (
                <AntTable
                  columns={metaDiffColumns}
                  dataSource={metaDiffData}
                  rowKey="key"
                  size="small"
                  pagination={false}
                  loading={loading}
                />
              ) : (
                <Empty description="无元数据变更" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              )}

              {/* Summary */}
              <Divider />
              <Space style={{ marginTop: 8 }}>
                {diff.changes.metadataAdded.length > 0 && (
                  <Tag color="green">+{diff.changes.metadataAdded.length} 新增</Tag>
                )}
                {diff.changes.metadataRemoved.length > 0 && (
                  <Tag color="red">-{diff.changes.metadataRemoved.length} 删除</Tag>
                )}
                {diff.changes.metadataChanged.length > 0 && (
                  <Tag color="blue">~{diff.changes.metadataChanged.length} 变更</Tag>
                )}
                {metaDiffData.length === 0 && (
                  <Tag color="default">无变更</Tag>
                )}
              </Space>
            </>
          )}
        </>
      )}
    </Drawer>
  );
};

export default VersionCompareDrawer;
