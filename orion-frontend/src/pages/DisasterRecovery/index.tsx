/**
 * Disaster Recovery Management Page (P4-04)
 * RTO/RPO 配置、灾备演练历史、灾备策略管理
 *
 * Features:
 * - 4 stats cards (RTO/RPO target, last drill, DR coverage)
 * - RTO/RPO configuration table with status indicators
 * - Disaster drill history (last 5)
 * - DR strategy info (Descriptions)
 * - Create DR plan Modal
 */

import React, { useState, useEffect } from 'react';
import { disasterRecoveryApi } from '@/api/disaster-recovery';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Modal,
  Form,
  Select,
  InputNumber,
  Row,
  Col,
  Descriptions,
  Table,
  Statistic,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SafetyCertificateOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  PieChartOutlined,
  DatabaseOutlined,
  PlusOutlined,
  ExperimentOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  CloudServerOutlined,
  HddOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';

const { Title, Text } = Typography;

// ==================== Types ====================

type RtoRpoStatus = 'pass' | 'fail' | 'untested';
type DrillResult = 'success' | 'partial' | 'failed';
type DrLevel = 'active-active' | 'active-passive' | 'backup-restore';

interface RtoRpoRecord {
  id: string;
  serviceName: string;
  rtoTarget: number; // minutes
  rtoActual: number | null; // minutes
  rpoTarget: number; // minutes
  rpoActual: number | null; // minutes
  status: RtoRpoStatus;
  drLevel: DrLevel;
  lastTestedAt: string;
}

interface DrillRecord {
  id: string;
  time: string;
  drillType: string;
  result: DrillResult;
  duration: number; // minutes
  service: string;
  description: string;
}

// ==================== Mock Data ====================

const mockRtoRpoRecords: RtoRpoRecord[] = [
  {
    id: '1',
    serviceName: 'api-gateway',
    rtoTarget: 5,
    rtoActual: 3.2,
    rpoTarget: 1,
    rpoActual: 0.5,
    status: 'pass',
    drLevel: 'active-active',
    lastTestedAt: '2026-08-05 14:30',
  },
  {
    id: '2',
    serviceName: 'user-service',
    rtoTarget: 10,
    rtoActual: 8.1,
    rpoTarget: 5,
    rpoActual: 3.2,
    status: 'pass',
    drLevel: 'active-passive',
    lastTestedAt: '2026-08-04 10:15',
  },
  {
    id: '3',
    serviceName: 'db-primary',
    rtoTarget: 15,
    rtoActual: 22.4,
    rpoTarget: 10,
    rpoActual: 8.7,
    status: 'fail',
    drLevel: 'active-passive',
    lastTestedAt: '2026-08-03 09:00',
  },
  {
    id: '4',
    serviceName: 'cache-cluster',
    rtoTarget: 3,
    rtoActual: 2.1,
    rpoTarget: 0,
    rpoActual: null,
    status: 'pass',
    drLevel: 'active-active',
    lastTestedAt: '2026-08-06 16:45',
  },
  {
    id: '5',
    serviceName: 'pipeline-engine',
    rtoTarget: 30,
    rtoActual: null,
    rpoTarget: 60,
    rpoActual: null,
    status: 'untested',
    drLevel: 'backup-restore',
    lastTestedAt: '-',
  },
  {
    id: '6',
    serviceName: 'monitor-svc',
    rtoTarget: 15,
    rtoActual: 14.2,
    rpoTarget: 15,
    rpoActual: 12.8,
    status: 'pass',
    drLevel: 'active-passive',
    lastTestedAt: '2026-08-07 11:20',
  },
];

