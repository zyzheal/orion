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
  SaveOutlined,
} from '@ant-design/icons';
import Table, { type TableColumn } from '@/components/Table';
import SearchFilterBar, { type FilterDefinition } from '@/components/SearchFilterBar';
import MetricCard from '@/components/MetricCard';
import { colors, spacing } from '@/tokens';
import {
  getBackupStats,
  listPlans,
  createPlan,
  deletePlan,
  executeBackup,
  listBackupRecords,
  deleteBackupRecord,
  createRecovery,
  executeRecovery,
  type BackupRecord as APIBackupRecord,
  type BackupPlan as APIBackupPlan,
  type CreatePlanInput,
  type BackupType,
  type BackupStatus,
} from '@/api/backup';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

interface BackupRecord {
  id: string;
  planId: string;
  type: BackupType;
  size: number;
  status: BackupStatus;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}

interface BackupPlanItem {
  id: string;
  name: string;
  type: BackupType;
  retentionDays: number;
  schedule?: string;
  enabled: boolean;
  createdAt: string;
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
  full: '全量',
  incremental: '增量',
  differential: '差异',
};

const typeIconMap: Record<BackupType, React.ReactNode> = {
  full: <FileProtectOutlined />,
  incremental: <DatabaseOutlined />,
  differential: <DatabaseOutlined />,
};

const statusColorMap: Record<BackupStatus, string> = {
  pending: 'default',
  running: 'processing',
  completed: 'success',
  failed: 'error',
  verified: 'blue',
  expired: 'warning',
  deleted: 'default',
};

const statusLabelMap: Record<BackupStatus, string> = {
  pending: '等待中',
  running: '运行中',
  completed: '完成',
  failed: '失败',
  verified: '已验证',
  expired: '已过期',
  deleted: '已删除',
};

// ============================================================================
// Utility Functions
// ============================================================================

/** Map API BackupRecord to UI shape */
function mapApiRecord(b: APIBackupRecord): BackupRecord {
  return {
    id: b.id,
    planId: b.plan_id,
    type: b.type,
    size: b.size_bytes,
    status: b.status,
    createdAt: b.created_at,
    completedAt: b.completed_at,
    errorMessage: b.error_message,
  };
}

/** Map API BackupPlan to UI shape */
function mapApiPlan(p: APIBackupPlan): BackupPlanItem {
  return {
    id: p.id,
    name: p.name,
    type: p.type,
    retentionDays: p.retention_days,
    schedule: p.schedule,
    enabled: p.enabled,
    createdAt: p.created_at,
  };
}

const formatSize = (bytes: number): string => {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
};

// ============================================================================
// Main Component
// ============================================================================

const BackupManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<BackupPlanItem[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<Record<string, string | string[] | undefined>>({});
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BackupRecord | null>(null);
  const [expandedRecords, setExpandedRecords] = useState<Record<string, BackupRecord[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [createForm] = Form.useForm();

  // ---- Data Loading ----

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listPlans();
      const raw = res.data;
      const plans = Array.isArray(raw) ? raw : [];
      setPlans(plans.map(mapApiPlan));
    } catch (error: unknown) {
      message.error(`Failed to load plans: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const res = await getBackupStats();
      const s = res.data ?? {};
      setStats({
        total: s.total_backups ?? 0,
        successful: s.completed_backups ?? 0,
        failed: s.failed_backups ?? 0,
        lastBackupTime: s.last_completed_at ?? undefined,
        totalSize: s.total_size_bytes ?? 0,
      });
    } catch (error: unknown) {
      message.error(`Failed to load backup stats: ${(error as Error).message}`);
    }
  };

  const loadRecords = async (planId: string) => {
    try {
      const res = await listBackupRecords(planId);
      const raw = res.data;
      const records = Array.isArray(raw) ? raw : [];
      setExpandedRecords((prev) => ({
        ...prev,
        [planId]: records.map(mapApiRecord),
      }));
    } catch {
      setExpandedRecords((prev) => ({ ...prev, [planId]: [] }));
    }
  };

  useEffect(() => {
    loadData();
    loadStats();
  }, []);

  // ---- Filtering ----

  const filteredData = useMemo(() => {
    return plans.filter((p) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!p.name.toLowerCase().includes(q)) {
          return false;
        }
      }
      if (filters.type && filters.type !== 'all' && p.type !== filters.type) return false;
      return true;
    });
  }, [searchQuery, filters, plans]);

  // ---- Actions ----

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSubmitting(true);
      await createPlan({
        name: values.name,
        type: values.type,
        retention_days: values.retentionDays ?? 7,
        enabled: true,
      } as CreatePlanInput);
      message.success('备份计划已创建');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
      loadStats();
    } catch (error: unknown) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建备份计划失败：${(error as Error).message}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecute = async (planId: string) => {
    try {
      setSubmitting(true);
      await executeBackup(planId);
      message.success('备份任务已启动');
      loadStats();
    } catch (error: unknown) {
      message.error(`执行备份失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePlan = async (id: string) => {
    try {
      await deletePlan(id);
      message.success('备份计划已删除');
      loadData();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const handleDeleteRecord = async (planId: string, recordId: string) => {
    try {
      await deleteBackupRecord(planId, recordId);
      message.success('备份记录已删除');
      loadRecords(planId);
      loadStats();
    } catch (error: unknown) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const handleRestore = async () => {
    if (!selectedRecord) return;
    try {
      setSubmitting(true);
      const res = await createRecovery({ backup_id: selectedRecord.id });
      const recovery = res.data;
      if (recovery?.id) {
        await executeRecovery(recovery.id);
      }
      message.success(`备份恢复任务已启动 (${recovery?.id ?? 'ok'})`);
      setRestoreModalVisible(false);
      loadStats();
    } catch (error: unknown) {
      message.error(`恢复失败：${(error as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const openRestore = (record: BackupRecord) => {
    setSelectedRecord(record);
    setRestoreModalVisible(true);
  };

  const toggleRecords = (planId: string) => {
    if (!expandedRecords[planId]) {
      loadRecords(planId);
    }
    setExpandedRecords((prev) => {
      const next = { ...prev };
      if (next[planId]) {
        delete next[planId];
      } else {
        next[planId] = [];
        setTimeout(() => loadRecords(planId), 0);
      }
      return next;
    });
  };

  // ---- Table Columns ----

  const columns: TableColumn<BackupPlanItem>[] = useMemo<TableColumn<BackupPlanItem>[]>(
    () => [
      {
        key: 'name',
        title: '计划名称',
        dataIndex: 'name',
        width: 240,
        sortable: true,
        render: (value: unknown, record: BackupPlanItem) => (
          <Space direction="vertical" size={0}>
            <Text strong>{String(value)}</Text>
            {record.schedule && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                调度: {record.schedule}
              </Text>
            )}
          </Space>
        ),
      },
      {
        key: 'type',
        title: '类型',
        width: 100,
        render: (_: unknown, record: BackupPlanItem) => (
          <Tag icon={typeIconMap[record.type]} color="blue">
            {typeLabelMap[record.type]}
          </Tag>
        ),
      },
      {
        key: 'enabled',
        title: '状态',
        width: 100,
        render: (_: unknown, record: BackupPlanItem) => (
          <Tag color={record.enabled ? 'success' : 'default'}>
            {record.enabled ? '启用' : '禁用'}
          </Tag>
        ),
      },
      {
        key: 'retentionDays',
        title: '保留天数',
        width: 100,
        dataIndex: 'retentionDays',
        render: (value: unknown) => (
          <Text type="secondary">{String(value)} 天</Text>
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
        key: 'actions',
        title: '操作',
        width: 260,
        render: (_: unknown, record: BackupPlanItem) => (
          <Space size="small" wrap>
            <Button
              type="link"
              size="small"
              icon={<CloudDownloadOutlined />}
              onClick={() => handleExecute(record.id)}
              loading={submitting}
            >
              执行
            </Button>
            <Button
              type="link"
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => toggleRecords(record.id)}
            >
              {expandedRecords[record.id] ? '收起记录' : '查看记录'}
            </Button>
            <Popconfirm
              title="确认删除该计划?"
              description="删除后计划内的调度将停止"
              onConfirm={() => handleDeletePlan(record.id)}
            >
              <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [handleExecute, handleDeletePlan, openRestore, toggleRecords, expandedRecords, submitting]
  );

  // ---- Filter Definitions ----

  const filterDefs: FilterDefinition[] = useMemo<FilterDefinition[]>(
    () => [
      {
        key: 'type',
        label: '备份类型',
        options: [
          { label: '全部', value: 'all' },
          { label: '全量', value: 'full' },
          { label: '增量', value: 'incremental' },
          { label: '差异', value: 'differential' },
        ],
      },
    ],
    []
  );

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
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <SaveOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
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

      {/* Plan List */}
      <Card>
        <div style={{ marginBottom: spacing[4] }}>
          <SearchFilterBar
            onSearch={setSearchQuery}
            onFilter={setFilters}
            filters={filterDefs}
            searchPlaceholder="搜索计划名称..."
          />
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          size="middle"
          striped
          expandable={{
            expandedRowKeys: Object.keys(expandedRecords).filter((k) => expandedRecords[k]),
            expandedRowRender: (record: BackupPlanItem) => {
              const records = expandedRecords[record.id] || [];
              if (records.length === 0) return <Text type="secondary">暂无备份记录</Text>;
              return (
                <div style={{ padding: '8px 0' }}>
                  {records.map((r) => (
                    <div
                      key={r.id}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}
                    >
                      <Space>
                        <Tag color={statusColorMap[r.status]}>{statusLabelMap[r.status]}</Tag>
                        <Text>{r.id.slice(0, 8)}...</Text>
                        <Text type="secondary">{formatSize(r.size)}</Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {dayjs(r.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                        </Text>
                      </Space>
                      <Space size="small">
                        <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => openRestore(r)}>
                          恢复
                        </Button>
                        <Popconfirm
                          title="确认删除该备份记录?"
                          onConfirm={() => handleDeleteRecord(record.id, r.id)}
                        >
                          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      </Space>
                    </div>
                  ))}
                </div>
              );
            },
            expandRowByClick: true,
          }}
        />
      </Card>

      {/* Create Plan Modal */}
      <Modal
        title="创建备份计划"
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
            label="计划名称"
            rules={[{ required: true, message: '请输入计划名称' }]}
          >
            <Input placeholder="如: daily-db-backup" />
          </Form.Item>
          <Form.Item
            name="type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
            initialValue="full"
          >
            <Select>
              <Select.Option value="full">全量备份</Select.Option>
              <Select.Option value="incremental">增量备份</Select.Option>
              <Select.Option value="differential">差异备份</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="retentionDays"
            label="保留天数"
            initialValue={7}
            rules={[{ required: true, message: '请输入保留天数' }]}
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>
          <Form.Item name="schedule" label="Cron 调度表达式">
            <Input placeholder="如: 0 2 * * *（每天凌晨2点）" />
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
        {selectedRecord && (
          <div>
            <Alert
              message="恢复操作警告"
              description="恢复备份将覆盖当前数据。此操作不可逆，请确认后再执行。"
              type="warning"
              showIcon
              style={{ marginBottom: spacing.md }}
            />
            <Card size="small">
              <Space direction="vertical" size={8}>
                <div>
                  <Text type="secondary">备份 ID: </Text>
                  <Text strong>{selectedRecord.id}</Text>
                </div>
                <div>
                  <Text type="secondary">备份类型: </Text>
                  <Tag color="blue">{typeLabelMap[selectedRecord.type]}</Tag>
                </div>
                <div>
                  <Text type="secondary">创建时间: </Text>
                  <Text>{dayjs(selectedRecord.createdAt).format('YYYY-MM-DD HH:mm:ss')}</Text>
                </div>
                <div>
                  <Text type="secondary">备份大小: </Text>
                  <Text>{formatSize(selectedRecord.size)}</Text>
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
