/**
 * APK Upload History Page
 * View and manage APK upload history records
 */
import React, { useState, useEffect } from 'react';
import {
  Typography,
  Card,
  Table,
  Tag,
  Space,
  Button,
  Select,
  Statistic,
  Row,
  Col,
  Empty,
} from 'antd';
import {
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useAuthStore } from '@/stores/authStore';
import {
  getApkUploadHistory,
  getRecentFailures,
  getApkUploadStats,
  MARKET_NAMES,
  STATUS_CONFIG,
  type ApkUploadRecord,
  type ApkUploadStatus,
} from '@/api/apk-upload-history';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const ApkUploadHistoryPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ApkUploadRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [recentFailures, setRecentFailures] = useState<ApkUploadRecord[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    failed: 0,
    uploading: 0,
  });
  const [filters, setFilters] = useState<{
    market?: string;
    status?: ApkUploadStatus;
  }>({});
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
  });

  const tenantId = useAuthStore((state) => (state.user as any).tenantId) || 'default-tenant';

  useEffect(() => {
    loadHistory();
    loadRecentFailures();
    loadStats();
  }, [tenantId, pagination.current, pagination.pageSize, filters]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const offset = (pagination.current - 1) * pagination.pageSize;
      const response = await getApkUploadHistory(tenantId, {
        limit: pagination.pageSize,
        offset,
        market: filters.market,
        status: filters.status,
      });

      const resData = response.data as { data?: { data?: ApkUploadRecord[]; total?: number } };
      const data = Array.isArray(resData.data) ? resData.data : [];
      setRecords(data);
      setTotal(resData?.data?.total ?? 0);
    } catch (error) {
      console.error('Failed to load upload history:', error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentFailures = async () => {
    try {
      const response = await getRecentFailures(tenantId, 5);
      const resData = response.data as { data?: { data?: ApkUploadRecord[] } };
      setRecentFailures(Array.isArray(resData.data) ? resData.data : []);
    } catch (error) {
      console.error('Failed to load recent failures:', error);
      setRecentFailures([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getApkUploadStats(tenantId);
      const resData = response.data as { data?: { data?: { total?: number; published?: number; failed?: number; uploading?: number } } };
      if (resData?.data?.data) {
        setStats({
          total: (resData.data as any).total,
          published: (resData.data as any).published,
          failed: (resData.data as any).failed,
          uploading: (resData.data as any).uploading,
        });
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTableChange = (newPagination: any) => {
    setPagination({
      current: newPagination.current,
      pageSize: newPagination.pageSize,
    });
  };

  // Statistics - use total data from stats API, not current page
  const displayStats = {
    total: stats.total,
    published: stats.published,
    failed: stats.failed,
    uploading: stats.uploading,
  };

  const columns = [
    {
      title: '应用市场',
      dataIndex: 'market',
      key: 'market',
      render: (market: string) => (
        <Tag color="blue">{MARKET_NAMES[market] || market}</Tag>
      ),
    },
    {
      title: '包名',
      dataIndex: 'packageName',
      key: 'packageName',
      render: (pkg: string) => <code>{pkg}</code>,
    },
    {
      title: '版本',
      dataIndex: 'versionName',
      key: 'versionName',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: ApkUploadStatus) => {
        const config = STATUS_CONFIG[status];
        return <Tag color={config.color}>{config.text}</Tag>;
      },
    },
    {
      title: '上传地址',
      dataIndex: 'uploadUrl',
      key: 'uploadUrl',
      render: (url: string) => url ? (
        <a href={url} target="_blank" rel="noopener noreferrer">查看</a>
      ) : '-',
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      render: (ms: number) => ms ? `${(ms / 1000).toFixed(1)}s` : '-',
    },
    {
      title: '上传时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => dayjs(date).fromNow(),
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      <div style={{ marginBottom: spacing.lg }}>
        <Title level={2} style={{ marginBottom: spacing.sm, display: 'flex', alignItems: 'center' }}>
          <AppstoreOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
          APK 上传历史
        </Title>
        <Text type="secondary">查看和管理 APK 上传到各应用市场的历史记录</Text>
      </div>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: spacing.lg }}>
        <Col span={6}>
          <Card>
            <Statistic title="总上传次数" value={displayStats.total} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="成功发布"
              value={displayStats.published}
              valueStyle={{ color: colors.success[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="上传失败"
              value={displayStats.failed}
              valueStyle={{ color: colors.error[600] }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="上传中"
              value={displayStats.uploading}
              valueStyle={{ color: colors.primary[500] }}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Failures */}
      {recentFailures.length > 0 && (
        <Card
          title="最近失败的上传"
          style={{ marginBottom: spacing.md }}
          extra={
            <Button icon={<ReloadOutlined />} onClick={loadRecentFailures}>
              刷新
            </Button>
          }
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {recentFailures.map((record) => (
              <div
                key={record.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  background: colors.error[50],
                  borderRadius: 4,
                }}
              >
                <Space>
                  <Tag color="error">{MARKET_NAMES[record.market]}</Tag>
                  <code>{record.packageName}</code>
                </Space>
                <Text type="secondary">{record.error || 'Unknown error'}</Text>
              </div>
            ))}
          </Space>
        </Card>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: spacing.md }}>
        <Space>
          <Select
            placeholder="筛选市场"
            allowClear
            style={{ width: 180 }}
            value={filters.market}
            onChange={(value) => setFilters({ ...filters, market: value })}
            options={Object.entries(MARKET_NAMES).map(([value, label]) => ({
              value,
              label,
            }))}
          />
          <Select
            placeholder="筛选状态"
            allowClear
            style={{ width: 120 }}
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            options={Object.entries(STATUS_CONFIG).map(([value, config]) => ({
              value,
              label: config.text,
            }))}
          />
          <Button icon={<ReloadOutlined />} onClick={loadHistory}>
            刷新
          </Button>
        </Space>
      </Card>

      {/* History Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          onChange={handleTableChange}
          locale={{
            emptyText: records.length === 0 ? (
              <Empty description="暂无上传记录" />
            ) : undefined,
          }}
        />
      </Card>
    </div>
  );
};

export default ApkUploadHistoryPage;