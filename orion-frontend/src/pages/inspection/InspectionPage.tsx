/**
 * Intelligent Inspection Page (Phase 4 - Intelligent Inspection)
 * Automated system health checks, inspection rules, reports
 */
import React, { useState, useEffect } from 'react';
import {
  Typography, Table, Button, Tag, Space, Tabs, message,
  Modal, Form, Input, Select, Popconfirm, Progress, Card, Row, Col, Statistic,
} from 'antd';
import {
  ScanOutlined,
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import {
  listInspectionRules, createInspectionRule, deleteInspectionRule,
  createInspectionTask, listInspectionTasks,
  generateInspectionReport, listInspectionReports,
  getHealthScore,
  type InspectionRule, type InspectionTask, type InspectionReport,
} from '@/api/inspection';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

// ============================================================================
// Rules Tab
// ============================================================================

const RulesTab: React.FC = () => {
  const [rules, setRules] = useState<InspectionRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [form] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listInspectionRules();
      setRules((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载巡检规则失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreate = async (values: any) => {
    try {
      await createInspectionRule({
        name: values.name, description: values.description,
        target: values.target, checkType: values.checkType,
        threshold: values.threshold, operator: values.operator,
        schedule: values.schedule || '0 */1 * * *',
      });
      message.success('规则创建成功');
      setCreateModalOpen(false);
      form.resetFields();
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '创建失败');
    }
  };

  const handleRun = async (ruleId: string) => {
    try {
      await createInspectionTask({ ruleId });
      message.success('巡检任务已执行');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '执行失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInspectionRule(id);
      message.success('删除成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '删除失败');
    }
  };

  const typeColorMap: Record<string, string> = {
    cpu: colors.error[500],
    memory: colors.warning[500],
    disk: colors.info[500],
    network: colors.success[500],
    service: colors.purple[500],
    custom: colors.neutral[400],
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '目标', dataIndex: 'target', key: 'target' },
    {
      title: '检查类型', dataIndex: 'checkType', key: 'checkType',
      render: (t: string) => <Tag color={typeColorMap[t]}>{t}</Tag>,
    },
    { title: '条件', dataIndex: 'operator', key: 'operator', render: (op: string, r: InspectionRule) => `${op} ${r.threshold}` },
    { title: '调度', dataIndex: 'schedule', key: 'schedule' },
    {
      title: '状态', dataIndex: 'enabled', key: 'enabled',
      render: (e: boolean) => <Tag color={e ? colors.success[500] : colors.neutral[400]}>{e ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作', key: 'actions',
      render: (_: any, record: InspectionRule) => (
        <Space size="small">
          <Button size="small" type="link" icon={<ThunderboltOutlined />} onClick={() => handleRun(record.id)}>执行</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="link" danger>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <ScanOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            巡检规则
          </Title>
          <Text type="secondary">配置自动化巡检规则，定时检测系统健康状态</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>创建规则</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={rules} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />

      <Modal title="创建巡检规则" open={createModalOpen} onCancel={() => setCreateModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item label="名称" name="name" rules={[{ required: true }]}><Input placeholder="规则名称" /></Form.Item>
          <Form.Item label="目标" name="target" rules={[{ required: true }]}><Input placeholder="如: host-001, db-primary" /></Form.Item>
          <Form.Item label="检查类型" name="checkType" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="cpu">CPU 使用率</Select.Option>
              <Select.Option value="memory">内存使用率</Select.Option>
              <Select.Option value="disk">磁盘使用率</Select.Option>
              <Select.Option value="network">网络延迟</Select.Option>
              <Select.Option value="service">服务状态</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item label="条件" style={{ display: 'flex', gap: 8 }}>
            <Form.Item name="operator" initialValue="gt" style={{ marginBottom: 0, width: 100 }}>
              <Select>
                <Select.Option value="gt">大于</Select.Option>
                <Select.Option value="lt">小于</Select.Option>
                <Select.Option value="gte">大于等于</Select.Option>
                <Select.Option value="lte">小于等于</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="threshold" rules={[{ required: true }]} style={{ marginBottom: 0, flex: 1 }}>
              <Input type="number" placeholder="阈值" />
            </Form.Item>
          </Form.Item>
          <Form.Item label="Cron 表达式" name="schedule" initialValue="0 */1 * * *">
            <Input placeholder="如: 0 */1 * * * (每小时)" />
          </Form.Item>
          <Form.Item label="描述" name="description"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

// ============================================================================
// Tasks Tab
// ============================================================================

const TasksTab: React.FC = () => {
  const [tasks, setTasks] = useState<InspectionTask[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listInspectionTasks();
      setTasks((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载任务失败');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const statusColorMap: Record<string, string> = {
    pending: colors.neutral[400],
    running: colors.info[500],
    completed: colors.success[500],
    failed: colors.error[500],
  };

  const columns = [
    { title: '任务 ID', dataIndex: 'id', key: 'id', ellipsis: true, render: (v: string) => <code style={{ fontSize: 12 }}>{v.slice(0, 12)}...</code> },
    { title: '规则 ID', dataIndex: 'ruleId', key: 'ruleId', ellipsis: true },
    {
      title: '状态', dataIndex: 'status', key: 'status',
      render: (s: string) => <Tag color={statusColorMap[s]}>{s}</Tag>,
    },
    {
      title: '结果', key: 'result',
      render: (_: any, record: InspectionTask) => record.result ? (
        <Tag color={record.result.passed ? colors.success[500] : colors.error[500]}>
          {record.result.passed ? '通过' : `失败: ${record.result.actualValue}`}
        </Tag>
      ) : '-',
    },
    { title: '开始时间', dataIndex: 'startedAt', key: 'startedAt', render: (v: string) => v ? new Date(v).toLocaleString() : '-' },
    { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <ThunderboltOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            巡检任务
          </Title>
          <Text type="secondary">巡检任务执行记录与结果</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>
      <Table columns={columns} dataSource={tasks} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Reports Tab
// ============================================================================

const ReportsTab: React.FC = () => {
  const [reports, setReports] = useState<InspectionReport[]>([]);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listInspectionReports();
      setReports((res.data as any).data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载报告失败');
    } finally { setLoading(false); }
  };

  const handleGenerate = async () => {
    try {
      await generateInspectionReport({ title: `自动巡检报告 ${new Date().toLocaleDateString()}` });
      message.success('报告生成成功');
      loadData();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '生成失败');
    }
  };

  useEffect(() => { loadData(); }, []);

  const columns = [
    { title: '报告标题', dataIndex: 'title', key: 'title' },
    {
      title: '健康评分', dataIndex: 'summary', key: 'summary',
      render: (s: InspectionReport['summary']) => (
        <Progress percent={s.score} size="small" status={s.score >= 80 ? 'success' : s.score >= 60 ? 'normal' : 'exception'} style={{ width: 100 }} />
      ),
    },
    { title: '总检查数', dataIndex: 'summary', key: 'total', render: (s: InspectionReport['summary']) => s.total },
    { title: '通过', dataIndex: 'summary', key: 'passed', render: (s: InspectionReport['summary']) => <span style={{ color: colors.success[500] }}>{s.passed}</span> },
    { title: '失败', dataIndex: 'summary', key: 'failed', render: (s: InspectionReport['summary']) => <span style={{ color: colors.error[500] }}>{s.failed}</span> },
    { title: '生成时间', dataIndex: 'generatedAt', key: 'generatedAt', render: (v: string) => new Date(v).toLocaleString() },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ marginBottom: 8 }}>
            <FileTextOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
            巡检报告
          </Title>
          <Text type="secondary">系统健康巡检报告汇总</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleGenerate}>生成报告</Button>
        </Space>
      </div>
      <Table columns={columns} dataSource={reports} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} />
    </div>
  );
};

// ============================================================================
// Main Page
// ============================================================================

const InspectionPage: React.FC = () => {
  const [healthScore, setHealthScore] = useState(100);
  const [scoreDetails, setScoreDetails] = useState<Record<string, number>>({});

  const loadScore = async () => {
    try {
      const res = await getHealthScore();
      const data = (res.data as any).data;
      setHealthScore(data?.score || 100);
      setScoreDetails(data?.details || {});
    } catch { /* ignore */ }
  };

  useEffect(() => { loadScore(); }, []);

  const tabItems = [
    { key: 'rules', label: '巡检规则', children: <RulesTab /> },
    { key: 'tasks', label: '巡检任务', children: <TasksTab /> },
    { key: 'reports', label: '巡检报告', children: <ReportsTab /> },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Health Score Overview */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Title level={3} style={{ marginBottom: 16 }}>
              <SafetyOutlined style={{ marginRight: 12, color: colors.primary[500] }} />
              系统健康评分
            </Title>
          </Col>
          <Col span={4}>
            <Statistic title="综合评分" value={healthScore} suffix="/ 100" valueStyle={{ color: healthScore >= 80 ? colors.success[500] : healthScore >= 60 ? colors.warning[500] : colors.error[500] }} />
          </Col>
          {Object.entries(scoreDetails).map(([target, score]) => (
            <Col span={4} key={target}>
              <Statistic title={target} value={score} suffix="/ 100" valueStyle={{ color: score >= 80 ? colors.success[500] : score >= 60 ? colors.warning[500] : colors.error[500] }} />
            </Col>
          ))}
        </Row>
      </Card>

      <Tabs defaultActiveKey="rules" items={tabItems} size="large" />
    </div>
  );
};

export default InspectionPage;
