/**
 * Task Timeouts Management Page
 *
 * 超时任务管理页面 - 显示超时任务、手动触发检查、查看检查器状态
 */
import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Card,
  Typography,
  Statistic,
  Row,
  Col,
  message,
  Tooltip,
} from 'antd';
import {
  ClockCircleOutlined,
  ThunderboltOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ExclamationCircleOutlined,
  QuestionCircleOutlined,
} from '@ant-design/icons';
import {
  getTimedOutTasks,
  triggerCheckNow,
  getTimeoutStatus,
  TimedOutTask,
  TimeoutStatus,
} from '@/api/task-timeout';
import { colors } from '@/tokens/colors';

const { Title, Text } = Typography;

/**
 * 超时动作标签
 */
const getActionTag = (action: string) => {
  switch (action) {
    case 'remind':
      return <Tag color="blue">提醒</Tag>;
    case 'escalate':
      return <Tag color="orange">升级</Tag>;
    case 'auto_complete':
      return <Tag color="green">自动完成</Tag>;
    case 'cancel':
      return <Tag color="red">取消</Tag>;
    default:
      return <Tag>{action}</Tag>;
  }
};

/**
 * 动作说明
 */
const actionDescriptions: Record<string, string> = {
  remind: '发送提醒通知给任务负责人',
  escalate: '将任务升级给上级处理',
  auto_complete: '自动完成任务',
  cancel: '取消任务并跳过',
};

const TaskTimeoutsPage: React.FC = () => {
  const [timedOutTasks, setTimedOutTasks] = useState<TimedOutTask[]>([]);
  const [status, setStatus] = useState<TimeoutStatus>({
    isRunning: false,
    processedEventsCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // 获取超时任务列表
  const fetchTimedOutTasks = async () => {
    setLoading(true);
    try {
      const res = await getTimedOutTasks();
      setTimedOutTasks(res.data?.data || []);
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '加载超时任务失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取检查器状态
  const fetchStatus = async () => {
    try {
      const res = await getTimeoutStatus();
      setStatus(res.data?.data || { isRunning: false, processedEventsCount: 0 });
    } catch (error: unknown) {
      console.error('Failed to fetch status:', error);
    }
  };

  // 初始化加载
  useEffect(() => {
    fetchTimedOutTasks();
    fetchStatus();
  }, []);

  // 手动触发检查
  const handleCheckNow = async () => {
    setChecking(true);
    try {
      const res = await triggerCheckNow();
      const result = res.data?.data;
      message.success(
        `检查完成，已处理 ${result?.checkedTasks || 0} 个超时任务`
      );
      fetchTimedOutTasks();
      fetchStatus();
    } catch (error: unknown) {
      message.error(error instanceof Error ? error.message : '触发检查失败');
    } finally {
      setChecking(false);
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '任务ID',
      dataIndex: ['task', 'id'],
      key: 'taskId',
      width: 100,
      ellipsis: true,
      render: (id: string) => (
        <Tooltip title={id}>
          <Text code style={{ fontSize: 12 }}>{id.slice(0, 8)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: '任务标题',
      dataIndex: ['task', 'title'],
      key: 'title',
      ellipsis: true,
      render: (title: string, record: TimedOutTask) => (
        <Space direction="vertical" size={0}>
          <Text strong>{title}</Text>
          {record.task.description && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {record.task.description.length > 50
                ? record.task.description.slice(0, 50) + '...'
                : record.task.description}
            </Text>
          )}
        </Space>
      ),
    },
    {
      title: '负责人',
      dataIndex: ['task', 'assigneeName'],
      key: 'assigneeName',
      width: 120,
      render: (name: string | undefined, record: TimedOutTask) => (
        name || record.task.assigneeId || '-'
      ),
    },
    {
      title: '超时时长',
      dataIndex: 'overdueHours',
      key: 'overdueHours',
      width: 100,
      sorter: (a: TimedOutTask, b: TimedOutTask) => b.overdueHours - a.overdueHours,
      render: (hours: number) => {
        const isCritical = hours > 24;
        const isWarning = hours > 4;
        return (
          <Space>
            <ClockCircleOutlined
              style={{
                color: isCritical
                  ? colors.error[500]
                  : isWarning
                  ? colors.warning[500]
                  : colors.neutral[500],
              }}
            />
            <Text
              style={{
                color: isCritical
                  ? colors.error[500]
                  : isWarning
                  ? colors.warning[500]
                  : 'inherit',
              }}
            >
              {hours.toFixed(1)}h
            </Text>
          </Space>
        );
      },
    },
    {
      title: '处理动作',
      dataIndex: 'timeoutAction',
      key: 'timeoutAction',
      width: 120,
      render: (action: string) => (
        <Tooltip title={actionDescriptions[action] || ''}>
          {getActionTag(action)}
        </Tooltip>
      ),
    },
    {
      title: '截止日期',
      dataIndex: ['task', 'dueDate'],
      key: 'dueDate',
      width: 180,
      render: (date: string | undefined) =>
        date ? new Date(date).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>
          任务超时管理
        </Title>
        <Text type="secondary">
          监控工作流任务超时情况，自动处理超时任务
        </Text>
      </div>

      {/* 统计卡片和操作 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 16 }}
          >
            <Statistic
              title="待处理超时任务"
              value={timedOutTasks.length}
              prefix={
                timedOutTasks.length > 0 ? (
                  <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
                ) : (
                  <CheckCircleOutlined style={{ color: colors.success[500] }} />
                )
              }
              valueStyle={{
                color:
                  timedOutTasks.length > 0
                    ? colors.error[500]
                    : colors.success[500],
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 16 }}
          >
            <Statistic
              title="检查器状态"
              value={status.isRunning ? '运行中' : '已停止'}
              prefix={
                status.isRunning ? (
                  <SyncOutlined spin style={{ color: colors.success[500] }} />
                ) : (
                  <ClockCircleOutlined style={{ color: colors.neutral[500] }} />
                )
              }
              valueStyle={{
                color: status.isRunning
                  ? colors.success[500]
                  : colors.neutral[500],
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 16 }}
          >
            <Statistic
              title="已处理事件数"
              value={status.processedEventsCount}
              prefix={<CheckCircleOutlined style={{ color: colors.primary[500] }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 16, textAlign: 'center' }}
          >
            <div style={{ paddingTop: 8 }}>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleCheckNow}
                loading={checking}
                style={{ borderRadius: 6 }}
              >
                立即检查
              </Button>
              <div style={{ marginTop: 8 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  手动触发超时检查
                </Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 说明信息 */}
      <Card
        style={{ marginBottom: 24, borderRadius: 12 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space>
          <QuestionCircleOutlined style={{ color: colors.info[500] }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            超时动作说明：提醒 - 发送通知 | 升级 - 转交上级 | 自动完成 - 标记完成 | 取消 - 跳过任务
          </Text>
        </Space>
      </Card>

      {/* 超时任务列表 */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined />
            <span>超时任务列表</span>
            <Tag color={timedOutTasks.length > 0 ? 'error' : 'success'}>
              {timedOutTasks.length}
            </Tag>
          </Space>
        }
        style={{ borderRadius: 12 }}
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={() => {
              fetchTimedOutTasks();
              fetchStatus();
            }}
            loading={loading}
          >
            刷新
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={timedOutTasks}
          rowKey={(record) => record.task.id}
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个超时任务`,
          }}
          locale={{
            emptyText: timedOutTasks.length === 0 ? '暂无超时任务' : '加载中...',
          }}
        />
      </Card>
    </div>
  );
};

export default TaskTimeoutsPage;