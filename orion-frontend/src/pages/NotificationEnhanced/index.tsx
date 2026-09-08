/**
 * Notification Enhanced — 高级通知管理主页面
 *
 * 6 个 Tab: 通知策略 / 集成管理 / 消息订阅 / 通知历史 / 公告管理 / 数据矩阵
 *
 * P2-9 Phase 269 refactor: 已抽取 Components/PageHeader / Components/TabItems
 * Sub-tab 内容组件 (StrategyTab/IntegrationTab/SubscriptionTab/HistoryTab/NoticeTab/MatrixTab)
 * 均为 lazy-loaded 独立文件，本文件只做 layout + tab 渲染。
 */
import React, { useState } from 'react';
import { Tabs } from 'antd';
import { colors, spacing, themeVars } from '@/tokens';
import DataState from '@/components/DataState';
import { PageHeader } from './Components/PageHeader';
import { TABS } from './Components/TabItems';

const { TabPane } = Tabs;

const NotificationEnhanced: React.FC = () => {
  const [activeTab, setActiveTab] = useState('strategies');
  const [error, setError] = useState<Error | null>(null);

  return (
    <div style={{ padding: 0 }}>
      <PageHeader />

      <div style={{ marginBottom: spacing.md, overflowX: 'auto' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          tabBarStyle={{
            borderBottom: `1px solid ${colors.neutral[300]}`,
            marginBottom: 0,
            padding: 0,
          }}
          style={{ background: themeVars.bgPrimary }}
          destroyInactiveTabPane={false}
        >
          {TABS.map((tab) => (
            <TabPane tab={tab.label} key={tab.key}>
              <div style={{ paddingTop: spacing.md, background: themeVars.bgPrimary }} >
                <DataState loading={false} error={error} retry={() => setError(null)}>
                  <React.Suspense
                    fallback={
                      <div
                        style={{
                          textAlign: 'center',
                          padding: '60px 0',
                          color: colors.neutral[500],
                        }}
                      >
                        加载中...
                      </div>
                    }
                  >
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
