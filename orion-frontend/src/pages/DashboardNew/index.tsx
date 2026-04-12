/**
 * 全新 Dashboard - 工作看板
 * 展示待处理事项、系统状态、快速入口
 */
import React from 'react';
import { Card, Row, Col, Statistic, Progress, Tag, Table, Typography, Badge, Button, Space } from 'antd';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  RocketOutlined,
  HistoryOutlined,
  PlayCircleOutlined,
  CodeOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// 模拟数据
const pipelineStats = {
  total: 24,
  running: 3,
  success: 156,
  failed: 8,
  pending: 5,
};

const recentPipelines = [
  { key: '1', name: 'frontend-deploy', status: 'running', duration: '2m 30s', trigger: 'heal', time: '2 分钟前' },
  { key: '2', name: 'api-service-build', status: 'success', duration: '5m 12s', trigger: 'ci-bot', time: '10 分钟前' },
  { key: '3', name: 'database-migration', status: 'pending', duration: '-', trigger: 'heal', time: '15 分钟前' },
  { key: '4', name: 'test-suite', status: 'failed', duration: '1m 45s', trigger: 'ci-bot', time: '1 小时前' },
  { key: '5', name: 'docs-build', status: 'success', duration: '3m 20s', trigger: 'heal', time: '2 小时前' },
];

const tasks = [
  { key: '1', title: '完成 F206 子应用联调测试', priority: 'high', status: 'in-progress', assignee: 'heal', due: '今天' },
  { key: '2', title: '修复 Pipeline 执行超时问题', priority: 'high', status: 'todo', assignee: 'heal', due: '明天' },
  { key: '3', title: '更新 API 文档', priority: 'medium', status: 'todo', assignee: 'team', due: '本周' },
  { key: '4', title: '代码审查 - PR #128', priority: 'medium', status: 'in-progress', assignee: 'heal', due: '今天' },
  { key: '5', title: '性能优化 - 启动速度', priority: 'low', status: 'todo', assignee: 'team', due: '下周' },
];

const systemHealth = [
  { name: 'API Gateway', status: 'healthy', latency: '45ms', uptime: '99.9%' },
  { name: 'Platform Service', status: 'healthy', latency: '32ms', uptime: '99.8%' },
  { name: 'Database', status: 'healthy', latency: '12ms', uptime: '99.99%' },
  { name: 'Redis', status: 'healthy', latency: '2ms', uptime: '99.95%' },
  { name: 'Event Bus', status: 'warning', latency: '156ms', uptime: '98.5%' },
];

const quickActions = [
  { name: '创建 Pipeline', icon: <RocketOutlined />, color: '#1890ff', path: '/pipelines/create' },
  { name: '查看日志', icon: <CodeOutlined />, color: '#52c41a', path: '/logs' },
  { name: '运行任务', icon: <PlayCircleOutlined />, color: '#722ed1', path: '/tasks' },
  { name: '历史记录', icon: <HistoryOutlined />, color: '#faad14', path: '/history' },
];

const statusColors: Record<string, string> = {
  running: 'processing',
  success: 'success',
  failed: 'error',
  pending: 'warning',
  healthy: 'success',
  warning: 'warning',
  error: 'error',
};

const priorityColors: Record<string, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

