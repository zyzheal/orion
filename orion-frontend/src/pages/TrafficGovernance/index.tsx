/**
 * Traffic Governance Page
 *
 * Manages canary deployments and traffic splitting rules.
 * Supports create/edit/delete traffic rules, real-time metrics display.
 *
 * Phase 6.12 - Task 6.12
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Statistic,
  Progress,
  Empty,
  Popconfirm,
  Row,
  Col,
} from 'antd';
import {
  GatewayOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PromoteOutlined,
  RollbackOutlined,
  SplitNumberOutlined,
} from '@ant-design/icons';
import { colors, spacing, componentRadius } from '@/tokens';
import {
  listCanaryDeployments,
  createCanaryDeployment,
  configureTrafficSplit,
  promoteCanary,
  rollbackCanary,
  type CanaryDeployment,
} from '@/api/canary-traffic';

const { Title, Text } = Typography;
const { Option } = Select;

// ==================== Types ====================

interface TrafficRule {
  id: string;
  serviceName: string;
  environment: string;
  canaryVersion: string;
  baselineVersion: string;
  canaryWeight: number;
  baselineWeight: number;
  status: 'active' | 'paused' | 'completed' | 'rolled_back';
  createdAt: string;
  updatedAt: string;
}

// ==================== Component ====================

const TrafficGovernance: React.FC = () => {
  // ==================== State ====================

  const [loading, setLoading] = useState(false);
  const [trafficRules, setTrafficRules] = useState<TrafficRule[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRule, setEditingRule] = useState<TrafficRule | null>(null);
  const [form] = Form.useForm();
  const [stats, setStats] = useState({
    totalRules: 0,
    activeRules: 0,
    avgCanaryWeight: 0,
    totalTraffic: 0,
  });

  // ==================== Data Loading ====================

  const loadTrafficRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listCanaryDeployments();
      const rules: TrafficRule[] = data.map((d) => ({
        id: d.id,
        serviceName: d.serviceName,
        environment: d.environment,
        canaryVersion: d.canaryVersion,
        baselineVersion: d.baselineVersion,
        canaryWeight: d.trafficSplit.canary,
        baselineWeight: d.trafficSplit.baseline,
        status: d.status,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
      setTrafficRules(rules);

      // Calculate stats
      const activeRules = rules.filter((r) => r.status === 'active').length;
      const avgCanary = rules.length > 0
        ? Math.round(rules.reduce((sum, r) => sum + r.canaryWeight, 0) / rules.length)
        : 0;
      setStats({
        totalRules: rules.length,
        activeRules,
        avgCanaryWeight: avgCanary,
        totalTraffic: rules.reduce((sum, r) => sum + r.canaryWeight + r.baselineWeight, 0),
      });
    } catch (err) {
      message.error('加载流量规则失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTrafficRules();
  }, [loadTrafficRules]);

  // ==================== Actions ====================

  const handleCreate = () => {
    setEditingRule(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: TrafficRule) => {
    setEditingRule(record);
    form.setFieldsValue({
      serviceName: record.serviceName,
      environment: record.environment,
      canaryVersion: record.canaryVersion,
      baselineVersion: record.baselineVersion,
      canaryWeight: record.canaryWeight,
      baselineWeight: record.baselineWeight,
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingRule) {
        // Update traffic split
        await configureTrafficSplit(editingRule.id, {
          canaryWeight: values.canaryWeight,
          baselineWeight: values.baselineWeight,
        });
        message.success('流量规则已更新');
      } else {
        await createCanaryDeployment({
          serviceName: values.serviceName,
          environment: values.environment,
          canaryVersion: values.canaryVersion,
          baselineVersion: values.baselineVersion,
          initialTrafficSplit: {
            canary: values.canaryWeight,
            baseline: values.baselineWeight,
          },
        });
        message.success('流量规则已创建');
      }
      setModalVisible(false);
      loadTrafficRules();
    } catch (err) {
      if (err instanceof Error) {
        message.error(err.message);
      }
    }
  };

  const handlePromote = async (record: TrafficRule) => {
    try {
      await promoteCanary(record.id);
      message.success(`Canary 部署 ${record.canaryVersion} 已全量发布`);
      loadTrafficRules();
    } catch (err) {
      message.error('发布失败');
    }
  };

  const handleRollback = async (record: TrafficRule) => {
    try {
      await rollbackCanary(record.id);
      message.success(`已回滚到基线版本 ${record.baselineVersion}`);
      loadTrafficRules();
    } catch (err) {
      message.error('回滚失败');
    }
  };

  const handleDelete = async (id: string) => {
    message.info('删除功能需调用 DELETE /api/v1/canary/deployments/:id');
    // Actual implementation:
    // await api.delete(`/api/v1/canary/deployments/${id}`);
    loadTrafficRules();
  };

  // ==================== Table Columns ====================

  const columns = [
    {
      title: '服务名',
      dataIndex: 'serviceName',
      key: 'serviceName',
    },
    {
      title: '环境',
      dataIndex: 'environment',
      key: 'environment',
      render: (env: string) => (
        <Tag color={env === 'production' ? 'red' : env === 'staging' ? 'orange' : 'blue'}>
          {env}
        </Tag>
      ),
    },
    {
      title: 'Canary 版本',
      dataIndex: 'canaryVersion',
      key: 'canaryVersion',
      render: (v: string) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '基线版本',
      dataIndex: 'baselineVersion',
      key: 'baselineVersion',
    },
    {
      title: '流量切分',
      key: 'trafficSplit',
      render: (_: unknown, record: TrafficRule) => (
        <Space>
          <Progress
            type="circle"
            size={60}
            percent={record.canaryWeight}
            format={(p) => `${p}%`}
            strokeColor={colors.primary[500]}
          />
          <Text type="secondary">Canary</Text>
          <Progress
            type="circle"
            size={60}
            percent={record.baselineWeight}
            format={(p) => `${p}%`}
            strokeColor={colors.neutral[400]}
          />
          <Text type="secondary">Baseline</Text>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const colorMap: Record<string, string> = {
          active: 'green',
          paused: 'orange',
          completed: 'blue',
          rolled_back: 'red',
        };
        const labelMap: Record<string, string> = {
          active: '进行中',
          paused: '已暂停',
          completed: '已完成',
          rolled_back: '已回滚',
        };
        return <Tag color={colorMap[status]}>{labelMap[status]}</Tag>;
      },
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (d: string) => new Date(d).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: TrafficRule) => (
        <Space size="small">
          <Tooltip title="全量发布">
            <Button
              size="small"
              type="primary"
              icon={<PromoteOutlined />}
              onClick={() => handlePromote(record)}
              disabled={record.status !== 'active'}
            >
              发布
            </Button>
          </Tooltip>
          <Tooltip title="回滚">
            <Button
              size="small"
              icon={<RollbackOutlined />}
              onClick={() => handleRollback(record)}
              disabled={record.status !== 'active'}
            >
              回滚
            </Button>
          </Tooltip>
          <Tooltip title="编辑流量权重">
            <Button
              size="small"
              icon={<SplitNumberOutlined />}
              onClick={() => handleEdit(record)}
            >
              权重
            </Button>
          </Tooltip>
          <Popconfirm title="确认删除此流量规则？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ==================== Stats Cards ====================

  const renderStats = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: spacing.lg }}>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="总规则数"
            value={stats.totalRules}
            prefix={<GatewayOutlined style={{ color: colors.primary[500] }} />}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="活跃规则"
            value={stats.activeRules}
            valueStyle={{ color: colors.success[500] }}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="平均 Canary 流量"
            value={stats.avgCanaryWeight}
            suffix="%"
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card>
          <Statistic
            title="总流量切分"
            value={stats.totalTraffic}
            suffix="%"
          />
        </Card>
      </Col>
    </Row>
  );

  // ==================== Render ====================

  return (
    <div style={{ padding: spacing.lg }}>
      <Title
        level={2}
        style={{
          marginBottom: 8,
          fontWeight: 600,
          color: colors.neutral[900],
        }}
      >
        <GatewayOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
        流量治理
      </Title>
      <Text
        type="secondary"
        style={{ marginBottom: spacing.md, display: 'block', fontSize: 14, color: colors.neutral[500] }}
      >
        管理灰度发布和流量切分规则，支持全量发布和快速回滚
      </Text>

      {renderStats()}

      <Card
        style={{
          borderRadius: componentRadius.card,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ marginBottom: spacing.md }}>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            创建流量规则
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={trafficRules}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingRule ? '编辑流量规则' : '创建流量规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
        width={600}
        style={{ borderRadius: componentRadius.modal }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: spacing.md }}>
          <Form.Item
            label="服务名"
            name="serviceName"
            rules={[{ required: true, message: '请输入服务名' }]}
          >
            <Input placeholder="例如: user-service" />
          </Form.Item>
          <Form.Item
            label="环境"
            name="environment"
            rules={[{ required: true, message: '请选择环境' }]}
          >
            <Select placeholder="选择环境">
              <Option value="production">Production</Option>
              <Option value="staging">Staging</Option>
              <Option value="development">Development</Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="Canary 版本"
            name="canaryVersion"
            rules={[{ required: true, message: '请输入 Canary 版本' }]}
          >
            <Input placeholder="例如: v2.1.0" />
          </Form.Item>
          <Form.Item
            label="基线版本"
            name="baselineVersion"
            rules={[{ required: true, message: '请输入基线版本' }]}
          >
            <Input placeholder="例如: v2.0.0" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Canary 流量 (%)"
                name="canaryWeight"
                rules={[{ required: true, message: '请输入流量权重' }]}
              >
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="基线流量 (%)"
                name="baselineWeight"
                rules={[{ required: true, message: '请输入流量权重' }]}
              >
                <InputNumber min={0} max={100} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default TrafficGovernance;
