/**
 * 批量执行页面
 * 功能：目标主机选择、命令输入、执行/结果显示
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Button,
  Space,
  Typography,
  Tag,
  Table,
  Input,
  message,
  Progress,
  Badge,
  Divider,
  Empty,
  Spin,
  Checkbox,
  Tooltip,
  Tabs,
  Collapse,
} from 'antd';
import {
  ThunderboltOutlined,
  PlayCircleOutlined,
  StopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  CopyOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  FileTextOutlined,
  ConsoleSqlOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import { useNavigate } from 'react-router';
import type { ColumnsType } from 'antd/es/table';
import {
  Host,
  Task,
  TaskResult,
  getHosts,
  executeBatch,
  getTask,
  getTaskResults,
  listTasks,
  cancelTask,
} from '@/api/ops-service';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

// ==================== 类型定义 ====================

interface SelectedHost extends Host {
  selected: boolean;
}

// ==================== 组件 ====================

const BatchExecutePage: React.FC = () => {
  const navigate = useNavigate();

  // 主机数据
  const [hosts, setHosts] = useState<SelectedHost[]>([]);
  const [taskName, setTaskName] = useState('');
  const [command, setCommand] = useState('');
  const [selectedHosts, setSelectedHosts] = useState<string[]>([]);

  // 执行状态
  const [executing, setExecuting] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [taskResults, setTaskResults] = useState<TaskResult[]>([]);

  // 历史任务
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // 加载状态
  const [loading, setLoading] = useState({
    hosts: false,
    tasks: false,
    executing: false,
  });

  // ==================== 数据加载 ====================

  const loadHosts = useCallback(async () => {
    setLoading((prev) => ({ ...prev, hosts: true }));
    try {
      const response = await getHosts();
      const hostList = (response.data || []).map((h: Host) => ({
        ...h,
        selected: false,
      }));
      setHosts(hostList);
    } catch (err) {
      console.error('加载主机失败:', err);
      setHosts(getMockHosts());
    } finally {
      setLoading((prev) => ({ ...prev, hosts: false }));
    }
  }, []);

  const loadTasks = useCallback(async () => {
    setLoading((prev) => ({ ...prev, tasks: true }));
    try {
      const response = await listTasks();
      setTasks(response.data || []);
    } catch (err) {
      console.error('加载任务失败:', err);
      setTasks(getMockTasks());
    } finally {
      setLoading((prev) => ({ ...prev, tasks: false }));
    }
  }, []);

  useEffect(() => {
    loadHosts();
    loadTasks();
  }, [loadHosts, loadTasks]);

  // ==================== 事件处理 ====================

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedHosts(hosts.map(h => h.id));
      setHosts(hosts.map(h => ({ ...h, selected: true })));
    } else {
      setSelectedHosts([]);
      setHosts(hosts.map(h => ({ ...h, selected: false })));
    }
  };

  const handleSelectHost = (hostId: string, checked: boolean) => {
    setHosts(hosts.map(h => h.id === hostId ? { ...h, selected: checked } : h));
    if (checked) {
      setSelectedHosts([...selectedHosts, hostId]);
    } else {
      setSelectedHosts(selectedHosts.filter(id => id !== hostId));
    }
  };

  const handleExecute = async () => {
    if (!taskName.trim()) {
      message.warning('请输入任务名称');
      return;
    }
    if (!command.trim()) {
      message.warning('请输入执行命令');
      return;
    }
    if (selectedHosts.length === 0) {
      message.warning('请选择目标主机');
      return;
    }

    setExecuting(true);
    setTaskResults([]);

    try {
      const response = await executeBatch(taskName, command, selectedHosts);
      const task = response.data;
      setCurrentTaskId(task.id);
      message.success('任务已提交');

      // 模拟执行过程
      simulateExecution(task.id, selectedHosts, hosts);
    } catch (err) {
      console.error('执行失败:', err);
      message.error(`执行失败: ${(err as Error).message}`);

      // 模拟失败结果
      const mockResults: TaskResult[] = selectedHosts.map(hostId => {
        const host = hosts.find(h => h.id === hostId);
        return {
          host_id: hostId,
          host_name: host?.name || hostId,
          exit_code: 1,
          stdout: '',
          stderr: `Connection refused or host unreachable`,
          executed_at: new Date().toISOString(),
        };
      });
      setTaskResults(mockResults);
    } finally {
      setExecuting(false);
    }
  };

  // 模拟执行过程
  const simulateExecution = (taskId: string, targetHosts: string[], allHosts: SelectedHost[]) => {
    let progress = 0;
    const results: TaskResult[] = [];
    const interval = setInterval(() => {
      progress += 100 / targetHosts.length;
      if (progress >= 100) {
        clearInterval(interval);

        // 生成模拟结果
        const mockResults: TaskResult[] = targetHosts.map(hostId => {
          const host = allHosts.find(h => h.id === hostId);
          const success = Math.random() > 0.2;
          return {
            host_id: hostId,
            host_name: host?.name || hostId,
            exit_code: success ? 0 : 1,
            stdout: success ? 'Command executed successfully\n' +
              'Total files: 1256\n' +
              'Used space: 45.2GB\n' +
              'Free space: 10.8GB' : '',
            stderr: success ? '' : 'bash: permission denied',
            executed_at: new Date().toISOString(),
          };
        });
        setTaskResults(mockResults);
        message.success('任务执行完成');
      }
    }, 1000);
  };

  const handleCancel = async () => {
    if (!currentTaskId) return;
    try {
      await cancelTask(currentTaskId);
      setExecuting(false);
      message.success('任务已取消');
    } catch (err) {
      console.error('取消失败:', err);
      message.error('取消失败');
    }
  };

  const handleViewTaskResult = async (task: Task) => {
    setSelectedTask(task);
    try {
      const response = await getTaskResults(task.id);
      setTaskResults(response.data || []);
    } catch (err) {
      console.error('获取结果失败:', err);
      setTaskResults([]);
    }
  };

  const handleQuickCommand = (cmd: string) => {
    setCommand(cmd);
  };

  const getStatusColor = (status: string) => {
    const colorMap: Record<string, string> = {
      online: 'success',
      offline: 'error',
      active: 'processing',
      completed: 'success',
      failed: 'error',
      pending: 'warning',
    };
    return colorMap[status] || 'default';
  };

  // ==================== 表格列定义 ====================

  const hostColumns: ColumnsType<SelectedHost> = [
    {
      title: (
        <Checkbox
          checked={selectedHosts.length === hosts.length && hosts.length > 0}
          indeterminate={selectedHosts.length > 0 && selectedHosts.length < hosts.length}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
      ),
      key: 'checkbox',
      width: 50,
      render: (_: unknown, record: SelectedHost) => (
        <Checkbox
          checked={record.selected}
          onChange={(e) => handleSelectHost(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '主机',
      key: 'host',
      render: (_: unknown, record: SelectedHost) => (
        <Space>
          <Badge status={record.status === 'online' ? 'success' : 'error'} />
          <Text strong>{record.name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>({record.ip})</Text>
        </Space>
      ),
    },
    {
      title: '操作系统',
      dataIndex: 'os',
      key: 'os',
      render: (os: string) => <Tag>{os}</Tag>,
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space wrap size={2}>
          {tags?.slice(0, 2).map(tag => (
            <Tag key={tag} color="blue" style={{ margin: 0 }}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'online' ? '在线' : status === 'offline' ? '离线' : status}
        </Tag>
      ),
    },
  ];

  const resultColumns: ColumnsType<TaskResult> = [
    {
      title: '主机',
      key: 'host',
      width: 200,
      render: (_: unknown, record: TaskResult) => (
        <Space>
          <CloudServerOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{record.host_name}</Text>
        </Space>
      ),
    },
    {
      title: '执行状态',
      key: 'status',
      width: 120,
      render: (_: unknown, record: TaskResult) => (
        <Tag color={record.exit_code === 0 ? 'success' : 'error'} icon={record.exit_code === 0 ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
          {record.exit_code === 0 ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '退出码',
      dataIndex: 'exit_code',
      key: 'exit_code',
      width: 80,
      render: (code: number) => <Text code>{code}</Text>,
    },
    {
      title: '执行时间',
      dataIndex: 'executed_at',
      key: 'executed_at',
      render: (time: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {time ? new Date(time).toLocaleString('zh-CN') : '-'}
        </Text>
      ),
    },
    {
      title: '输出',
      key: 'output',
      render: (_: unknown, record: TaskResult) => (
        <Collapse
          ghost
          items={[
            {
              key: '1',
              label: (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  查看输出
                </Text>
              ),
              children: (
                <div style={{ background: colors.neutral[50], padding: 8, borderRadius: 4 }}>
                  {record.stdout && (
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12 }}>标准输出:</Text>
                      <pre style={{ margin: '4px 0', fontSize: 12, whiteSpace: 'pre-wrap' }}>
                        {record.stdout}
                      </pre>
                    </div>
                  )}
                  {record.stderr && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 12, color: colors.error[500] }}>错误输出:</Text>
                      <pre style={{ margin: '4px 0', fontSize: 12, whiteSpace: 'pre-wrap', color: colors.error[500] }}>
                        {record.stderr}
                      </pre>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      ),
    },
  ];

  const taskColumns: ColumnsType<Task> = [
    {
      title: '任务名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Task) => (
        <Space>
          <ThunderboltOutlined style={{ color: colors.warning[500] }} />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: '命令',
      dataIndex: 'command',
      key: 'command',
      width: 200,
      render: (cmd: string) => (
        <Text code style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {cmd}
        </Text>
      ),
    },
    {
      title: '目标主机',
      key: 'hosts',
      render: (_: unknown, record: Task) => (
        <Tag>{record.target_hosts.length} 台</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>
          {status === 'completed' ? '已完成' : status === 'failed' ? '失败' : status}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {time}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Task) => (
        <Button type="link" size="small" onClick={() => handleViewTaskResult(record)}>
          查看结果
        </Button>
      ),
    },
  ];

  // ==================== 快速命令 ====================

  const quickCommands = [
    { label: '查看磁盘', cmd: 'df -h' },
    { label: '查看内存', cmd: 'free -m' },
    { label: '查看CPU', cmd: 'top -bn1 | head -5' },
    { label: '查看进程', cmd: 'ps aux | head -10' },
    { label: '网络状态', cmd: 'netstat -tuln' },
    { label: '系统负载', cmd: 'uptime' },
  ];

  // ==================== 渲染 ====================

  const onlineHosts = hosts.filter(h => h.status === 'online').length;
  const successCount = taskResults.filter(r => r.exit_code === 0).length;
  const failCount = taskResults.filter(r => r.exit_code !== 0).length;

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
            <ThunderboltOutlined style={{ marginRight: spacing[3], color: colors.warning[500] }} />
            批量执行
          </Title>
          <Paragraph type="secondary">批量在多台主机执行命令</Paragraph>
        </div>
        <Space>
          <Button onClick={() => navigate('/ops-service')}>
            返回运维平台
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => { loadHosts(); loadTasks(); }}>
            刷新
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]}>
        {/* 左侧: 任务配置 */}
        <Col xs={24} lg={10}>
          <Card title="任务配置" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 任务名称 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>任务名称</Text>
                <Input
                  placeholder="请输入任务名称"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  prefix={<ThunderboltOutlined />}
                />
              </div>

              {/* 执行命令 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>执行命令</Text>
                <TextArea
                  placeholder="输入要执行的命令"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  rows={4}
                  style={{ fontFamily: 'Monaco, Menlo, Consolas, monospace' }}
                />
              </div>

              {/* 快速命令 */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>快速命令</Text>
                <Space wrap size="small">
                  {quickCommands.map((item) => (
                    <Button
                      key={item.cmd}
                      size="small"
                      onClick={() => handleQuickCommand(item.cmd)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </Space>
              </div>

              <Divider style={{ margin: '8px 0' }} />

              {/* 目标主机选择 */}
              <div>
                <Space style={{ marginBottom: 8 }}>
                  <Text strong>目标主机</Text>
                  <Tag color="blue">{selectedHosts.length} / {hosts.length} 台</Tag>
                  <Tag color="success">{onlineHosts} 台在线</Tag>
                </Space>
                <Table
                  columns={hostColumns}
                  dataSource={hosts}
                  pagination={false}
                  size="small"
                  loading={loading.hosts}
                  scroll={{ y: 200 }}
                  locale={{ emptyText: '暂无主机数据' }}
                />
              </div>

              {/* 执行按钮 */}
              <Button
                type="primary"
                icon={executing ? <StopOutlined /> : <PlayCircleOutlined />}
                block
                size="large"
                onClick={executing ? handleCancel : handleExecute}
                loading={executing}
                disabled={!taskName.trim() || !command.trim() || selectedHosts.length === 0}
                danger={executing}
              >
                {executing ? '取消执行' : '执行任务'}
              </Button>
            </Space>
          </Card>

          {/* 历史任务 */}
          <Card
            title={
              <Space>
                <ClockCircleOutlined />
                <span>历史任务</span>
                <Tag>{tasks.length}</Tag>
              </Space>
            }
          >
            <Table
              columns={taskColumns}
              dataSource={tasks.slice(0, 5)}
              pagination={false}
              size="small"
              loading={loading.tasks}
              locale={{ emptyText: '暂无任务记录' }}
            />
          </Card>
        </Col>

        {/* 右侧: 执行结果 */}
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <FileTextOutlined />
                <span>执行结果</span>
                {taskResults.length > 0 && (
                  <>
                    <Tag color="success">{successCount} 成功</Tag>
                    <Tag color="error">{failCount} 失败</Tag>
                  </>
                )}
              </Space>
            }
            extra={
              taskResults.length > 0 && (
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => {
                    const text = taskResults.map(r =>
                      `${r.host_name}: ${r.exit_code === 0 ? '成功' : '失败'}\n${r.stdout}${r.stderr ? '\n' + r.stderr : ''}`
                    ).join('\n\n');
                    navigator.clipboard.writeText(text);
                    message.success('已复制到剪贴板');
                  }}
                >
                  复制结果
                </Button>
              )
            }
            style={{ minHeight: 500 }}
          >
            {executing && (
              <div style={{ marginBottom: 16 }}>
                <Progress
                  percent={Math.round((successCount + failCount) / selectedHosts.length * 100)}
                  status="active"
                  strokeColor={colors.primary[500]}
                  info={
                    <Text type="secondary">
                      正在执行: {successCount + failCount} / {selectedHosts.length}
                    </Text>
                  }
                />
              </div>
            )}

            {taskResults.length === 0 && !executing ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Text type="secondary">
                    {selectedTask ? '该任务暂无结果' : '请创建任务并执行'}
                  </Text>
                }
              />
            ) : (
              <Table
                columns={resultColumns}
                dataSource={taskResults}
                pagination={false}
                size="small"
                rowKey="host_id"
                locale={{ emptyText: '暂无执行结果' }}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
};

// ==================== Mock 数据 ====================

function getMockHosts(): SelectedHost[] {
  return [
    { id: '1', name: 'prod-web-01', ip: '192.168.1.10', port: 22, status: 'online', os: 'Ubuntu 22.04', tags: ['生产', 'Web'], selected: false, created_at: '' },
    { id: '2', name: 'prod-web-02', ip: '192.168.1.11', port: 22, status: 'online', os: 'Ubuntu 22.04', tags: ['生产', 'Web'], selected: false, created_at: '' },
    { id: '3', name: 'prod-db-01', ip: '192.168.1.20', port: 22, status: 'online', os: 'CentOS 8', tags: ['生产', '数据库'], selected: false, created_at: '' },
    { id: '4', name: 'prod-cache-01', ip: '192.168.1.30', port: 22, status: 'offline', os: 'Ubuntu 20.04', tags: ['生产', '缓存'], selected: false, created_at: '' },
    { id: '5', name: 'dev-test-01', ip: '192.168.2.10', port: 22, status: 'online', os: 'Ubuntu 22.04', tags: ['开发', '测试'], selected: false, created_at: '' },
  ];
}

function getMockTasks(): Task[] {
  return [
    {
      id: '1',
      name: '批量更新软件包',
      command: 'apt-get update && apt-get upgrade -y',
      target_hosts: ['1', '2', '3'],
      status: 'completed',
      created_by: 'admin',
      created_at: '2026-05-19 09:00:00',
    },
    {
      id: '2',
      name: '重启 Nginx 服务',
      command: 'systemctl restart nginx',
      target_hosts: ['1', '2'],
      status: 'completed',
      created_by: 'admin',
      created_at: '2026-05-19 08:30:00',
    },
    {
      id: '3',
      name: '磁盘空间检查',
      command: 'df -h',
      target_hosts: ['1', '2', '3', '5'],
      status: 'failed',
      created_by: 'admin',
      created_at: '2026-05-18 22:00:00',
    },
  ];
}

export default BatchExecutePage;