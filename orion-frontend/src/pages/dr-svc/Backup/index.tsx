/**
 * Backup Management Page
 * 数据备份与恢复管理
 *
 * Features:
 * - Stats cards: Total Backups, Successful, Failed, Last Backup Time
 * - Backup list table with filter by type and status
 * - Create backup, restore, download, delete actions
 * - Restore confirmation modal
 */
import React, { useState, useMemo, useEffect } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Alert,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  RollbackOutlined,
  CloudServerOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  DatabaseOutlined,
  FileProtectOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getBackupStats,
  getBackups,
  createBackup,
  restoreBackup,
  deleteBackup,
  getBackupDownloadUrl,
  type BackupRecord as APIBackupRecord,
  type BackupStats as APIBackupStats,
} from '@/api/backup';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

type BackupType = 'database' | 'config' | 'full';
type BackupStatus = 'success' | 'failed' | 'running' | 'pending' | 'restored';

interface BackupRecord {
  id: string;
  name: string;
  type: BackupType;
  size: number;
  status: BackupStatus;
  createdAt: string;
  completedAt?: string;
  duration?: number;
  description?: string;
  createdBy: string;
}

interface BackupStats {
  total: number;
  successful: number;
  failed: number;
  lastBackupTime?: string;
  totalSize: number;
}

// ============================================================================
// Label & Color Maps
// ============================================================================

const typeLabelMap: Record<BackupType, string> = {
  database: '数据库',
  config: '配置',
  full: '完整备份',
};

const typeIconMap: Record<BackupType, React.ReactNode> = {
  database: <DatabaseOutlined />,
  config: <SettingOutlined />,
  full: <FileProtectOutlined />,
};

const statusColorMap: Record<BackupStatus, string> = {
  success: 'success',
  failed: 'error',
  running: 'processing',
  pending: 'default',
  restored: 'blue',
};

const statusLabelMap: Record<BackupStatus, string> = {
  success: '成功',
  failed: '失败',
  running: '运行中',
  pending: '等待中',
  restored: '已恢复',
};

// ============================================================================
// Utility Functions
// ============================================================================

/** Map API BackupRecord to UI shape */
function mapApiBackup(b: APIBackupRecord): BackupRecord {
  return {
    id: b.id,
    name: b.name,
    type: b.type,
    size: b.size,
    status:
      b.status === 'completed'
        ? 'success'
        : b.status === 'in_progress'
          ? 'running'
          : b.status === 'scheduled'
            ? 'pending'
            : b.status === 'failed'
              ? 'failed'
              : 'restored',
    createdAt: b.createdAt,
    completedAt: b.completedAt,
    duration: 0,
    description: b.errorMessage || undefined,
    createdBy: 'system',
  };
}

/** Map API stats to UI shape */
function mapApiStats(s: APIBackupStats): BackupStats {
  return {
    total: s.total,
    successful: s.successful,
    failed: s.failed,
    lastBackupTime: undefined,
    totalSize: 0,
  };
}

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
};

// ============================================================================
// Main Component
// ============================================================================

const BackupManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await getBackups();
      setBackups(response.data.data.backups.map(mapApiBackup));
    } catch (error: unknown) {
      message.error(`Failed to load backups: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getBackupStats();
      setStats(mapApiStats(response.data.data.stats));
    } catch (error: unknown) {
      message.error(`Failed to load backup stats: ${(error as Error).message}`);
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  // ---- Filtering ----

  const filteredData = useMemo(() => {
    return backups.filter((b) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !b.name.toLowerCase().includes(q) &&
          !(b.description && b.description.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (filters.type && filters.type !== 'all' && b.type !== filters.type) return false;
      if (filters.status && filters.status !== 'all' && b.status !== filters.status) return false;
      return true;
    });
  }, [searchQuery, filters, backups]);

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createBackup({ name: values.name, type: values.type });
      message.success('备份任务已创建');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建备份失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    if (!selectedBackup) return;
    try {
      setSubmitting(true);
      await restoreBackup(selectedBackup.id);
      message.success(`备份 "${selectedBackup.name}" 恢复任务已启动`);
      setRestoreModalVisible(false);
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`恢复失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBackup(id);
      message.success('备份已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const handleDownload = async (record: BackupRecord) => {
    try {
      const res = await getBackupDownloadUrl(record.id);
      const url = res.data?.data?.url;
      if (url) {
        window.open(url, '_blank');
      } else {
        message.warning('未获取到下载链接');
      }
    } catch (error: unknown) {
      message.error(`下载失败: ${(error as Error).message}`);
    }
  };

  const openRestore = (record: BackupRecord) => {
    setSelectedBackup(record);
    setRestoreModalVisible(true);
  };

  // ---- Table Columns ----

  const columns: TableColumn<BackupRecord>[] = [
    {
      key: 'name',
      title: '备份名称',
      dataIndex: 'name',
      width: 240,
      sortable: true,
      render: (value: unknown, record: BackupRecord) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'type',
      title: '类型',
      width: 100,
      render: (_: unknown, record: BackupRecord) => (
        <Tag icon={typeIconMap[record.type]} color="blue">
          {typeLabelMap[record.type]}
        </Tag>
      ),
    },
    {
      key: 'size',
      title: '大小',
      width: 100,
      sortable: true,
      render: (_: unknown, record: BackupRecord) => (
        <Text type="secondary">{formatSize(record.size)}</Text>
      ),
    },
    {
      key: 'status',
      title: '状态',
      width: 100,
      render: (_: unknown, record: BackupRecord) => (
        <Tag color={statusColorMap[record.status]}>{statusLabelMap[record.status]}</Tag>
      ),
    },
    {
      key: 'duration',
      title: '耗时',
      width: 90,
      render: (_: unknown, record: BackupRecord) =>
        record.duration ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatDuration(record.duration)}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'createdAt',
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      sortable: true,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}
        </Text>
      ),
    },
    {
      key: 'createdBy',
      title: '创建人',
      dataIndex: 'createdBy',
      width: 90,
      render: (value: unknown) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {String(value)}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 200,
      render: (_: unknown, record: BackupRecord) => (
        <Space size="small" wrap>
          {record.status === 'success' && (
            <Button
              type="link"
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => openRestore(record)}
            >
              恢复
            </Button>
          )}
          {record.status === 'success' && (
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleDownload(record)}
            >
              下载
            </Button>
          )}
          <Popconfirm
            title="确认删除该备份?"
            description="删除后无法恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Filter Definitions ----

  const filterDefs: FilterDefinition[] = [
    {
      key: 'type',
      label: '备份类型',
      options: [
        { label: '全部', value: 'all' },
        { label: '数据库', value: 'database' },
        { label: '配置', value: 'config' },
        { label: '完整备份', value: 'full' },
      ],
    },
    {
      key: 'status',
      label: '状态',
      options: [
        { label: '全部', value: 'all' },
        { label: '成功', value: 'success' },
        { label: '失败', value: 'failed' },
        { label: '运行中', value: 'running' },
        { label: '等待中', value: 'pending' },
        { label: '已恢复', value: 'restored' },
      ],
    },
  ];

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Page Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing[6],
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DatabaseOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            Backup Management
          </Title>
          <Text type="secondary">数据备份与恢复</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadData();
              loadStats();
            }}
            loading={loading}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            创建备份
          </Button>
        </Space>
      </div>

      {/* Stats Cards */}
      {stats && (
        <Row gutter={spacing[4]} style={{ marginBottom: spacing[6] }}>
          <Col span={6}>
            <MetricCard
              title="备份总数"
              value={stats.total}
              icon={<CloudServerOutlined style={{ fontSize: 20, color: colors.primary[500] }} />}
              color={colors.primary[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="成功"
              value={stats.successful}
              icon={<CheckCircleOutlined style={{ fontSize: 20, color: colors.success[500] }} />}
              color={colors.success[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="失败"
              value={stats.failed}
              icon={<CloseCircleOutlined style={{ fontSize: 20, color: colors.error[500] }} />}
              color={colors.error[500]}
            />
          </Col>
          <Col span={6}>
            <MetricCard
              title="上次备份"
              value={stats.lastBackupTime ? dayjs(stats.lastBackupTime).fromNow() : '暂无数据'}
              icon={<ClockCircleOutlined style={{ fontSize: 20, color: colors.warning[500] }} />}
              color={colors.warning[500]}
            />
          </Col>
        </Row>
      )}

      {/* Backup List */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索备份名称或描述..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
        />
      </Card>

      {/* Create Backup Modal */}
      <Modal
        title="创建备份"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreate}
        confirmLoading={submitting}
        width={520}
        destroyOnClose
      >
        <Form form={createForm} layout="vertical">
          <Form.Item
            name="name"
            label="备份名称"
            rules={[{ required: true, message: '请输入备份名称' }]}
          >
            <Input placeholder="如: manual-backup-2026-04-27" />
          </Form.Item>
          <Form.Item
            name="type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
            initialValue="full"
          >
            <Select>
              <Select.Option value="database">数据库备份</Select.Option>
              <Select.Option value="config">配置备份</Select.Option>
              <Select.Option value="full">完整备份</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="备份描述（可选）..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Restore Confirmation Modal */}
      <Modal
        title="确认恢复"
        open={restoreModalVisible}
        onCancel={() => setRestoreModalVisible(false)}
        onOk={handleRestore}
        confirmLoading={submitting}
        width={480}
      >
        {selectedBackup && (
          <div>
            <Alert
              message="恢复操作警告"
              description="恢复备份将覆盖当前数据。此操作不可逆，请确认后再执行。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Card size="small">
              <Space direction="vertical" size={8}>
                <div>
                  <Text type="secondary">备份名称: </Text>
                  <Text strong>{selectedBackup.name}</Text>
                </div>
                <div>
                  <Text type="secondary">备份类型: </Text>
                  <Tag color="blue">{typeLabelMap[selectedBackup.type]}</Tag>
                </div>
                <div>
                  <Text type="secondary">创建时间: </Text>
                  <Text>{dayjs(selectedBackup.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </div>
                <div>
                  <Text type="secondary">备份大小: </Text>
                  <Text>{formatSize(selectedBackup.size)}</Text>
                </div>
              </Space>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default BackupManagement;
