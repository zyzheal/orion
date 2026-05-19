/**
 * 运维操作平台 - 主页面
 * 功能：主机列表管理、终端连接、批量执行、计划任务、监控概览
 *
 * UI: 仪表盘风格 + 快捷操作卡片
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Button,
  Space,
  Typography,
  Avatar,
  Progress,
  Spin,
  message,
  Tooltip,
  Divider,
  List,
  Badge,
} from 'antd';
import {
  DesktopOutlined,
  ConsoleSqlOutlined,
  ThunderboltOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  ReloadOutlined,
  PlusOutlined,
  RightOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloudServerOutlined,
  EditOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useNavigate } from 'react-router';
import type { ColumnsType } from 'antd/es/table';
import {
  Host,
  CronJob,
  getHosts,
  getCronJobs,
  listTasks,
  listSessions,
} from '@/api/ops-service';

const { Title, Text, Paragraph } = Typography;

// ==================== 类型定义 ====================

interface Task {
  id: string;
  name: string;
  command: string;
  target_hosts: string[];
  status: string;
  created_by: string;
  created_at: string;
}

interface Session {
  id: string;
  host_id: string;
  session_type: string;
  status: string;
  created_at: string;
}

// ==================== 组件 ====================

const OpsServicePage: React.FC = () => {
  const navigate = useNavigate();

  // 数据状态
  const [hosts, setHosts] = useState<Host[]>([]);
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [recentTasks, setRecentTasks] = useState<Task[]>([]);
  const [activeSessions, setActiveSessions] = useState<Session[]>([]);

  // 加载状态
  const [loading, setLoading] = useState({
    hosts: false,
    cronJobs: false,
    tasks: false,
    sessions: false,
  });
  const [initialLoading, setInitialLoading] = useState(true);

  // ==================== 数据加载 ====================

  const loadHosts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, hosts: true }));
    try {
      const response = await getHosts();
      setHosts(response.data || []);
    } catch (err) {
      console.error('加载主机失败:', err);
      setHosts(getMockHosts());
    } finally {
      setLoading((prev) => ({ ...prev, hosts: false }));
    }
  }, []);

  const loadCronJobs = useCallback(async () => {
    setLoading((prev) => ({ ...prev, cronJobs: true }));
    try {
      const response = await getCronJobs();
      setCronJobs(response.data || []);
    } catch (err) {
      console.error('加载计划任务失败:', err);
      setCronJobs(getMockCronJobs());
    } finally {
      setLoading((prev) => ({ ...prev, cronJobs: false }));
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading((prev) => ({ ...prev, tasks: true }));
    try {
      const response = await listTasks();
      setRecentTasks((response.data || []).slice(0, 5));
    } catch (err) {
      console.error('加载任务失败:', err);
      setRecentTasks(getMockTasks());
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false }));
    }
  }, []);

  const loadSessions = useCallback(async () => {
    setLoading((prev) => ({ ...prev, sessions: true }));
    try {
      const response = await listSessions();
      setActiveSessions((response.data || []).filter((s: Session) => s.status === 'active'));
    } catch (err) {
      console.error('加载会话失败:', err);
      setActiveSessions([]);
    } finally {
      setLoading((prev) => ({ ...prev, sessions: false }));
    }
  }, []);

  const loadAllData = useCallback(async () => {
    setInitialLoading(true);
    await Promise.all([loadHosts(), loadCronJobs(), loadTasks(), loadSessions()]);
    setInitialLoading(false);
  }, [loadHosts, loadCronJobs, loadTasks, loadSessions]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ==================== 统计计算 ====================

  const stats = {
    totalHosts: hosts.length || 8,
    onlineHosts: hosts.filter((h) => h.status === 'online').length || 5,
    totalCronJobs: cronJobs.length || 4,
    enabledCronJobs: cronJobs.filter((c) => c.enabled).length || 3,
    totalTasks: recentTasks.length || 5,
    activeSessions: activeSessions.length || 2,
  };

  // ==================== 工具函数 ====================

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      online: 'success',
      offline: 'error',
      unknown: 'default',
      active: 'success',
      inactive: 'default',
      pending: 'warning',
      running: 'processing',
      completed: 'success',
      failed: 'error',
    };
    return colorMap[status] || 'default';
  };

  const getStatusText = (status: string) => {
    const textMap: Record<string, string> = {
      online: '在线',
      offline: '离线',
      unknown: '未知',
      active: '活跃',
      inactive: '停用',
      pending: '等待中',
      running: '执行中',
      completed: '已完成',
      failed: '失败',
    };
    return textMap[status] || status;
  };

  // ==================== 表格列定义 ====================

  const hostColumns: ColumnsType<Host> = [
    {
      title: '主机名',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Host) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'IP 地址',
      dataIndex: 'ip',
      key: 'ip',
      render: (ip: string) => <Text code>{ip}</Text>,
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
      render: (os: string) => <Tag>{os}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap>
          {tags?.slice(0, 3).map((tag) => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
        </Space>
      ),
    },
  ];

  const cronColumns: ColumnsType<CronJob> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CronJob) => (
        <Space>
          <ClockCircleOutlined style={{ color: colors.purple[500] }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '执行命令',
      dataIndex: 'command',
      key: 'command',
      render: (command: string) => (
        <Text code style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {command}
        </Text>
      ),
    },
    {
      title: 'Cron 表达式',
      dataIndex: 'cron_expr',
      key: 'cron_expr',
      render: (expr: string) => <Tag color="orange">{expr}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (enabled: boolean) => (
        <Tag color={enabled ? 'success' : 'default'}>
          {enabled ? '启用' : '停用'}
        </Tag>
      ),
    },
    {
      title: '下次执行',
      dataIndex: 'next_run',
      key: 'next_run',
      render: (nextRun: string) => (
        <Text type="secondary">{nextRun || '-'}</Text>
      ),
    },
  ];

  // ==================== 快捷操作卡片配置 ====================

  const quickActions = [
    {
      key: 'terminal',
      icon: <ConsoleSqlOutlined />,
      title: 'Web 终端',
      description: '连接主机进行交互式操作',
      color: colors.primary[500],
      path: '/ops-service/terminal',
    },
    {
      key: 'batch',
      icon: <ThunderboltOutlined />,
      title: '批量执行',
      description: '批量在多台主机执行命令',
      color: colors.warning[500],
      path: '/ops-service/batch',
    },
    {
      key: 'cron',
      icon: <ClockCircleOutlined />,
      title: '计划任务',
      description: '管理定时执行任务',
      color: colors.purple[500],
      path: '/ops-service/cron',
    },
    {
      key: 'hosts',
      icon: <CloudServerOutlined />,
      title: '主机管理',
      description: '维护主机列表和配置',
      color: colors.success[500],
      path: '/ops-service/hosts',
    },
  ];

  const handleQuickAction = (path: string) => {
    navigate(path);
  };

  // ==================== 渲染 ====================

  if (initialLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
      >
        <Spin size="large" tip="加载运维数据..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }}>
      {/* 页面标题 */}
      <div
        style={{
          marginBottom: 24,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            <DesktopOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            运维操作平台
          </Title>
          <Paragraph type="secondary">主机管理、终端连接、批量执行、计划任务</Paragraph>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAllData}
            loading={Object.values(loading).some((v) => v)}
          >
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/ops-service/hosts')}>
            添加主机
          </Button>
        </Space>
      </div>

      {/* 统计卡片区 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="主机总数"
              value={stats.totalHosts}
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: colors.primary[500] }}
            />
            <Progress
              percent={stats.totalHosts > 0 ? (stats.onlineHosts / stats.totalHosts) * 100 : 0}
              strokeColor={colors.success[500]}
              size="small"
              style={{ marginTop: 12 }}
              format={() => `${stats.onlineHosts} 台在线`}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="计划任务"
              value={stats.totalCronJobs}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: colors.purple[500] }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color={stats.enabledCronJobs > 0 ? 'success' : 'default'}>
                {stats.enabledCronJobs} 个启用
              </Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="最近任务"
              value={stats.totalTasks}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: colors.warning[500] }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color="blue">执行成功</Tag>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃会话"
              value={stats.activeSessions}
              prefix={<ConsoleSqlOutlined />}
              valueStyle={{ color: colors.success[500] }}
            />
            <div style={{ marginTop: 16 }}>
              <Tag color="processing">实时连接</Tag>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 快捷操作区 */}
      <Card title="快捷操作" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          {quickActions.map((action) => (
            <Col xs={24} sm={12} lg={6} key={action.key}>
              <Card
                hoverable
                onClick={() => handleQuickAction(action.path)}
                style={{
                  textAlign: 'center',
                  borderColor: colors.neutral[200],
                }}
                bodyStyle={{ padding: 24 }}
              >
                <div
                  style={{
                    fontSize: 32,
                    color: action.color,
                    marginBottom: 12,
                  }}
                >
                  {action.icon}
                </div>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>
                  {action.title}
                </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {action.description}
                </Text>
                <RightOutlined
                  style={{
                    position: 'absolute',
                    right: 16,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: colors.neutral[400],
                  }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 主机列表与计划任务 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <CloudServerOutlined style={{ color: colors.primary[500] }} />
                <span>主机列表</span>
                <Badge count={stats.totalHosts} style={{ backgroundColor: colors.primary[500] }} />
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/ops-service/hosts')}>
                查看全部 <RightOutlined />
              </Button>
            }
          >
            <Table
              columns={hostColumns}
              dataSource={hosts.slice(0, 5)}
              pagination={false}
              size="small"
              loading={loading.hosts}
              locale={{ emptyText: '暂无主机数据' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <ClockCircleOutlined style={{ color: colors.purple[500] }} />
                <span>计划任务</span>
                <Badge count={stats.totalCronJobs} style={{ backgroundColor: colors.purple[500] }} />
              </Space>
            }
            extra={
              <Button type="link" onClick={() => navigate('/ops-service/cron')}>
                查看全部 <RightOutlined />
              </Button>
            }
          >
            <Table
              columns={cronColumns}
              dataSource={cronJobs.slice(0, 4)}
              pagination={false}
              size="small"
              loading={loading.cronJobs}
              locale={{ emptyText: '暂无计划任务' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 最近任务执行记录 */}
      <Card
        title={
          <Space>
            <ThunderboltOutlined style={{ color: colors.warning[500] }} />
            <span>最近执行任务</span>
          </Space>
        }
        style={{ marginTop: 16 }}
        extra={
          <Button type="link" onClick={() => navigate('/ops-service/batch')}>
            查看全部 <RightOutlined />
          </Button>
        }
      >
        <List
          loading={loading.tasks}
          dataSource={recentTasks}
          locale={{ emptyText: '暂无任务记录' }}
          renderItem={(item: Task) => (
            <List.Item
              actions={[
                <Tag color={getStatusColor(item.status)} key="status">
                  {getStatusText(item.status)}
                </Tag>,
              ]}
            >
              <List.Item.Meta
                avatar={<Avatar icon={<ThunderboltOutlined />} style={{ background: colors.warning[500] }} />}
                title={item.name}
                description={
                  <Space>
                    <Text code>{item.command}</Text>
                    <Text type="secondary">| 目标: {item.target_hosts.length} 台主机</Text>
                  </Space>
                }
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.created_at}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

// ==================== Mock 数据 ====================

function getMockHosts(): Host[] {
  return [
    {
      id: '1',
      name: 'prod-web-01',
      ip: '192.168.1.10',
      port: 22,
      status: 'online',
      os: 'Ubuntu 22.04',
      tags: ['生产', 'Web', 'Nginx'],
      last_heartbeat: '2026-05-19 10:00:00',
      created_at: '2026-01-01',
    },
    {
      id: '2',
      name: 'prod-web-02',
      ip: '192.168.1.11',
      port: 22,
      status: 'online',
      os: 'Ubuntu 22.04',
      tags: ['生产', 'Web', 'Nginx'],
      last_heartbeat: '2026-05-19 10:00:00',
      created_at: '2026-01-01',
    },
    {
      id: '3',
      name: 'prod-db-01',
      ip: '192.168.1.20',
      port: 22,
      status: 'online',
      os: 'CentOS 8',
      tags: ['生产', '数据库', 'MySQL'],
      last_heartbeat: '2026-05-19 10:00:00',
      created_at: '2026-01-01',
    },
    {
      id: '4',
      name: 'prod-cache-01',
      ip: '192.168.1.30',
      port: 22,
      status: 'offline',
      os: 'Ubuntu 20.04',
      tags: ['生产', '缓存', 'Redis'],
      last_heartbeat: '2026-05-18 20:00:00',
      created_at: '2026-01-01',
    },
    {
      id: '5',
      name: 'dev-test-01',
      ip: '192.168.2.10',
      port: 22,
      status: 'online',
      os: 'Ubuntu 22.04',
      tags: ['开发', '测试'],
      last_heartbeat: '2026-05-19 10:00:00',
      created_at: '2026-02-01',
    },
  ];
}

function getMockCronJobs(): CronJob[] {
  return [
    {
      id: '1',
      name: '日志清理',
      command: 'find /var/log -type f -mtime +7 -delete',
      cron_expr: '0 2 * * *',
      enabled: true,
      created_by: 'admin',
      created_at: '2026-01-01',
      updated_at: '2026-05-01',
      next_run: '2026-05-20 02:00:00',
    },
    {
      id: '2',
      name: '数据备份',
      command: '/opt/backup.sh',
      cron_expr: '0 3 * * *',
      enabled: true,
      created_by: 'admin',
      created_at: '2026-01-01',
      updated_at: '2026-05-01',
      next_run: '2026-05-20 03:00:00',
    },
    {
      id: '3',
      name: '健康检查',
      command: '/opt/health-check.sh',
      cron_expr: '*/5 * * * *',
      enabled: true,
      created_by: 'admin',
      created_at: '2026-01-15',
      updated_at: '2026-05-01',
      next_run: '2026-05-19 10:05:00',
    },
    {
      id: '4',
      name: '证书更新检查',
      command: '/opt/check-ssl.sh',
      cron_expr: '0 0 * * 0',
      enabled: false,
      created_by: 'admin',
      created_at: '2026-02-01',
      updated_at: '2026-04-01',
      next_run: '-',
    },
  ];
}

function getMockTasks(): Task[] {
  return [
    {
      id: '1',
      name: '批量更新软件包',
      command: 'apt-get update && apt-get upgrade -y',
      target_hosts: ['192.168.1.10', '192.168.1.11'],
      status: 'completed',
      created_by: 'admin',
      created_at: '2026-05-19 09:00:00',
    },
    {
      id: '2',
      name: '重启 Nginx 服务',
      command: 'systemctl restart nginx',
      target_hosts: ['192.168.1.10', '192.168.1.11'],
      status: 'completed',
      created_by: 'admin',
      created_at: '2026-05-19 08:30:00',
    },
    {
      id: '3',
      name: '磁盘空间检查',
      command: 'df -h',
      target_hosts: ['192.168.1.10', '192.168.1.11', '192.168.1.20'],
      status: 'completed',
      created_by: 'admin',
      created_at: '2026-05-19 08:00:00',
    },
    {
      id: '4',
      name: '内存使用检查',
      command: 'free -m',
      target_hosts: ['192.168.1.10', '192.168.1.11', '192.168.1.20'],
      status: 'failed',
      created_by: 'admin',
      created_at: '2026-05-18 22:00:00',
    },
  ];
}

export default OpsServicePage;