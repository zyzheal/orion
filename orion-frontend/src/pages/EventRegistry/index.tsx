/**
 * EventRegistry Page
 * Event Trigger Registry - View event types, subscriptions, test matching, and statistics
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Select,
  Input,
  Table,
  Tabs,
  message,
  Empty,
  Divider,
  Badge,
  Tooltip,
  Modal,
} from 'antd';
import {
  ReloadOutlined,
  CalendarOutlined,
  PlayCircleOutlined,
  ExperimentOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  TagsOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import {
  getEventTypes,
  getSubscriptions,
  testMatch,
  getStatistics,
  type EventTypeInfo,
  type Subscription,
  type TestMatchResult,
  type TriggerStatistics,
} from '@/api/event-registry';

const { Title, Text, Paragraph } = Typography;

// ============================================================================
// Types
// ============================================================================

interface StatisticsData {
  totalTriggers: number;
  byType: Record<string, { total: number; enabled: number }>;
  triggers: TriggerStatistics[];
}

// Category color mapping
const categoryColorMap: Record<string, string> = {
  pipeline: 'blue',
  code: 'green',
  deploy: 'orange',
  config: 'purple',
  incident: 'red',
  workflow: 'cyan',
};

// Trigger type icon mapping
const triggerTypeIconMap: Record<string, React.ReactNode> = {
  cron: <CalendarOutlined />,
  manual: <PlayCircleOutlined />,
  webhook: <LinkOutlined />,
};

// ============================================================================
// Main Component
// ============================================================================

const EventRegistryPage: React.FC = () => {
  // Loading states
  const [loadingEventTypes, setLoadingEventTypes] = useState(false);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(false);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [loadingTestMatch, setLoadingTestMatch] = useState(false);

  // Data states
  const [eventTypes, setEventTypes] = useState<EventTypeInfo[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);

  // Test match modal state
  const [testMatchModalVisible, setTestMatchModalVisible] = useState(false);
  const [selectedEventType, setSelectedEventType] = useState<string>('');
  const [testPayload, setTestPayload] = useState<string>('{}');
  const [testResults, setTestResults] = useState<TestMatchResult[]>([]);

  // Load event types
  const loadEventTypes = async () => {
    setLoadingEventTypes(true);
    try {
      const data = await getEventTypes();
      setEventTypes(data.eventTypes || []);
      setCategories(data.categories || []);
    } catch (error: unknown) {
      message.error(`加载事件类型失败: ${(error as Error).message}`);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  // Load subscriptions
  const loadSubscriptions = async () => {
    setLoadingSubscriptions(true);
    try {
      const data = await getSubscriptions();
      setSubscriptions(data.subscriptions || []);
    } catch (error: unknown) {
      message.error(`加载订阅状态失败: ${(error as Error).message}`);
    } finally {
      setLoadingSubscriptions(false);
    }
  };

  // Load statistics
  const loadStatistics = async () => {
    setLoadingStatistics(true);
    try {
      const data = await getStatistics();
      setStatistics(data);
    } catch (error: unknown) {
      message.error(`加载统计信息失败: ${(error as Error).message}`);
    } finally {
      setLoadingStatistics(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadEventTypes();
    loadSubscriptions();
    loadStatistics();
  }, []);

  // Group event types by category
  const eventTypesByCategory = useMemo(() => {
    const grouped: Record<string, EventTypeInfo[]> = {};
    for (const et of eventTypes) {
      if (!grouped[et.category]) {
        grouped[et.category] = [];
      }
      grouped[et.category].push(et);
    }
    return grouped;
  }, [eventTypes]);

  // Run test match
  const runTestMatch = async () => {
    if (!selectedEventType) {
      message.warning('请选择事件类型');
      return;
    }

    let parsedPayload: Record<string, unknown>;
    try {
      parsedPayload = JSON.parse(testPayload);
    } catch {
      message.error('JSON 格式错误');
      return;
    }

    setLoadingTestMatch(true);
    try {
      const data = await testMatch({
        eventType: selectedEventType,
        eventPayload: parsedPayload,
      });
      setTestResults(data.results || []);
      const matchedCount = data.results.filter((r) => r.matched).length;
      const totalCount = data.results.length;
      if (totalCount === 0) {
        message.info('当前事件类型没有已注册的触发器');
      } else if (matchedCount > 0) {
        message.success(`匹配完成: ${matchedCount}/${totalCount} 个触发器匹配`);
      } else {
        message.warning(`匹配完成: ${totalCount} 个触发器均不匹配`);
      }
    } catch (error: unknown) {
      message.error(`测试匹配失败: ${(error as Error).message}`);
    } finally {
      setLoadingTestMatch(false);
    }
  };

  // Copy payload sample
  const copySamplePayload = (sample: Record<string, unknown>) => {
    navigator.clipboard.writeText(JSON.stringify(sample, null, 2));
    message.success('已复制到剪贴板');
  };

  // ---- Render ----

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: spacing.lg,
        }}
      >
        <div>
          <Title level={2} style={{ marginBottom: 8 }}>
            Event Registry
          </Title>
          <Text type="secondary">事件触发器注册表 - 管理事件类型、订阅和触发规则</Text>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              loadEventTypes();
              loadSubscriptions();
              loadStatistics();
            }}
            loading={loadingEventTypes || loadingSubscriptions || loadingStatistics}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<ExperimentOutlined />}
            onClick={() => setTestMatchModalVisible(true)}
          >
            测试匹配
          </Button>
        </Space>
      </div>

      <Tabs
        defaultActiveKey="event-types"
        items={[
          // Tab 1: Event Types
          {
            key: 'event-types',
            label: (
              <span>
                <TagsOutlined /> 事件类型
              </span>
            ),
            children: (
              <div>
                {/* Categories Overview */}
                <div style={{ marginBottom: spacing.lg }}>
                  <Text strong style={{ marginRight: spacing.md }}>
                    分类:
                  </Text>
                  {categories.map((cat) => (
                    <Tag
                      key={cat}
                      color={categoryColorMap[cat] || 'default'}
                      style={{ marginRight: spacing.sm, marginBottom: spacing.sm }}
                    >
                      {cat} ({eventTypesByCategory[cat]?.length || 0})
                    </Tag>
                  ))}
                </div>

                {/* Event Types by Category */}
                {categories.map((category) => (
                  <Card
                    key={category}
                    size="small"
                    title={
                      <Space>
                        <Tag color={categoryColorMap[category] || 'default'}>{category}</Tag>
                        <Text type="secondary">
                          {eventTypesByCategory[category]?.length || 0} 个事件类型
                        </Text>
                      </Space>
                    }
                    style={{ marginBottom: spacing.md }}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: spacing.md,
                      }}
                    >
                      {eventTypesByCategory[category]?.map((et) => (
                        <Card
                          key={et.type}
                          size="small"
                          hoverable
                          style={{ borderLeft: `3px solid ${colors.primary[500]}` }}
                        >
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Text strong code style={{ fontSize: 13 }}>
                              {et.type}
                            </Text>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {et.description}
                            </Text>
                            <div style={{ marginTop: spacing.xs }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                示例 Payload:
                              </Text>
                              <Button
                                type="text"
                                size="small"
                                icon={<CopyOutlined />}
                                onClick={() => copySamplePayload(et.samplePayload)}
                                style={{ float: 'right', fontSize: 11 }}
                              >
                                复制
                              </Button>
                            </div>
                            <pre
                              style={{
                                background: colors.neutral[50],
                                padding: spacing.xs,
                                borderRadius: 4,
                                fontSize: 10,
                                overflow: 'auto',
                                maxHeight: 80,
                                margin: 0,
                              }}
                            >
                              {JSON.stringify(et.samplePayload, null, 2)}
                            </pre>
                          </Space>
                        </Card>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ),
          },

          // Tab 2: Subscriptions
          {
            key: 'subscriptions',
            label: (
              <span>
              </span>
            ),
            children: (
              <div>
                <Text type="secondary" style={{ marginBottom: spacing.md, display: 'block' }}>
                  当前已订阅事件触发的触发器列表
                </Text>
                <Card>
                  <Table
                    columns={[
                      {
                        key: 'triggerName',
                        title: '触发器名称',
                        dataIndex: 'triggerName',
                        width: 200,
                        render: (v: unknown) => <Text strong>{String(v)}</Text>,
                      },
                      {
                        key: 'eventType',
                        title: '事件类型',
                        dataIndex: 'eventType',
                        width: 220,
                        render: (v: unknown) => <Tag color="blue">{String(v)}</Tag>,
                      },
                      {
                        key: 'workflowId',
                        title: '工作流 ID',
                        dataIndex: 'workflowId',
                        width: 150,
                        render: (v: unknown) => (
                          <Text code style={{ fontSize: 11 }}>
                            {String(v)}
                          </Text>
                        ),
                      },
                      {
                        key: 'enabled',
                        title: '状态',
                        dataIndex: 'enabled',
                        width: 100,
                        render: (v: unknown) =>
                          v ? (
                            <Badge status="success" text="启用" />
                          ) : (
                            <Badge status="default" text="禁用" />
                          ),
                      },
                      {
                        key: 'eventFilter',
                        title: '事件过滤器',
                        dataIndex: 'eventFilter',
                        render: (v: unknown) =>
                          v ? (
                            <Tooltip title={JSON.stringify(v)}>
                              <Text type="secondary" style={{ fontSize: 11 }}>
                                {JSON.stringify(v).slice(0, 50)}...
                              </Text>
                            </Tooltip>
                          ) : (
                            <Text type="secondary">无</Text>
                          ),
                      },
                    ]}
                    dataSource={subscriptions}
                    loading={loadingSubscriptions}
                    rowKey="triggerId"
                    size="middle"
                    locale={{
                      emptyText: (
                        <Empty description="暂无订阅">
                          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTestMatchModalVisible(true)}>
                            测试事件匹配
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </Card>
              </div>
            ),
          },

          // Tab 3: Statistics
          {
            key: 'statistics',
            label: (
              <span>
                <CalendarOutlined /> 触发器统计
              </span>
            ),
            children: (
              <div>
                {/* Statistics Cards */}
                {statistics && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: spacing.md,
                      marginBottom: spacing.lg,
                    }}
                  >
                    <MetricCard
                      title="总触发器"
                      value={statistics.totalTriggers}
                      color={colors.primary[500]}
                      size="medium"
                    />
                    {Object.entries(statistics.byType).map(([type, count]) => {
                      const colorKey = getTypeColor(type);
                      const colorMap: Record<string, string> = {
                        blue: colors.primary[500],
                        purple: colors.purple[500],
                        orange: colors.warning[500],
                        green: colors.success[500],
                        default: colors.neutral[500],
                      };
                      return (
                        <MetricCard
                          key={type}
                          title={`${type} 触发器`}
                          value={count.enabled}
                          unit={`/ ${count.total}`}
                          icon={triggerTypeIconMap[type]}
                          color={colorMap[colorKey] || colors.neutral[500]}
                          size="medium"
                        />
                      );
                    })}
                  </div>
                )}

                {/* Trigger List */}
                <Card
                  title={
                    <Space>
                      <Text strong>触发器详情</Text>
                      <Text type="secondary">({statistics?.triggers.length || 0})</Text>
                    </Space>
                  }
                >
                  <Table
                    columns={[
                      {
                        key: 'triggerName',
                        title: '触发器名称',
                        dataIndex: 'triggerName',
                        width: 200,
                        render: (v: unknown) => <Text strong>{String(v)}</Text>,
                      },
                      {
                        key: 'type',
                        title: '类型',
                        dataIndex: 'type',
                        width: 120,
                        render: (v: unknown) => (
                          <Space>
                            {triggerTypeIconMap[String(v)]}
                            <Tag color={getTypeColor(String(v))}>{String(v)}</Tag>
                          </Space>
                        ),
                      },
                      {
                        key: 'enabled',
                        title: '状态',
                        dataIndex: 'enabled',
                        width: 100,
                        render: (v: unknown) =>
                          v ? (
                            <Badge status="success" text="启用" />
                          ) : (
                            <Badge status="default" text="禁用" />
                          ),
                      },
                      {
                        key: 'eventType',
                        title: '事件类型',
                        dataIndex: 'eventType',
                        width: 200,
                        render: (v: unknown) =>
                          v ? <Tag color="blue">{String(v)}</Tag> : <Text type="secondary">-</Text>,
                      },
                      {
                        key: 'cronExpression',
                        title: 'Cron 表达式',
                        dataIndex: 'cronExpression',
                        width: 150,
                        render: (v: unknown) =>
                          v ? <Text code>{String(v)}</Text> : <Text type="secondary">-</Text>,
                      },
                    ]}
                    dataSource={statistics?.triggers || []}
                    loading={loadingStatistics}
                    rowKey="triggerId"
                    size="middle"
                    pagination={{ pageSize: 10 }}
                    locale={{
                      emptyText: (
                        <Empty description="暂无触发器">
                          <Button type="primary" icon={<PlusOutlined />} onClick={() => setTestMatchModalVisible(true)}>
                            测试事件匹配
                          </Button>
                        </Empty>
                      ),
                    }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* Test Match Modal */}
      <Modal
        title={
          <Space>
            <ExperimentOutlined /> 测试事件匹配
          </Space>
        }
        open={testMatchModalVisible}
        onCancel={() => setTestMatchModalVisible(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setTestMatchModalVisible(false)}>
            关闭
          </Button>,
          <Button
            key="test"
            type="primary"
            loading={loadingTestMatch}
            onClick={runTestMatch}
            disabled={!selectedEventType}
          >
            执行测试
          </Button>,
        ]}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Text strong>选择事件类型:</Text>
            <Select
              style={{ width: '100%', marginTop: spacing.xs }}
              placeholder="选择事件类型"
              value={selectedEventType || undefined}
              onChange={setSelectedEventType}
              showSearch
              options={eventTypes.map((et) => ({
                label: (
                  <Space>
                    <Tag color={categoryColorMap[et.category]} style={{ margin: 0 }}>
                      {et.category}
                    </Tag>
                    {et.type}
                  </Space>
                ),
                value: et.type,
              }))}
            />
          </div>

          <div>
            <Text strong>输入事件 Payload (JSON):</Text>
            <Input.TextArea
              style={{ marginTop: spacing.xs, fontFamily: 'monospace', fontSize: 12 }}
              rows={8}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              placeholder='{"key": "value"}'
            />
          </div>

          {selectedEventType && eventTypes.find((et) => et.type === selectedEventType) && (
            <Card
              size="small"
              title="示例 Payload"
              extra={
                <Button
                  type="link"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() =>
                    copySamplePayload(
                      eventTypes.find((et) => et.type === selectedEventType)!.samplePayload
                    )
                  }
                >
                  复制
                </Button>
              }
            >
              <pre style={{ margin: 0, fontSize: 11 }}>
                {JSON.stringify(
                  eventTypes.find((et) => et.type === selectedEventType)?.samplePayload,
                  null,
                  2
                )}
              </pre>
            </Card>
          )}

          <Divider />

          <div>
            <Text strong>匹配结果:</Text>
            {testResults.length > 0 ? (
              <div style={{ marginTop: spacing.sm }}>
                {testResults.map((result, idx) => (
                  <Card
                    key={idx}
                    size="small"
                    style={{
                      marginBottom: spacing.sm,
                      borderLeft: result.matched
                        ? `3px solid ${colors.success[500]}`
                        : `3px solid ${colors.error[500]}`,
                    }}
                  >
                    <Space>
                      {result.matched ? (
                        <CheckCircleOutlined style={{ color: colors.success[500], fontSize: 16 }} />
                      ) : (
                        <CloseCircleOutlined style={{ color: colors.error[500], fontSize: 16 }} />
                      )}
                      <Text strong>{result.triggerName}</Text>
                      <Tag color={result.matched ? 'success' : 'error'}>
                        {result.matched ? '匹配' : '不匹配'}
                      </Tag>
                    </Space>
                    <Paragraph
                      type="secondary"
                      style={{ fontSize: 12, marginTop: spacing.xs, marginBottom: 0 }}
                    >
                      {result.matchDetails}
                    </Paragraph>
                    {result.matchedFields && Object.keys(result.matchedFields).length > 0 && (
                      <div style={{ marginTop: spacing.xs }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          匹配的字段:
                        </Text>
                        <pre
                          style={{
                            margin: 0,
                            fontSize: 10,
                            background: colors.neutral[50],
                            padding: 4,
                          }}
                        >
                          {JSON.stringify(result.matchedFields, null, 2)}
                        </pre>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            ) : (
              <Empty description="点击「执行测试」查看匹配结果" style={{ marginTop: spacing.md }} />
            )}
          </div>
        </Space>
      </Modal>
    </div>
  );
};

// Helper function
function getTypeColor(type: string): string {
  const colorMap: Record<string, string> = {
    event: 'blue',
    cron: 'purple',
    manual: 'orange',
    webhook: 'green',
  };
  return colorMap[type] || 'default';
}

export default EventRegistryPage;
