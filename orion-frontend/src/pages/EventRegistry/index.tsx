/**
 * EventRegistry Page
 * - 布局编排: Header + Tabs (EventTypes/Subscriptions/Statistics) + TestMatchModal
 * 抽取自 733 行原始文件 (P2-9 Phase 63)
 * 组件化重构 Phase 166: 3 tabs extracted to Components/*.tsx
 */
import React from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, TagsOutlined } from '@ant-design/icons';
import { useEventRegistryState } from './useEventRegistryState';
import { TestMatchModal } from './TestMatchModal';
import { PageHeader } from './Components/PageHeader';
import { EventTypesTab } from './Components/EventTypesTab';
import { SubscriptionsTab } from './Components/SubscriptionsTab';
import { StatisticsTab } from './Components/StatisticsTab';

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

  const openTestMatch = () => setTestMatchModalVisible(true);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loadingEventTypes || loadingSubscriptions || loadingStatistics}
        onRefresh={() => {
          loadEventTypes();
          loadSubscriptions();
          loadStatistics();
        }}
        onTestMatch={openTestMatch}
      />

      <Tabs
        defaultActiveKey="event-types"
        items={[
          {
            key: 'event-types',
            label: (
              <span>
                <TagsOutlined /> 事件类型
              </span>
            ),
            children: (
              <EventTypesTab
                categories={categories}
                eventTypesByCategory={eventTypesByCategory}
                copySamplePayload={copySamplePayload}
              />
            ),
          },
          {
            key: 'subscriptions',
            label: <span></span>,
            children: (
              <SubscriptionsTab
                subscriptions={subscriptions}
                loading={loadingSubscriptions}
                onTestMatch={openTestMatch}
              />
            ),
          },
          {
            key: 'statistics',
            label: (
              <span>
                <CalendarOutlined /> 触发器统计
              </span>
            ),
            children: (
              <StatisticsTab
                statistics={statistics}
                loading={loadingStatistics}
                onTestMatch={openTestMatch}
              />
            ),
          },
        ]}
      />

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
