/**
 * SLA Management Page
 * SLA definitions CRUD, tracking management, breach event log, compliance statistics
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  Popconfirm,
  InputNumber,
  Switch,
  Badge,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table, { type TableColumn } from '@/components/Table';
import { colors, spacing, componentRadius, shadows } from '@/tokens';
import {
  getSLADefinitions,
  createSLADefinition,
  updateSLADefinition,
  deleteSLADefinition,
  getSLATrackings,
  createSLATracking,
  updateSLATrackingStatus,
  markSLABreach,
  getSLABreaches,
  getSLAStats,
} from '@/api/sla';
import type {
  SLADefinition,
  SLATracking,
  SLABreachEvent,
  SLAStats,
} from '@/api/sla';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

// ==================== Constants ====================

const TYPE_COLOR_MAP: Record<string, string> = {
  response: 'blue',
  resolution: 'orange',
  availability: 'green',
};

const TYPE_LABEL_MAP: Record<string, string> = {
  response: '响应时间',
  resolution: '解决时间',
  availability: '可用性',
};

const DEF_STATUS_COLOR_MAP: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  archived: 'default',
};

const DEF_STATUS_LABEL_MAP: Record<string, string> = {
  active: '启用',
  inactive: '停用',
  archived: '归档',
};

const TRACKING_STATUS_LABEL_MAP: Record<string, string> = {
  tracking: '追踪中',
  met: '已达成',
  breached: '已违约',
  paused: '已暂停',
};

const ENTITY_TYPE_COLOR_MAP: Record<string, string> = {
  incident: 'red',
  request: 'blue',
  change: 'purple',
};

const ENTITY_TYPE_LABEL_MAP: Record<string, string> = {
  incident: '事件',
  request: '请求',
  change: '变更',
};

const PRIORITY_COLOR_MAP: Record<string, string> = {
  critical: 'red',
  high: 'orange',
  medium: 'blue',
  low: 'default',
};

const PRIORITY_LABEL_MAP: Record<string, string> = {
  critical: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const EVENT_TYPE_COLOR_MAP: Record<string, string> = {
  warning: 'orange',
  breach: 'red',
  escalation: 'purple',
};

const EVENT_TYPE_LABEL_MAP: Record<string, string> = {
  warning: '预警',
  breach: '违约',
  escalation: '升级',
};

// ==================== Component ====================

const SLAManagement: React.FC = () => {
  // ---- State ----
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('definitions');

  // Definitions state
  const [definitions, setDefinitions] = useState<SLADefinition[]>([]);
  const [defTotal, setDefTotal] = useState(0);
  const [defTypeFilter, setDefTypeFilter] = useState<string | undefined>(undefined);
  const [defStatusFilter, setDefStatusFilter] = useState<string | undefined>(undefined);
  const [defModalVisible, setDefModalVisible] = useState(false);
  const [editingDef, setEditingDef] = useState<SLADefinition | null>(null);
  const [defForm] = Form.useForm();

  // Tracking state
  const [trackings, setTrackings] = useState<SLATracking[]>([]);
  const [trackingTotal, setTrackingTotal] = useState(0);
  const [trackingStatusFilter, setTrackingStatusFilter] = useState<string | undefined>(undefined);
  const [trackingEntityFilter, setTrackingEntityFilter] = useState<string | undefined>(undefined);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [trackingForm] = Form.useForm();

  // Breach events state
  const [breaches, setBreaches] = useState<SLABreachEvent[]>([]);
  const [breachTotal, setBreachTotal] = useState(0);
  const [breachTrackingFilter, setBreachTrackingFilter] = useState<string | undefined>(undefined);

  // Stats
  const [stats, setStats] = useState<SLAStats | null>(null);

  // ---- Data Loading ----

  const loadStats = useCallback(async () => {
    try {
      const data = await getSLAStats();
      setStats(data);
    } catch {
      // Stats load failure is non-critical
    }
  }, []);

  const loadDefinitions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (defTypeFilter) params.type = defTypeFilter;
      if (defStatusFilter) params.status = defStatusFilter;
      const res = await getSLADefinitions(params);
      setDefinitions(Array.isArray(res.data) ? res.data : []);
      setDefTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载 SLA 定义失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [defTypeFilter, defStatusFilter]);

  const loadTrackings = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (trackingStatusFilter) params.status = trackingStatusFilter;
      if (trackingEntityFilter) params.entityType = trackingEntityFilter;
      const res = await getSLATrackings(params);
      setTrackings(Array.isArray(res.data) ? res.data : []);
      setTrackingTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载追踪记录失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [trackingStatusFilter, trackingEntityFilter]);

  const loadBreaches = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { limit: 100, offset: 0 };
      if (breachTrackingFilter) params.trackingId = breachTrackingFilter;
      const res = await getSLABreaches(params);
      setBreaches(Array.isArray(res.data) ? res.data : []);
      setBreachTotal(res.total || 0);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '加载违约事件失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [breachTrackingFilter]);

  const loadData = useCallback(() => {
    loadStats();
    if (activeTab === 'definitions') loadDefinitions();
    else if (activeTab === 'tracking') loadTrackings();
    else if (activeTab === 'breaches') loadBreaches();
  }, [activeTab, loadStats, loadDefinitions, loadTrackings, loadBreaches]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Re-fetch when filters change
  useEffect(() => {
    if (activeTab === 'definitions') loadDefinitions();
  }, [defTypeFilter, defStatusFilter, activeTab, loadDefinitions]);

  useEffect(() => {
    if (activeTab === 'tracking') loadTrackings();
  }, [trackingStatusFilter, trackingEntityFilter, activeTab, loadTrackings]);

  useEffect(() => {
    if (activeTab === 'breaches') loadBreaches();
  }, [breachTrackingFilter, activeTab, loadBreaches]);

  // ---- Definition Map for resolving names ----

  const definitionMap = useMemo(() => {
    const map: Record<string, SLADefinition> = {};
    definitions.forEach((d) => { map[d.id] = d; });
    return map;
  }, [definitions]);

  // ---- Handlers: Definitions ----

  const handleSaveDefinition = async (values: Record<string, unknown>) => {
    try {
      const payload = {
        name: String(values.name),
        description: values.description ? String(values.description) : undefined,
        type: String(values.type),
        target_value: Number(values.target_value),
        target_unit: String(values.target_unit),
        business_hours_only: !!values.business_hours_only,
        priority: values.priority ? String(values.priority) : undefined,
        category: values.category ? String(values.category) : undefined,
      };
      if (editingDef) {
        await updateSLADefinition(editingDef.id, payload as Partial<SLADefinition>);
        message.success('SLA 定义已更新');
      } else {
        await createSLADefinition(payload);
        message.success('SLA 定义已创建');
      }
      setDefModalVisible(false);
      setEditingDef(null);
      defForm.resetFields();
      loadDefinitions();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '保存 SLA 定义失败';
      message.error(msg);
    }
  };

  const handleDeleteDefinition = async (id: string) => {
    try {
      await deleteSLADefinition(id);
      message.success('SLA 定义已删除');
      loadDefinitions();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '删除 SLA 定义失败';
      message.error(msg);
    }
  };

  const openEditDefModal = (record: SLADefinition) => {
    setEditingDef(record);
    defForm.setFieldsValue({
      name: record.name,
      description: record.description,
      type: record.type,
      target_value: record.target_value,
      target_unit: record.target_unit,
      business_hours_only: record.business_hours_only,
      priority: record.priority,
      category: record.category,
    });
    setDefModalVisible(true);
  };

  const openCreateDefModal = () => {
    setEditingDef(null);
    defForm.resetFields();
    defForm.setFieldsValue({ business_hours_only: false });
    setDefModalVisible(true);
  };

  // ---- Handlers: Tracking ----

  const handleCreateTracking = async (values: Record<string, unknown>) => {
    try {
      await createSLATracking({
        sla_definition_id: String(values.sla_definition_id),
        entity_type: String(values.entity_type),
        entity_id: String(values.entity_id),
        target_time: String(values.target_time),
        notes: values.notes ? String(values.notes) : undefined,
      });
      message.success('追踪记录已创建');
      setTrackingModalVisible(false);
      trackingForm.resetFields();
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '创建追踪记录失败';
      message.error(msg);
    }
  };

  const handleUpdateTrackingStatus = async (id: string, status: string) => {
    try {
      await updateSLATrackingStatus(id, status);
      message.success(`追踪状态已更新为 ${TRACKING_STATUS_LABEL_MAP[status] || status}`);
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '更新追踪状态失败';
      message.error(msg);
    }
  };

  const handleMarkBreach = async (id: string) => {
    try {
      await markSLABreach(id);
      message.success('已标记违约');
      loadTrackings();
      loadStats();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : '标记违约失败';
      message.error(msg);
    }
  };

  // ---- Stats Cards ----

  const statsBar = (
    <Row gutter={[spacing.md, spacing.md]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} lg={6}>
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>SLA 定义总数</Text>
              <div style={{ fontSize: 28, fontWeight: 600, color: colors.neutral[900], marginTop: 4 }}>
                {stats?.totalDefinitions ?? defTotal}
              </div>
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: componentRadius.card,
                background: colors.primary[50],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <SafetyCertificateOutlined style={{ fontSize: 22, color: colors.primary[500] }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>活跃追踪</Text>
              <div style={{ fontSize: 28, fontWeight: 600, color: colors.info[600], marginTop: 4 }}>
                {stats?.activeTrackings ?? 0}
              </div>
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: componentRadius.card,
                background: colors.info[50],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FieldTimeOutlined style={{ fontSize: 22, color: colors.info[500] }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>违约次数</Text>
              <div style={{ fontSize: 28, fontWeight: 600, color: colors.error[600], marginTop: 4 }}>
                {stats?.breachedCount ?? 0}
              </div>
            </div>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: componentRadius.card,
                background: colors.error[50],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FireOutlined style={{ fontSize: 22, color: colors.error[500] }} />
            </div>
          </div>
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text type="secondary" style={{ fontSize: 13 }}>合规率</Text>
              <div style={{ fontSize: 28, fontWeight: 600, color: colors.success[600], marginTop: 4 }}>
                {stats?.complianceRate != null ? `${stats.complianceRate.toFixed(1)}%` : '-'}
              </div>
            </div>
            <Progress
              type="circle"
              percent={stats?.complianceRate ?? 0}
              size={48}
              strokeColor={colors.success[500]}
              trailColor={colors.neutral[200]}
              format={(p) => `${p?.toFixed(0) ?? 0}%`}
            />
          </div>
        </Card>
      </Col>
    </Row>
  );

  // ---- Definitions Table Columns ----

  const defColumns: TableColumn<SLADefinition>[] = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      width: 200,
      sortable: true,
      render: (value: unknown, record: SLADefinition) => (
        <Space direction="vertical" size={0}>
          <Text strong>{String(value)}</Text>
          {record.description && (
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value: unknown) => (
        <Tag color={TYPE_COLOR_MAP[String(value)] || 'default'}>
          {TYPE_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'target_value',
      title: '目标值',
      dataIndex: 'target_value',
      width: 140,
      render: (_: unknown, record: SLADefinition) => (
        <Text strong>{record.target_value} {record.target_unit}</Text>
      ),
    },
    {
      key: 'priority',
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (value: unknown) =>
        value ? (
          <Tag color={PRIORITY_COLOR_MAP[String(value)] || 'default'}>
            {PRIORITY_LABEL_MAP[String(value)] || String(value)}
          </Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'business_hours_only',
      title: '仅工作时间',
      dataIndex: 'business_hours_only',
      width: 110,
      render: (value: unknown) => (
        <Switch checked={!!value} size="small" disabled />
      ),
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: unknown) => (
        <Tag color={DEF_STATUS_COLOR_MAP[String(value)] || 'default'}>
          {DEF_STATUS_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 140,
      render: (_: unknown, record: SLADefinition) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditDefModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除此 SLA 定义?"
            description="删除后不可恢复，关联的追踪记录也将失效。"
            onConfirm={() => handleDeleteDefinition(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ---- Tracking Table Columns ----

  const trackingColumns: TableColumn<SLATracking>[] = [
    {
      key: 'entity_type',
      title: '实体类型',
      dataIndex: 'entity_type',
      width: 100,
      render: (value: unknown) => (
        <Tag color={ENTITY_TYPE_COLOR_MAP[String(value)] || 'default'}>
          {ENTITY_TYPE_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'entity_id',
      title: '实体 ID',
      dataIndex: 'entity_id',
      width: 160,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'sla_definition_id',
      title: 'SLA 定义',
      dataIndex: 'sla_definition_id',
      width: 160,
      render: (value: unknown) => {
        const def = definitionMap[String(value)];
        return def ? <Text strong>{def.name}</Text> : <Text type="secondary">{String(value)}</Text>;
      },
    },
    {
      key: 'status',
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: unknown) => {
        const statusStr = String(value);
        const badgeStatus =
          statusStr === 'tracking'
            ? 'processing'
            : statusStr === 'met'
            ? 'success'
            : statusStr === 'breached'
            ? 'error'
            : 'warning';
        return (
          <Badge
            status={badgeStatus as 'processing' | 'success' | 'error' | 'warning'}
            text={TRACKING_STATUS_LABEL_MAP[statusStr] || statusStr}
          />
        );
      },
    },
    {
      key: 'start_time',
      title: '开始时间',
      dataIndex: 'start_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="secondary">{dayjs(String(value)).format('YYYY-MM-DD HH:mm')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'target_time',
      title: '目标时间',
      dataIndex: 'target_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text>{dayjs(String(value)).format('YYYY-MM-DD HH:mm')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'actual_time',
      title: '实际完成',
      dataIndex: 'actual_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="secondary">{dayjs(String(value)).format('YYYY-MM-DD HH:mm')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'breach_time',
      title: '违约时间',
      dataIndex: 'breach_time',
      width: 160,
      render: (value: unknown) =>
        value ? (
          <Text type="danger">{dayjs(String(value)).format('YYYY-MM-DD HH:mm')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'actions',
      title: '操作',
      width: 220,
      render: (_: unknown, record: SLATracking) => {
        const status = record.status;
        return (
          <Space size="small">
            {status === 'tracking' && (
              <>
                <Button
                  type="link"
                  size="small"
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleUpdateTrackingStatus(record.id, 'met')}
                >
                  达成
                </Button>
                <Popconfirm
                  title="确认标记为违约?"
                  onConfirm={() => handleMarkBreach(record.id)}
                  okText="确认"
                  cancelText="取消"
                >
                  <Button type="link" size="small" danger icon={<CloseCircleOutlined />}>
                    违约
                  </Button>
                </Popconfirm>
                <Button
                  type="link"
                  size="small"
                  icon={<PauseCircleOutlined />}
                  onClick={() => handleUpdateTrackingStatus(record.id, 'paused')}
                >
                  暂停
                </Button>
              </>
            )}
            {status === 'paused' && (
              <Button
                type="link"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleUpdateTrackingStatus(record.id, 'tracking')}
              >
                恢复
              </Button>
            )}
            {(status === 'met' || status === 'breached') && (
              <Text type="secondary" style={{ fontSize: 12 }}>已结束</Text>
            )}
          </Space>
        );
      },
    },
  ];

  // ---- Breach Table Columns ----

  const breachColumns: TableColumn<SLABreachEvent>[] = [
    {
      key: 'event_type',
      title: '事件类型',
      dataIndex: 'event_type',
      width: 100,
      render: (value: unknown) => (
        <Tag color={EVENT_TYPE_COLOR_MAP[String(value)] || 'default'}>
          {EVENT_TYPE_LABEL_MAP[String(value)] || String(value)}
        </Tag>
      ),
    },
    {
      key: 'sla_tracking_id',
      title: '追踪 ID',
      dataIndex: 'sla_tracking_id',
      width: 200,
      render: (value: unknown) => <Text code>{String(value)}</Text>,
    },
    {
      key: 'event_time',
      title: '事件时间',
      dataIndex: 'event_time',
      width: 180,
      render: (value: unknown) =>
        value ? (
          <Text>{dayjs(String(value)).format('YYYY-MM-DD HH:mm:ss')}</Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      key: 'details',
      title: '详情',
      dataIndex: 'details',
      width: 300,
      render: (value: unknown) => {
        if (!value) return <Text type="secondary">-</Text>;
        const detail = typeof value === 'object' ? JSON.stringify(value) : String(value);
        return (
          <Text ellipsis={{ tooltip: detail }} style={{ maxWidth: 280 }}>
            {detail}
          </Text>
        );
      },
    },
    {
      key: 'notified_users',
      title: '通知用户',
      dataIndex: 'notified_users',
      width: 200,
      render: (value: unknown) => {
        if (!Array.isArray(value) || value.length === 0) {
          return <Text type="secondary">-</Text>;
        }
        return (
          <Space size={[0, 4]} wrap>
            {value.map((u: string, i: number) => (
              <Tag key={i}>{u}</Tag>
            ))}
          </Space>
        );
      },
    },
  ];

  // ---- Tab Items ----

  const tabItems = useMemo(
    () => [
      {
        key: 'definitions',
        label: `SLA 定义 (${defTotal})`,
        children: (
          <>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              <Space size="middle" wrap>
                <Select
                  placeholder="类型筛选"
                  allowClear
                  style={{ width: 140 }}
                  value={defTypeFilter}
                  onChange={(v) => setDefTypeFilter(v)}
                  options={[
                    { label: '响应时间', value: 'response' },
                    { label: '解决时间', value: 'resolution' },
                    { label: '可用性', value: 'availability' },
                  ]}
                />
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: 120 }}
                  value={defStatusFilter}
                  onChange={(v) => setDefStatusFilter(v)}
                  options={[
                    { label: '启用', value: 'active' },
                    { label: '停用', value: 'inactive' },
                    { label: '归档', value: 'archived' },
                  ]}
                />
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openCreateDefModal}
              >
                创建 SLA
              </Button>
            </div>

            <Table
              columns={defColumns}
              dataSource={definitions}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </>
        ),
      },
      {
        key: 'tracking',
        label: `追踪记录 (${trackingTotal})`,
        children: (
          <>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: spacing.md,
                flexWrap: 'wrap',
                gap: spacing.sm,
              }}
            >
              <Space size="middle" wrap>
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: 130 }}
                  value={trackingStatusFilter}
                  onChange={(v) => setTrackingStatusFilter(v)}
                  options={[
                    { label: '追踪中', value: 'tracking' },
                    { label: '已达成', value: 'met' },
                    { label: '已违约', value: 'breached' },
                    { label: '已暂停', value: 'paused' },
                  ]}
                />
                <Select
                  placeholder="实体类型"
                  allowClear
                  style={{ width: 120 }}
                  value={trackingEntityFilter}
                  onChange={(v) => setTrackingEntityFilter(v)}
                  options={[
                    { label: '事件', value: 'incident' },
                    { label: '请求', value: 'request' },
                    { label: '变更', value: 'change' },
                  ]}
                />
              </Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  trackingForm.resetFields();
                  setTrackingModalVisible(true);
                }}
              >
                创建追踪
              </Button>
            </div>

            <Table
              columns={trackingColumns}
              dataSource={trackings}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </>
        ),
      },
      {
        key: 'breaches',
        label: `违约事件 (${breachTotal})`,
        children: (
          <>
            {/* Filter Bar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginBottom: spacing.md,
                gap: spacing.sm,
              }}
            >
              <Input
                placeholder="按追踪 ID 筛选"
                allowClear
                style={{ width: 260 }}
                value={breachTrackingFilter}
                onChange={(e) => setBreachTrackingFilter(e.target.value || undefined)}
                prefix={<ExclamationCircleOutlined style={{ color: colors.neutral[400] }} />}
              />
            </div>

            <Table
              columns={breachColumns}
              dataSource={breaches}
              loading={loading}
              rowKey="id"
              size="middle"
              striped
            />
          </>
        ),
      },
    ],
    [
      defTotal, definitions, defColumns, defTypeFilter, defStatusFilter,
      trackingTotal, trackings, trackingColumns, trackingStatusFilter, trackingEntityFilter,
      breachTotal, breaches, breachColumns, breachTrackingFilter,
      loading, trackingForm,
    ],
  );

  // ---- Render ----

  return (
    <Layout>
      <div style={{ padding: 0 }}>
        {/* Page Header */}
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
              <SafetyCertificateOutlined
                style={{ marginRight: spacing[3], color: colors.primary[500] }}
              />
              SLA 管理
            </Title>
            <Text type="secondary">
              定义、追踪和管理服务级别协议，确保服务质量达标
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        {/* Stats Bar */}
        {statsBar}

        {/* Main Tabs */}
        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
          />
        </Card>

        {/* Definition Create/Edit Modal */}
        <Modal
          title={editingDef ? '编辑 SLA 定义' : '创建 SLA 定义'}
          open={defModalVisible}
          onCancel={() => {
            setDefModalVisible(false);
            setEditingDef(null);
            defForm.resetFields();
          }}
          onOk={() => defForm.submit()}
          width={600}
          destroyOnClose
          okText={editingDef ? '保存' : '创建'}
          cancelText="取消"
        >
          <Form
            form={defForm}
            layout="vertical"
            onFinish={handleSaveDefinition}
            initialValues={{ business_hours_only: false }}
          >
            <Form.Item
              name="name"
              label="名称"
              rules={[{ required: true, message: '请输入 SLA 名称' }]}
            >
              <Input placeholder="例如: P1 事件响应 SLA" />
            </Form.Item>
            <Form.Item name="description" label="描述">
              <Input.TextArea rows={2} placeholder="SLA 定义的详细描述" />
            </Form.Item>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item
                  name="type"
                  label="类型"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select
                    placeholder="选择类型"
                    options={[
                      { label: '响应时间', value: 'response' },
                      { label: '解决时间', value: 'resolution' },
                      { label: '可用性', value: 'availability' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="priority"
                  label="优先级"
                >
                  <Select
                    placeholder="选择优先级"
                    allowClear
                    options={[
                      { label: '紧急', value: 'critical' },
                      { label: '高', value: 'high' },
                      { label: '中', value: 'medium' },
                      { label: '低', value: 'low' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={spacing.md}>
              <Col span={12}>
                <Form.Item
                  name="target_value"
                  label="目标值"
                  rules={[{ required: true, message: '请输入目标值' }]}
                >
                  <InputNumber
                    min={0}
                    style={{ width: '100%' }}
                    placeholder="例如: 30"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="target_unit"
                  label="目标单位"
                  rules={[{ required: true, message: '请选择单位' }]}
                >
                  <Select
                    placeholder="选择单位"
                    options={[
                      { label: '分钟', value: 'minutes' },
                      { label: '小时', value: 'hours' },
                      { label: '百分比', value: 'percent' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="category" label="分类">
              <Input placeholder="例如: incident, change, request" />
            </Form.Item>
            <Form.Item
              name="business_hours_only"
              label="仅工作时间"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Form>
        </Modal>

        {/* Tracking Create Modal */}
        <Modal
          title="创建追踪记录"
          open={trackingModalVisible}
          onCancel={() => {
            setTrackingModalVisible(false);
            trackingForm.resetFields();
          }}
          onOk={() => trackingForm.submit()}
          width={520}
          destroyOnClose
          okText="创建"
          cancelText="取消"
        >
          <Form form={trackingForm} layout="vertical" onFinish={handleCreateTracking}>
            <Form.Item
              name="sla_definition_id"
              label="SLA 定义"
              rules={[{ required: true, message: '请选择 SLA 定义' }]}
            >
              <Select
                placeholder="选择 SLA 定义"
                showSearch
                optionFilterProp="label"
                options={definitions.map((d) => ({
                  label: `${d.name} (${d.target_value} ${d.target_unit})`,
                  value: d.id,
                }))}
              />
            </Form.Item>
            <Form.Item
              name="entity_type"
              label="实体类型"
              rules={[{ required: true, message: '请选择实体类型' }]}
            >
              <Select
                placeholder="选择实体类型"
                options={[
                  { label: '事件', value: 'incident' },
                  { label: '请求', value: 'request' },
                  { label: '变更', value: 'change' },
                ]}
              />
            </Form.Item>
            <Form.Item
              name="entity_id"
              label="实体 ID"
              rules={[{ required: true, message: '请输入实体 ID' }]}
            >
              <Input placeholder="关联的事件/请求/变更 ID" />
            </Form.Item>
            <Form.Item
              name="target_time"
              label="目标时间"
              rules={[{ required: true, message: '请输入目标时间' }]}
            >
              <Input placeholder="ISO 格式，例如: 2026-06-15T18:00:00Z" />
            </Form.Item>
            <Form.Item name="notes" label="备注">
              <Input.TextArea rows={2} placeholder="可选备注信息" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </Layout>
  );
};

export default SLAManagement;
