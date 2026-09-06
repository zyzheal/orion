/**
 * EventRegistry Page
 * - 布局编排: Header + Tabs (EventTypes/Subscriptions/Statistics) + TestMatchModal
 * - 6 文件拆分: types.ts + constants.tsx + useEventRegistryState.ts + TestMatchModal.tsx + index.tsx
 * 抽取自 733 行原始文件 (P2-9 Phase 63)
 */
import React from 'react';
import {
  Typography,
  Button,
  Space,
  Tag,
  Card,
  Table,
  Tabs,
  Empty,
  Badge,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  ExperimentOutlined,
  CopyOutlined,
  TagsOutlined,
  PlusOutlined,
  CalendarOutlined,
} from '@ant-design/icons';
import MetricCard from '@/components/MetricCard';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens/spacing';
import { useEventRegistryState } from './useEventRegistryState';
import { categoryColorMap, triggerTypeIconMap, getTypeColor } from './constants';
import { TestMatchModal } from './TestMatchModal';

const { Title, Text } = Typography;

const EventRegistryPage: React.FC = () => {
  const {
    loadingEventTypes,
    loadingSubscriptions,
    loadingStatistics,
    loadingTestMatch,
    eventTypes,
    categories,
    subscriptions,
    statistics,
    testMatchModalVisible,
    setTestMatchModalVisible,
    selectedEventType,
    setSelectedEventType,
    testPayload,
    setTestPayload,
    testResults,
    eventTypesByCategory,
    loadEventTypes,
    loadSubscriptions,
    loadStatistics,
    runTestMatch,
    copySamplePayload,
  } = useEventRegistryState();

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
          <Title level={2} style={{ marginBottom: spacing.sm }}>
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
            label: <span></span>,
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
                    locale={
                      {
                        emptyText: (
                          <Empty description="暂无订阅">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => setTestMatchModalVisible(true)}
                            >
                              测试事件匹配
                            </Button>
                          </Empty>
                        ),
                      } as any
                    }
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
                    pagination={
                      {
                        pageSize: 10,
                      } as any
                    }
                    locale={
                      {
                        emptyText: (
                          <Empty description="暂无触发器">
                            <Button
                              type="primary"
                              icon={<PlusOutlined />}
                              onClick={() => setTestMatchModalVisible(true)}
                            >
                              测试事件匹配
                            </Button>
                          </Empty>
                        ),
                      } as any
                    }
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* Test Match Modal */}
      <TestMatchModal
        open={testMatchModalVisible}
        onClose={() => setTestMatchModalVisible(false)}
        eventTypes={eventTypes}
        selectedEventType={selectedEventType}
        setSelectedEventType={setSelectedEventType}
        testPayload={testPayload}
        setTestPayload={setTestPayload}
        testResults={testResults}
        loadingTestMatch={loadingTestMatch}
        onRunTest={runTestMatch}
        onCopySample={copySamplePayload}
      />
    </div>
  );
};

export default EventRegistryPage;
