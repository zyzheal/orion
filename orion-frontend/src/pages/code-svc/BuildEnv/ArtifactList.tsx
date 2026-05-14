/**
 * Artifact List Page
 * Table of build artifacts with download, delete, and cleanup actions.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, Space, Tag, Popconfirm, message } from 'antd';
import { spacing } from '@/tokens';
import {
  ReloadOutlined,
  DownloadOutlined,
  DeleteOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import {
  getArtifacts,
  downloadArtifact,
  deleteArtifact,
  cleanupExpiredArtifacts,
  type Artifact,
} from '@/api/build-env';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const ArtifactList: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [artifacts, setArtifacts] = useState<any[]>([]);

  const loadArtifacts = async () => {
    setLoading(true);
    try {
      const response = await getArtifacts();
      const apiData = response.data.data;
      setArtifacts(Array.isArray(apiData) ? apiData : (apiData as any).items || []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载构建产物失败：${error.message}`);
      } else {
        message.error('加载构建产物失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtifacts();
  }, []);

  const filteredArtifacts = useMemo(() => {
    return artifacts.filter((artifact) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [artifact.name, artifact.type, artifact.pipelineRunId, artifact.stageId]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const typeFilter = filters.type;
      if (typeFilter && typeFilter !== 'all' && artifact.type !== typeFilter) return false;
      const runIdFilter = filters.pipelineRunId;
      if (runIdFilter && runIdFilter !== 'all' && artifact.pipelineRunId !== runIdFilter)
        return false;
      return true;
    });
  }, [searchQuery, filters, artifacts]);

  const handleDownload = async (artifact: Artifact) => {
    try {
      const response = await downloadArtifact(artifact.id);
      const blob = new Blob([response.data as unknown as BlobPart], {
        type: 'application/octet-stream',
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = artifact.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      message.success(`Downloading ${artifact.name}`);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`下载构建产物失败：${error.message}`);
      } else {
        message.error('下载构建产物失败，请稍后重试');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteArtifact(id);
      message.success('Artifact deleted');
      loadArtifacts();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`删除构建产物失败：${error.message}`);
      } else {
        message.error('删除构建产物失败，请稍后重试');
      }
    }
  };

  const handleCleanup = async () => {
    try {
      await cleanupExpiredArtifacts();
      message.success('Expired artifacts cleaned up');
      loadArtifacts();
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`清理构建产物失败：${error.message}`);
      } else {
        message.error('清理构建产物失败，请稍后重试');
      }
    }
  };

  const filterDefs: FilterDefinition[] = [
    {
      key: 'type',
      label: 'Type',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(artifacts.map((a) => a.type))).map((t) => ({
          label: t,
          value: t,
        })),
      ],
    },
    {
      key: 'pipelineRunId',
      label: 'Run ID',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(artifacts.map((a) => a.pipelineRunId)))
          .slice(0, 10)
          .map((id) => ({
            label: id,
            value: id,
          })),
      ],
    },
  ];

  const columns: TableColumn<Artifact>[] = [
    {
      key: 'name',
      title: 'Name',
      dataIndex: 'name',
      width: 250,
      sortable: true,
      render: (value) => <Text strong>{String(value)}</Text>,
    },
    {
      key: 'type',
      title: 'Type',
      dataIndex: 'type',
      width: 140,
      render: (value) => <Tag color="blue">{String(value)}</Tag>,
    },
    {
      key: 'size',
      title: 'Size',
      dataIndex: 'size',
      width: 120,
      sortable: true,
      render: (value) => {
        const bytes = Number(value);
        if (bytes >= 1024 * 1024 * 1024)
          return <Text>{(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB</Text>;
        if (bytes >= 1024 * 1024) return <Text>{(bytes / (1024 * 1024)).toFixed(1)} MB</Text>;
        if (bytes >= 1024) return <Text>{(bytes / 1024).toFixed(1)} KB</Text>;
        return <Text>{bytes} B</Text>;
      },
    },
    {
      key: 'pipelineRunId',
      title: 'Run ID',
      dataIndex: 'pipelineRunId',
      width: 180,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'stageId',
      title: 'Stage ID',
      dataIndex: 'stageId',
      width: 160,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'expiresAt',
      title: 'Expires',
      dataIndex: 'expiresAt',
      width: 160,
      sortable: true,
      render: (value) => {
        const expiry = dayjs(String(value));
        const isExpired = expiry.isBefore(dayjs());
        return (
          <Text type={isExpired ? 'danger' : 'secondary'} style={{ fontSize: spacing[3] }}>
            {expiry.fromNow()}
          </Text>
        );
      },
    },
    {
      key: 'createdAt',
      title: 'Created',
      dataIndex: 'createdAt',
      width: 140,
      sortable: true,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(String(value)).fromNow()}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      width: 160,
      render: (_: unknown, record: Artifact) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownload(record)}
          >
            Download
          </Button>
          <Popconfirm
            title="Delete this artifact?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            Artifacts
          </Title>
          <Text type="secondary">{filteredArtifacts.length} artifacts</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadArtifacts} loading={loading}>
            Refresh
          </Button>
          <Button icon={<ThunderboltOutlined />} onClick={handleCleanup}>
            Cleanup Expired
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="Search by name, type, run ID..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredArtifacts}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default ArtifactList;
