/**
 * Build Log List Page
 * Table of build logs with search/filter and navigation to the log viewer.
 */
import React, { useState, useMemo, useEffect } from 'react';
import { Typography, Button, message } from 'antd';
import { spacing } from '@/tokens';
import { colors } from '@/tokens';
import { ReloadOutlined, EyeOutlined, FileTextOutlined,} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import StatusBadge from '@/components/StatusBadge';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import { getBuildLogs, type BuildLog } from '@/api/build-env';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const BuildLogList: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<BuildLog[]>([]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const response = await getBuildLogs();
      const apiData = response.data;
      setLogs(Array.isArray(apiData) ? apiData : (apiData as { items?: unknown[] })?.items ?? []);
    } catch (error: unknown) {
      if (error instanceof Error) {
        message.error(`加载构建日志失败：${error.message}`);
      } else {
        message.error('加载构建日志失败，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const searchable = [log.runId, log.stageId, log.podId].join(' ').toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      const runIdFilter = filters.runId;
      if (runIdFilter && runIdFilter !== 'all' && log.runId !== runIdFilter) return false;
      const stageIdFilter = filters.stageId;
      if (stageIdFilter && stageIdFilter !== 'all' && log.stageId !== stageIdFilter) return false;
      return true;
    });
  }, [searchQuery, filters, logs]);

  const filterDefs: FilterDefinition[] = [
    {
      key: 'runId',
      label: 'Run ID',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(logs.map((l) => l.runId)))
          .slice(0, 10)
          .map((id) => ({
            label: id,
            value: id,
          })),
      ],
    },
    {
      key: 'stageId',
      label: 'Stage ID',
      options: [
        { label: 'All', value: 'all' },
        ...Array.from(new Set(logs.map((l) => l.stageId)))
          .slice(0, 10)
          .map((id) => ({
            label: id,
            value: id,
          })),
      ],
    },
  ];

  const columns: TableColumn<BuildLog>[] = [
    {
      key: 'id',
      title: 'Log ID',
      dataIndex: 'id',
      width: 200,
      sortable: true,
      render: (value) => (
        <Text code style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'runId',
      title: 'Run ID',
      dataIndex: 'runId',
      width: 160,
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
      key: 'podId',
      title: 'Pod ID',
      dataIndex: 'podId',
      width: 200,
      render: (value) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (value) => {
        const statusMap: Record<string, any> = {
          streaming: 'running',
          completed: 'success',
          failed: 'failed',
        };
        return <StatusBadge status={statusMap[String(value)] || 'unknown'} size="small" />;
      },
    },
    {
      key: 'lineCount',
      title: 'Lines',
      dataIndex: 'lineCount',
      width: 100,
      sortable: true,
      render: (value) => <Text>{Number(value).toLocaleString()}</Text>,
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
      width: 100,
      render: (_: unknown, record: BuildLog) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/console/build-env/logs/${record.id}`)}
        >
          View
        </Button>
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
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <FileTextOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Build Logs
          </Title>
          <Text type="secondary">{filteredLogs.length} build logs</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadLogs} loading={loading}>
          Refresh
        </Button>
      </div>

      <div style={{ marginBottom: spacing.md }}>
        <SearchFilterBar
          onSearch={setSearchQuery}
          onFilter={setFilters}
          filters={filterDefs}
          searchPlaceholder="Search by run ID, stage ID, pod ID..."
        />
      </div>

      <Table
        columns={columns}
        dataSource={filteredLogs}
        loading={loading}
        rowKey="id"
        size="middle"
        striped
      />
    </div>
  );
};

export default BuildLogList;