const mockDrillRecords: DrillRecord[] = [
  {
    id: '1',
    time: '2026-08-07 09:00',
    drillType: '数据库切换演练',
    result: 'success',
    duration: 12,
    service: 'db-primary',
    description: '主从切换演练，自动 failover 成功，数据零丢失',
  },
  {
    id: '2',
    time: '2026-08-01 14:00',
    drillType: '跨可用区故障演练',
    result: 'success',
    duration: 45,
    service: 'user-service',
    description: '模拟 AZ-A 完全不可用，流量切换至 AZ-B',
  },
  {
    id: '3',
    time: '2026-07-25 10:30',
    drillType: '缓存雪崩恢复演练',
    result: 'partial',
    duration: 28,
    service: 'cache-cluster',
    description: 'Redis 集群全量故障恢复，部分热点 key 需要预热',
  },
  {
    id: '4',
    time: '2026-07-18 16:00',
    drillType: 'API 网关降级演练',
    result: 'success',
    duration: 5,
    service: 'api-gateway',
    description: '网关实例逐步下线验证，请求自动路由至健康实例',
  },
  {
    id: '5',
    time: '2026-07-10 11:00',
    drillType: '全量灾备恢复演练',
    result: 'failed',
    duration: 180,
    service: 'pipeline-engine',
    description: 'Pipeline 引擎从备份恢复失败，需人工介入重建任务状态',
  },
];

const drillResultConfig: Record<DrillResult, { label: string; color: string; icon: React.ReactNode }> = {
  success: { label: '成功', color: 'success', icon: <CheckCircleOutlined /> },
  partial: { label: '部分成功', color: 'warning', icon: <ExclamationCircleOutlined /> },
  failed: { label: '失败', color: 'error', icon: <CloseCircleOutlined /> },
};

const drLevelConfig: Record<DrLevel, { label: string; color: string }> = {
  'active-active': { label: '多活', color: 'blue' },
  'active-passive': { label: '主备', color: 'orange' },
  'backup-restore': { label: '备份恢复', color: 'default' },
};

const statusConfig: Record<RtoRpoStatus, { label: string; color: string }> = {
  pass: { label: '达标', color: 'success' },
  fail: { label: '超标', color: 'error' },
  untested: { label: '未测试', color: 'default' },
};

// ==================== Real Data Loading ====================

const DEFAULT_RTO_TARGET = '5 min';
const DEFAULT_RPO_TARGET = '1 min';
const DEFAULT_LAST_DRILL = '-';
const DEFAULT_COVERAGE = 0;

async function loadDRStatus() {
  try {
    const status = await disasterRecoveryApi.getDRStatus();
    return status;
  } catch {
    return null;
  }
}

async function loadDRPlans() {
  try {
    const plans = await disasterRecoveryApi.listDRPlans();
    return plans;
  } catch {
    return [];
  }
}

// ==================== Components ====================

