/**
 * Notification Enhanced — 高级通知管理主页面
 *
 * 6个Tab: 通知策略 / 集成管理 / 消息订阅 / 通知历史 / 公告管理 / 数据矩阵
 *
 * 功能对标:
 *   - NeatLogic notifytactics / integration-manage / subscription-setting
 *     / history-overview / notice-manage / matrix
 */
import React, { useState } from 'react';
import {
  Typography, Button, Tabs, Tooltip,
} from 'antd';
import {
  ReloadOutlined, BellOutlined, LinkOutlined, UserOutlined,
  ClockCircleOutlined, FileTextOutlined, TableOutlined,
} from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import DataState from '@/components/DataState';

// Sub-components (lazy-loaded tabs)
const StrategyTab = React.lazy(() => import('./StrategyTab'));
const IntegrationTab = React.lazy(() => import('./IntegrationTab'));
const SubscriptionTab = React.lazy(() => import('./SubscriptionTab'));
const HistoryTab = React.lazy(() => import('./HistoryTab'));
const NoticeTab = React.lazy(() => import('./NoticeTab'));
const MatrixTab = React.lazy(() => import('./MatrixTab'));

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const NotificationEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState('strategies');
  const [error, setError] = useState<Error | null>(null);

  const tabs = [
    { key: 'strategies', label: <span><BellOutlined /> 通知策略</span>, component: <StrategyTab key="strategies" /> },
    { key: 'integrations', label: <span><LinkOutlined /> 集成管理</span>, component: <IntegrationTab key="integrations" /> },
    { key: 'subscriptions', label: <span><UserOutlined /> 消息订阅</span>, component: <SubscriptionTab key="subscriptions" /> },
    { key: 'history', label: <span><ClockCircleOutlined /> 通知历史</span>, component: <HistoryTab key="history" /> },
    { key: 'notices', label: <span><FileTextOutlined /> 公告管理</span>, component: <NoticeTab key="notices" /> },
    { key: 'matrices', label: <span><TableOutlined /> 数据矩阵</span>, component: <MatrixTab key="matrices" /> },
  ];

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg }}>
        <div>
          <Title level={2} style={{ marginBottom: spacing.sm }}>
            <BellOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
            高级通知管理
          </Title>
          <Text type="secondary">
            管理通知策略、集成渠道、用户订阅、发送历史、公告与数据矩阵
          </Text>
        </div>
        <Tooltip title="刷新所有数据">
          <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
            刷新
          </Button>
        </Tooltip>
      </div>

      {/* Tab Bar — 横向滚动 */}
      <div style={{ marginBottom: spacing.md, overflowX: 'auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{
            borderBottom: `1px solid ${colors.neutral[300]}`,
            marginBottom: 0,
            padding: 0,
          }}
          style={{ background: colors.light.bg.primary }}
          destroyInactiveTabPane={false}
        >
          {tabs.map((tab) => (
            <TabPane tab={tab.label} key={tab.key}>
              <div style={{ paddingTop: spacing.md, background: colors.light.bg.primary }}>
                <DataState
                  loading={false}
                  error={error}
                  retry={() => setError(null)}
                >
                  <React.Suspense fallback={
                    <div style={{ textAlign: 'center', padding: '60px 0', color: colors.neutral[500] }}>
                      加载中...
                    </div>
                  }>
                    {tab.component}
                  </React.Suspense>
                </DataState>
              </div>
            </TabPane>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default NotificationEnhanced;
