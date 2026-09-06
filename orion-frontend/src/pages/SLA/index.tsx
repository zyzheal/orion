/**
 * SLA Management Page
 * SLA definitions CRUD, tracking management, breach event log, compliance statistics
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Row,
  Col,
  Modal,
  Form,
  Input,
  Select,
  message,
  Tabs,
  InputNumber,
  Switch,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ExclamationCircleOutlined,
  FieldTimeOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { Layout } from '@/components/Layout';
import Table from '@/components/Table';
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
import type { SLADefinition, SLATracking, SLABreachEvent, SLAStats } from '@/api/sla';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  TRACKING_STATUS_LABEL_MAP,
  TRACKING_STATUS_OPTIONS,
  TYPE_OPTIONS,
  DEF_STATUS_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
  TARGET_UNIT_OPTIONS,
} from './config';
import {
  getDefColumns,
  getTrackingColumns,
  breachColumns,
} from './columns';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

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
    definitions.forEach((d) => {
      map[d.id] = d;
    });
    return map;
  }, [definitions]);

  // ---- Handlers: Definitions ----

  const handleSaveDefinition = async (values: any) => {
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

  const handleCreateTracking = async (values: any) => {
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

  // ---- Column definitions (factories) ----

  const defColumns = useMemo(
    () => getDefColumns({ onEdit: openEditDefModal, onDelete: handleDeleteDefinition }),
    [openEditDefModal, handleDeleteDefinition],
  );

  const trackingColumns = useMemo(
    () => getTrackingColumns({
      onStatusUpdate: handleUpdateTrackingStatus,
      onBreach: handleMarkBreach,
      definitionMap,
    }),
    [handleUpdateTrackingStatus, handleMarkBreach, definitionMap],
  );

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
              <Text type="secondary" style={{ fontSize: 13 }}>
                SLA 定义总数
              </Text>
              <div
                style={{ fontSize: 28, fontWeight: 600, color: colors.neutral[900], marginTop: 4 }}
              >
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
              <Text type="secondary" style={{ fontSize: 13 }}>
                活跃追踪
              </Text>
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
              <Text type="secondary" style={{ fontSize: 13 }}>
                违约次数
              </Text>
              <div
                style={{ fontSize: 28, fontWeight: 600, color: colors.error[600], marginTop: 4 }}
              >
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
              <Text type="secondary" style={{ fontSize: 13 }}>
                合规率
              </Text>
              <div
                style={{ fontSize: 28, fontWeight: 600, color: colors.success[600], marginTop: 4 }}
              >
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

  // ---- Tab Items ----

  const tabItems = useMemo(
    () => [
      {
        key: 'definitions',
        label: `SLA 定义 (${defTotal})`,
        children: (
          <>
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
                  options={TYPE_OPTIONS}
                />
                <Select
                  placeholder="状态筛选"
                  allowClear
                  style={{ width: 120 }}
                  value={defStatusFilter}
                  onChange={(v) => setDefStatusFilter(v)}
                  options={DEF_STATUS_OPTIONS}
                />
              </Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateDefModal}>
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
                  options={TRACKING_STATUS_OPTIONS}
                />
                <Select
                  placeholder="实体类型"
                  allowClear
                  style={{ width: 120 }}
                  value={trackingEntityFilter}
                  onChange={(v) => setTrackingEntityFilter(v)}
                  options={ENTITY_TYPE_OPTIONS}
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
      defTotal,
      definitions,
      defColumns,
      defTypeFilter,
      defStatusFilter,
      trackingTotal,
      trackings,
      trackingColumns,
      trackingStatusFilter,
      trackingEntityFilter,
      breachTotal,
      breaches,
      breachTrackingFilter,
      loading,
      trackingForm,
    ]
  );

  // ---- Render ----

  return (
    <Layout>
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
              <SafetyCertificateOutlined
                style={{ marginRight: spacing[3], color: colors.primary[500] }}
              />
              SLA 管理
            </Title>
            <Text type="secondary">定义、追踪和管理服务级别协议，确保服务质量达标</Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
            刷新
          </Button>
        </div>

        {statsBar}

        <Card
          style={{ borderRadius: componentRadius.card, boxShadow: shadows.card }}
          styles={{ body: { padding: spacing.lg } }}
        >
          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
        </Card>

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
                  <Select placeholder="选择类型" options={TYPE_OPTIONS} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="priority" label="优先级">
                  <Select
                    placeholder="选择优先级"
                    allowClear
                    options={PRIORITY_OPTIONS}
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
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="例如: 30" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="target_unit"
                  label="目标单位"
                  rules={[{ required: true, message: '请选择单位' }]}
                >
                  <Select placeholder="选择单位" options={TARGET_UNIT_OPTIONS} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="category" label="分类">
              <Input placeholder="例如: incident, change, request" />
            </Form.Item>
            <Form.Item name="business_hours_only" label="仅工作时间" valuePropName="checked">
              <Switch />
            </Form.Item>
          </Form>
        </Modal>

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
                options={ENTITY_TYPE_OPTIONS}
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
