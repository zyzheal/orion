/**
 * DBA (Database Administration) Page
 * SQL order management, data source management, audit rules
 *
 * 拆分结构（P2-9 Phase 42）:
 * - constants.ts: color maps + option arrays
 * - useDbaState.ts: all state + 3 loaders (orders/dataSources/auditRules)
 * - OrderColumns.tsx: buildOrderColumns (deps)
 * - OrderStatsCards.tsx: 4 Statistic 卡片
 * - OrdersTab.tsx: Filter + Table + Create Modal + order handlers
 * - DataSourcesTab.tsx: Cards grid + Edit/Create Modal + ds handlers
 * - AuditRulesTab.tsx: Refresh + Table + toggle rule
 * - DbaPage.tsx: Header + Tabs layout
 */
import React, { useState } from 'react';
import { Typography, Tabs } from 'antd';
import {
  DatabaseOutlined,
  OrderedListOutlined,
  SafetyOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useDbaState } from './useDbaState';
import OrdersTab from './OrdersTab';
import DataSourcesTab from './DataSourcesTab';
import AuditRulesTab from './AuditRulesTab';

const { Title, Text } = Typography;

const DbaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const {
    loading,
    orders,
    orderLoading,
    dataSources,
    dsLoading,
    auditRules,
    ruleLoading,
    loadOrders,
    loadDataSources,
    loadAuditRules,
  } = useDbaState();

  const isInitialLoading = loading && orders.length === 0 && dataSources.length === 0;

  const tabItems = [
    {
      key: 'orders',
      label: (
        <span>
          <OrderedListOutlined /> SQL工单
        </span>
      ),
      children: <OrdersTab orders={orders} orderLoading={orderLoading} loadOrders={loadOrders} />,
    },
    {
      key: 'datasources',
      label: (
        <span>
          <DatabaseOutlined /> 数据源
        </span>
      ),
      children: (
        <DataSourcesTab
          dataSources={dataSources}
          dsLoading={dsLoading}
          loadDataSources={loadDataSources}
        />
      ),
    },
    {
      key: 'audit',
      label: (
        <span>
          <SafetyOutlined /> 审计规则
        </span>
      ),
      children: (
        <AuditRulesTab
          auditRules={auditRules}
          ruleLoading={ruleLoading}
          loadAuditRules={loadAuditRules}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          <div style={{ marginBottom: spacing.lg }}>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <DatabaseOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
              数据库管理
            </Title>
            <Text type="secondary">管理SQL工单、数据源和审计规则</Text>
          </div>

          <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default DbaPage;