const DashboardNew: React.FC = () => {
  // 任务统计
  const taskStats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in-progress').length,
    todo: tasks.filter(t => t.status === 'todo').length,
    completed: 12,
  };

  const taskColumns = [
    {
      title: '任务',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: typeof tasks[0]) => (
        <Space direction="vertical" size={0} style={{ width: '100%' }}>
          <Text strong>{text}</Text>
          <Space size={8} style={{ marginTop: 4 }}>
            <Tag color={priorityColors[record.priority]}>{record.priority.toUpperCase()}</Tag>
            <Text type="secondary" style={{ fontSize: 12 }}>截止：{record.due}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const config: Record<string, { text: string; color: string }> = {
          'in-progress': { text: '进行中', color: 'blue' },
          'todo': { text: '待开始', color: 'default' },
          'done': { text: '已完成', color: 'green' },
        };
        const { text, color } = config[status] || { text: status, color: 'default' };
        return <Badge status={color as 'success' | 'processing' | 'error' | 'default' | 'warning'} text={text} />;
      },
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      key: 'assignee',
      render: (assignee: string) => (
        <Text code style={{ fontSize: 13 }}>{assignee}</Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => <Button type="link" size="small">处理</Button>,
    },
  ];

  const pipelineColumns = [
    {
      title: 'Pipeline',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text code>{name}</Text>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Badge status={statusColors[status] as 'success' | 'processing' | 'error' | 'default' | 'warning'} />
      ),
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
    },
    {
      title: '触发人',
      dataIndex: 'trigger',
      key: 'trigger',
    },
    {
      title: '时间',
      dataIndex: 'time',
      key: 'time',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: typeof recentPipelines[0]) => (
        <Button type="link" size="small" disabled={record.status === 'pending'}>
          {record.status === 'running' ? '查看' : '重试'}
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* 顶部统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Pipeline 总数"
              value={pipelineStats.total}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Progress
              percent={75}
              strokeColor="#1890ff"
              size="small"
              style={{ marginTop: 16 }}
              format={() => '本周完成率 75%'}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="运行中"
              value={pipelineStats.running}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color="processing">3 个任务执行中</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="成功"
              value={pipelineStats.success}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color="success">成功率 95%</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="待处理任务"
              value={taskStats.todo}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color="red">{taskStats.inProgress} 进行中</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 主要内容区 */}
      <Row gutter={[16, 16]}>
        {/* 左侧 - 任务和 Pipeline */}
        <Col xs={24} xl={16}>
          {/* 待处理任务 */}
          <Card
            title="待处理任务"
            extra={<Button type="link">查看全部</Button>}
            style={{ marginBottom: 16 }}
          >
            <Table
              columns={taskColumns}
              dataSource={tasks.slice(0, 4)}
              pagination={false}
              size="small"
            />
          </Card>

          {/* 最近 Pipeline */}
          <Card
            title="最近 Pipeline 执行"
            extra={<Button type="link">查看全部</Button>}
          >
            <Table
              columns={pipelineColumns}
              dataSource={recentPipelines}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 右侧 - 系统状态和快速操作 */}
        <Col xs={24} xl={8}>
          {/* 系统健康状态 */}
          <Card
            title="系统健康状态"
            style={{ marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {systemHealth.map((item) => (
                <div
                  key={item.name}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f5f5f5',
                  }}
                >
                  <Space>
                    <Badge status={statusColors[item.status] as 'success' | 'warning' | 'error'} />
                    <Text>{item.name}</Text>
                  </Space>
                  <Space>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.latency}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>{item.uptime}</Text>
                  </Space>
                </div>
              ))}
            </Space>
          </Card>

          {/* 快速操作 */}
          <Card title="快速操作" style={{ marginBottom: 16 }}>
            <Row gutter={[12, 12]}>
              {quickActions.map((action) => (
                <Col span={12} key={action.name}>
                  <Card
                    hoverable
                    size="small"
                    style={{
                      textAlign: 'center',
                      cursor: 'pointer',
                      height: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'center',
                      transition: 'all 0.3s',
                    }}
                  >
                    <div style={{ fontSize: 28, color: action.color, marginBottom: 8 }}>
                      {action.icon}
                    </div>
                    <Text style={{ fontSize: 12 }}>{action.name}</Text>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>

          {/* 公告/提醒 */}
          <Card title="系统提醒">
            <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
              <WarningOutlined style={{ color: '#faad14', marginRight: 8 }} />
              Event Bus 延迟较高，请检查 NATS 服务
            </Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 13 }}>
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              所有子系统运行正常
            </Paragraph>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default DashboardNew;