const DisasterRecovery: React.FC = () => {
  const [rtoRpoRecords, setRtoRpoRecords] = useState<RtoRpoRecord[]>([]);
  const [drillRecords] = useState<DrillRecord[]>(mockDrillRecords);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [createForm] = Form.useForm();
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [testingType, setTestingType] = useState<'rto' | 'rpo' | null>(null);
  const [rtoTarget, setRtoTarget] = useState(DEFAULT_RTO_TARGET);
  const [rpoTarget, setRpoTarget] = useState(DEFAULT_RPO_TARGET);
  const [lastDrill, setLastDrill] = useState(DEFAULT_LAST_DRILL);
  const [coverage, setCoverage] = useState(DEFAULT_COVERAGE);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const [status, plans] = await Promise.all([loadDRStatus(), loadDRPlans()]);
      if (!mounted) return;

      if (plans && plans.length > 0) {
        const mapped = plans.map((p) => ({
          id: p.id,
          serviceName: p.name,
          rtoTarget: p.rto,
          rtoActual: null,
          rpoTarget: p.rpo,
          rpoActual: null,
          status: p.status === 'active' ? 'pass' : 'untested',
          drLevel: 'active-passive',
          lastTestedAt: p.lastTestedAt || '-',
        })) as RtoRpoRecord[];
        setRtoRpoRecords(mapped);
      }

      if (status) {
        setCoverage(Math.round((status.plans?.length || 0) / 10 * 100));
        const last = status.plans?.find((p) => p.lastTestedAt);
        if (last?.lastTestedAt) {
          setLastDrill(last.lastTestedAt.split(' ')[0] || DEFAULT_LAST_DRILL);
        }
        setLoading(false);
      } else {
        setRtoRpoRecords(mockRtoRpoRecords);
        setCoverage(0);
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const rtoRpoColumns: ColumnsType<RtoRpoRecord> = [
    {
      title: '系统/服务',
      dataIndex: 'serviceName',
      key: 'serviceName',
      render: (v: string) => (
        <Space>
          <DatabaseOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{v}</Text>
        </Space>
      ),
    },
    {
      title: 'RTO 目标',
      dataIndex: 'rtoTarget',
      key: 'rtoTarget',
      render: (v: number) => `${v} min`,
    },
    {
      title: 'RTO 实际',
      dataIndex: 'rtoActual',
      key: 'rtoActual',
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">-</Text>;
        const record = rtoRpoRecords.find((r) => r.rtoActual === v);
        const isOver = record && v > record.rtoTarget;
        return (
          <Text style={{ color: isOver ? colors.error[500] : colors.success[500] }}>
            {v} min {isOver ? '↑' : '✓'}
          </Text>
        );
      },
    },
    {
      title: 'RPO 目标',
      dataIndex: 'rpoTarget',
      key: 'rpoTarget',
      render: (v: number) => `${v} min`,
    },
    {
      title: 'RPO 实际',
      dataIndex: 'rpoActual',
      key: 'rpoActual',
      render: (v: number | null) => {
        if (v === null) return <Text type="secondary">-</Text>;
        const record = rtoRpoRecords.find((r) => r.rpoActual === v);
        const isOver = record && v > record.rpoTarget;
        return (
          <Text style={{ color: isOver ? colors.error[500] : colors.success[500] }}>
            {v} min {isOver ? '↑' : '✓'}
          </Text>
        );
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (v: RtoRpoStatus) => {
        const cfg = statusConfig[v];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '灾备级别',
      dataIndex: 'drLevel',
      key: 'drLevel',
      render: (v: DrLevel) => {
        const cfg = drLevelConfig[v];
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: RtoRpoRecord) => (
        <Space size={4}>
          <Tooltip title="测试 RTO">
            <Button
              type="text"
              size="small"
              icon={<ClockCircleOutlined />}
              disabled={record.status === 'untested'}
              loading={selectedRecordId === record.id && testingType === 'rto'}
              onClick={() => handleTest(record.id, 'rto')}
            />
          </Tooltip>
          <Tooltip title="测试 RPO">
            <Button
              type="text"
              size="small"
              icon={<ExperimentOutlined />}
              disabled={record.status === 'untested'}
              loading={selectedRecordId === record.id && testingType === 'rpo'}
              onClick={() => handleTest(record.id, 'rpo')}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const handleTest = async (id: string, type: 'rto' | 'rpo') => {
    setSelectedRecordId(id);
    setTestingType(type);
    setLoading(true);
    try {
      await disasterRecoveryApi.executeFailoverTest(id);
      message.success(`${type.toUpperCase()} 测试完成`);
    } catch {
      message.error(`${type.toUpperCase()} 测试失败`);
    } finally {
      setLoading(false);
      setSelectedRecordId(null);
      setTestingType(null);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setLoading(true);
      await disasterRecoveryApi.createDRPlan({
        name: values.serviceName,
        rpo: values.rpo,
        rto: values.rto,
        services: [values.serviceName],
      });
      message.success('灾备计划已创建');
      await loadDRPlans().then((plans) => {
        if (plans && plans.length > 0) {
          setRtoRpoRecords(plans.map((p) => ({
            id: p.id,
            serviceName: p.name,
            rtoTarget: p.rto,
            rtoActual: null,
            rpoTarget: p.rpo,
            rpoActual: null,
            status: 'pass',
            drLevel: values.drLevel,
            lastTestedAt: '-',
          })) as RtoRpoRecord[]);
        }
      });
      setCreateModalOpen(false);
      createForm.resetFields();
      setLoading(false);
    } catch {
      message.error('创建失败');
      setLoading(false);
    }
  };

  const drillColumns: ColumnsType<DrillRecord> = [
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
      render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text>,
    },
    {
      title: '类型',
      dataIndex: 'drillType',
      key: 'drillType',
    },
    {
      title: '结果',
      dataIndex: 'result',
      key: 'result',
      render: (v: DrillResult) => {
        const cfg = drillResultConfig[v];
        return (
          <Tag color={cfg.color} icon={cfg.icon}>
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      render: (v: number) => `${v} min`,
    },
  ];

  return (
    <div style={{ padding: spacing.lg }}>
      {/* Title */}
      <Title level={2} style={{ marginBottom: 8 }}>
        <SafetyCertificateOutlined style={{ marginRight: 12, color: colors.error[500] }} />
        灾备管理
      </Title>
      <Text type="secondary">RTO/RPO 配置 · 灾备演练 · 恢复计划</Text>

      {/* Top Stats Cards */}
      <Row gutter={spacing.md} style={{ marginTop: spacing.md, marginBottom: spacing.md }}>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.primary[500]}`,
            }}
          >
            <Statistic
              title="RTO 目标"
              value={rtoTarget}
              valueStyle={{ color: colors.primary[500] }}
              prefix={<ClockCircleOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>恢复时间目标</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.success[500]}`,
            }}
          >
            <Statistic
              title="RPO 目标"
              value={rpoTarget}
              valueStyle={{ color: colors.success[500] }}
              prefix={<DatabaseOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>恢复点目标</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.warning[500]}`,
            }}
          >
            <Statistic
              title="上次演练"
              value={lastDrill}
              valueStyle={{ color: colors.warning[500] }}
              prefix={<HistoryOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>最近演练时间</Text>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            style={{
              borderRadius: 12,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              borderLeft: `3px solid ${colors.info[500]}`,
            }}
          >
            <Statistic
              title="灾备覆盖率"
              value={coverage}
              valueStyle={{ color: colors.info[500] }}
              suffix="%"
              prefix={<PieChartOutlined />}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>系统灾备覆盖比例</Text>
          </Card>
        </Col>
      </Row>

      {/* Middle Row: Table + Drill History */}
      <Row gutter={16} style={{ marginBottom: spacing.md }}>
        {/* Left: RTO/RPO Configuration Table */}
        <Col span={14}>
          <Card
            title={
              <Space>
                <CloudServerOutlined />
                <Text strong>RTO/RPO 配置</Text>
              </Space>
            }
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  loading={loading}
                  onClick={async () => {
                    setLoading(true);
                    const plans = await loadDRPlans();
                    if (plans && plans.length > 0) {
                      setRtoRpoRecords(plans.map((p) => ({
                        id: p.id,
                        serviceName: p.name,
                        rtoTarget: p.rto,
                        rtoActual: null,
                        rpoTarget: p.rpo,
                        rpoActual: null,
                        status: 'pass',
                        drLevel: 'active-passive',
                        lastTestedAt: p.lastTestedAt || '-',
                      })) as RtoRpoRecord[]);
                    }
                    setLoading(false);
                    message.success('已刷新');
                  }}
                />
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  size="small"
                  onClick={() => setCreateModalOpen(true)}
                >
                  新建灾备计划
                </Button>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={rtoRpoColumns}
              dataSource={rtoRpoRecords}
              rowKey="id"
              size="small"
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>

        {/* Right: Drill History */}
        <Col span={10}>
          <Card
            title={
              <Space>
                <HistoryOutlined />
                <Text strong>灾备演练历史</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>(最近 5 次)</Text>
              </Space>
            }
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={drillColumns}
              dataSource={drillRecords}
              rowKey="id"
              size="small"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <Descriptions column={1} size="small" style={{ margin: 0, padding: '8px 16px' }}>
                    <Descriptions.Item label="服务">
                      <Tag color="blue">{record.service}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="描述">
                      <Text>{record.description}</Text>
                    </Descriptions.Item>
                  </Descriptions>
                ),
              }}
            />
          </Card>
        </Col>
      </Row>

      {/* Bottom: DR Strategy Info */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined />
            <Text strong>灾备策略</Text>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        <Descriptions
          bordered
          column={3}
          size="middle"
          style={{ borderRadius: 6 }}
        >
          <Descriptions.Item label="灾备级别">
            <Space>
              <Tag color="blue">多活</Tag>
              <Tag color="orange">主备</Tag>
              <Tag color="default">备份恢复</Tag>
            </Space>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              核心服务多活，辅助服务主备
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="备份频率">
            <Space>
              <Tag color="green">实时同步</Tag>
              <Tag color="blue">每小时</Tag>
              <Tag>每日</Tag>
            </Space>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
              根据 RPO 级别动态调整
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="存储位置">
            <Space>
              <HddOutlined />
              <Text>主数据中心 (DC-A)</Text>
            </Space>
            <Space style={{ marginTop: 4 }}>
              <HddOutlined />
              <Text>灾备中心 (DC-B)</Text>
            </Space>
            <Space style={{ marginTop: 4 }}>
              <HddOutlined />
              <Text>云端备份 (AWS S3)</Text>
            </Space>
          </Descriptions.Item>
          <Descriptions.Item label="RTO 策略">
            <Text>核心服务 &lt; 5min，辅助服务 &lt; 30min</Text>
          </Descriptions.Item>
          <Descriptions.Item label="RPO 策略">
            <Text>核心服务 &lt; 1min，辅助服务 &lt; 60min</Text>
          </Descriptions.Item>
          <Descriptions.Item label="切换方式">
            <Text>自动 failover + 手动确认</Text>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* Create DR Plan Modal */}
      <Modal
        title="新建灾备计划"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={handleCreate}
        confirmLoading={loading}
        width={520}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={createForm}
          layout="vertical"
          style={{ marginTop: 8 }}
        >
          <Form.Item
            label="服务名称"
            name="serviceName"
            rules={[{ required: true, message: '请选择服务名称' }]}
          >
            <Select
              placeholder="选择服务"
              options={[
                { value: 'api-gateway', label: 'api-gateway' },
                { value: 'user-service', label: 'user-service' },
                { value: 'db-primary', label: 'db-primary' },
                { value: 'cache-cluster', label: 'cache-cluster' },
                { value: 'pipeline-engine', label: 'pipeline-engine' },
                { value: 'monitor-svc', label: 'monitor-svc' },
              ]}
            />
          </Form.Item>
          <Form.Item
            label="RTO（分钟）"
            name="rto"
            rules={[{ required: true, message: '请输入 RTO 目标' }]}
          >
            <InputNumber
              min={1}
              max={600}
              style={{ width: '100%' }}
              placeholder="恢复时间目标（分钟）"
            />
          </Form.Item>
          <Form.Item
            label="RPO（分钟）"
            name="rpo"
            rules={[{ required: true, message: '请输入 RPO 目标' }]}
          >
            <InputNumber
              min={0}
              max={1440}
              style={{ width: '100%' }}
              placeholder="恢复点目标（分钟）"
            />
          </Form.Item>
          <Form.Item
            label="灾备级别"
            name="drLevel"
            initialValue="active-passive"
            rules={[{ required: true, message: '请选择灾备级别' }]}
          >
            <Select
              placeholder="选择灾备级别"
              options={[
                { value: 'active-active', label: '多活 (Active-Active)' },
                { value: 'active-passive', label: '主备 (Active-Passive)' },
                { value: 'backup-restore', label: '备份恢复 (Backup-Restore)' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DisasterRecovery;
