/**
 * DispatchPanel
 * - Side panel/modal for ticket dispatch management
 * - Queue status summary: total in queue, by priority, SLA at risk
 * - Queue entries table: Ticket ID, Title, Priority, SLA Deadline, Wait Time, Attempts, Auto Dispatch
 * - SLA alerts section: warning/critical/breach with urgency colors
 * - Engineer availability: list with status, load progress, expertise tags
 * - Auto dispatch button for all queued tickets
 */
import React, { useState } from 'react';
import {
  Drawer,
  Space,
  Tag,
  Button,
  Progress,
  Table as AntTable,
  Typography,
  Badge,
  message,
  Card,
  Row,
  Col,
  Statistic,
  Divider,
} from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  UserOutlined,
  WarningOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  mockTickets,
  mockEngineers,
  mockQueueStatus,
  mockSLAAlerts,
  type MockTicket,
} from '@/pages/__mocks__/mockTicketData';
import { colors, spacing } from '@/tokens';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

// ============================================================================
// Types
// ============================================================================

export interface DispatchPanelProps {
  open: boolean;
  onClose: () => void;
}

// ============================================================================
// Helpers
// ============================================================================

const priorityConfig: Record<string, { color: string; label: string }> = {
  critical: { color: colors.error[400], label: '紧急' },
  high: { color: colors.warning[600], label: '高' },
  medium: { color: 'blue', label: '中' },
  low: { color: colors.neutral[500], label: '低' },
};

const availabilityConfig: Record<
  string,
  { color: string; label: string; status: 'success' | 'processing' | 'default' }
> = {
  available: { color: colors.success[500], label: '可用', status: 'success' },
  busy: { color: colors.warning[600], label: '忙碌', status: 'processing' },
  away: { color: colors.neutral[500], label: '离开', status: 'default' },
};

function formatWaitTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}小时${minutes}分`;
  return `${minutes}分钟`;
}

// Get unassigned tickets as queue entries
function getQueueTickets(): MockTicket[] {
  return mockTickets.filter((t) => t.status === 'open' || t.status === 'assigned');
}

// ============================================================================
// DispatchPanel Component
// ============================================================================

const DispatchPanel: React.FC<DispatchPanelProps> = ({ open, onClose }) => {
  const [dispatching, setDispatching] = useState(false);

  const queueTickets = getQueueTickets();

  // Queue entries columns
  const queueColumns: ColumnsType<MockTicket> = [
    {
      title: '工单ID',
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (value: string) => (
        <Text strong style={{ color: colors.primary[500] }}>
          {value}
        </Text>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (value: string) => {
        const config = priorityConfig[value];
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: 'SLA 截止',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: 120,
      render: (value: string) => (
        <Text type="secondary" style={{ fontSize: spacing[3] }}>
          {dayjs(value).format('MM-DD HH:mm')}
        </Text>
      ),
    },
    {
      title: '等待时间',
      key: 'waitTime',
      width: 100,
      render: (_: unknown, record: MockTicket) => {
        const waitMs = dayjs().diff(dayjs(record.createdAt));
        const hours = Math.floor(waitMs / 3600000);
        return (
          <Space>
            <ClockCircleOutlined
              style={{ color: hours > 4 ? colors.error[400] : colors.success[500] }}
            />
            <Text>{hours}h</Text>
          </Space>
        );
      },
    },
    {
      title: '分派尝试',
      key: 'attempts',
      width: 80,
      render: () => <Text type="secondary">0</Text>,
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: unknown, record: MockTicket) => (
        <Button
          type="link"
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={() => handleSingleDispatch(record)}
          disabled={!!record.assignee}
        >
          分派
        </Button>
      ),
    },
  ];

  const handleSingleDispatch = (ticket: MockTicket) => {
    message.loading({ content: `正在为 ${ticket.id} 自动分派...`, key: 'dispatch' });
    setTimeout(() => {
      message.success({ content: `${ticket.id} 分派成功`, key: 'dispatch', duration: 2 });
    }, 1000);
  };

  const handleAutoDispatchAll = () => {
    setDispatching(true);
    message.loading({ content: '正在执行自动分派...', key: 'autoDispatch', duration: 0 });
    setTimeout(() => {
      message.success({ content: '自动分派完成', key: 'autoDispatch', duration: 2 });
      setDispatching(false);
    }, 2000);
  };

  // SLA alert type config
  const slaAlertConfig: Record<
    string,
    { icon: React.ReactNode; color: string; label: string; bg: string }
  > = {
    'sla-warning': {
      icon: <WarningOutlined />,
      color: colors.warning[500],
      label: 'SLA 警告',
      bg: colors.warning[50],
    },
    'sla-critical': {
      icon: <CloseCircleOutlined />,
      color: colors.error[400],
      label: 'SLA 严重',
      bg: colors.error[50],
    },
    'sla-breach': {
      icon: <CloseCircleOutlined />,
      color: colors.error[600],
      label: 'SLA 违约',
      bg: colors.error[50],
    },
  };

  return (
    <Drawer
      title="工单分派管理"
      open={open}
      onClose={onClose}
      width={800}
      destroyOnClose
      data-testid="dispatch-panel"
    >
      {/* Queue Status Summary */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Statistic
              title="队列中"
              value={mockQueueStatus.totalInQueue}
              suffix="个"
              valueStyle={{ fontSize: spacing[6] }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="SLA 风险"
              value={mockQueueStatus.slaAtRisk}
              valueStyle={{ fontSize: spacing[6], color: colors.warning[600] }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="SLA 违约"
              value={mockQueueStatus.slaBreached}
              valueStyle={{ fontSize: spacing[6], color: colors.error[400] }}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="平均等待"
              value={formatWaitTime(mockQueueStatus.avgWaitTimeMs)}
              valueStyle={{ fontSize: spacing[5] }}
            />
          </Col>
        </Row>
        <Divider style={{ margin: '12px 0' }} />
        <Space size="small" wrap>
          {Object.entries(mockQueueStatus.byPriority).map(
            ([key, val]) =>
              val > 0 && (
                <Tag key={key} color={priorityConfig[key]?.color || 'default'}>
                  {priorityConfig[key]?.label || key}: {val}
                </Tag>
              )
          )}
        </Space>
      </Card>

      {/* Queue Entries */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Title level={5} style={{ margin: 0 }}>
            队列工单
          </Title>
          <Button
            type="primary"
            icon={<ThunderboltOutlined />}
            onClick={handleAutoDispatchAll}
            loading={dispatching}
            data-testid="auto-dispatch-all"
          >
            全部分派
          </Button>
        </div>
        <AntTable<MockTicket>
          columns={queueColumns}
          dataSource={queueTickets}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: '队列为空' }}
        />
      </div>

      {/* SLA Alerts */}
      {mockSLAAlerts.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Title level={5} style={{ marginBottom: 8 }}>
            <WarningOutlined style={{ color: colors.warning[500], marginRight: 8 }} />
            SLA 告警
          </Title>
          {mockSLAAlerts.map((alert) => {
            const config = slaAlertConfig[alert.alertType];
            return (
              <Card
                key={alert.id}
                size="small"
                style={{
                  marginBottom: 8,
                  background: config.bg,
                  borderColor: config.color,
                }}
              >
                <Space>
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <Tag color={config.color}>{config.label}</Tag>
                  <Text>{alert.message}</Text>
                  <Text type="secondary" style={{ fontSize: spacing[3] }}>
                    剩余 {formatWaitTime(alert.timeRemainingMs)}
                  </Text>
                </Space>
              </Card>
            );
          })}
        </div>
      )}

      {/* Engineer Availability */}
      <div>
        <Title level={5} style={{ marginBottom: 8 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          工程师可用性
        </Title>
        <Space direction="vertical" style={{ width: '100%' }}>
          {mockEngineers.map((engineer) => {
            const availConfig = availabilityConfig[engineer.availability];
            const loadPercent = Math.round((engineer.currentLoad / engineer.maxCapacity) * 100);
            return (
              <Card
                key={engineer.id}
                size="small"
                style={{ marginBottom: 4 }}
                data-testid={`engineer-card-${engineer.id}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Badge status={availConfig.status} text={engineer.name} />
                  <Tag color={availConfig.color}>{availConfig.label}</Tag>
                  <div style={{ flex: 1, maxWidth: 200 }}>
                    <Progress
                      percent={loadPercent}
                      size="small"
                      strokeColor={
                        loadPercent > 80
                          ? colors.error[400]
                          : loadPercent > 60
                            ? colors.warning[600]
                            : colors.success[500]
                      }
                      format={() => `${engineer.currentLoad}/${engineer.maxCapacity}`}
                    />
                  </div>
                  <Space size={4}>
                    {engineer.expertise.slice(0, 3).map((exp) => (
                      <Tag key={exp} style={{ margin: 0, fontSize: spacing[2] }}>
                        {exp}
                      </Tag>
                    ))}
                  </Space>
                </div>
              </Card>
            );
          })}
        </Space>
      </div>
    </Drawer>
  );
};

export default DispatchPanel;
