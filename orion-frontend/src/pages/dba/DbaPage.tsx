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
import { Typography, Tabs, Space, Card } from 'antd';
import {
  DatabaseOutlined,
  OrderedListOutlined,
  SafetyOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  TableOutlined,
  RobotOutlined,
  ToolOutlined,
  ClockCircleOutlined,
  ApartmentOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageSkeleton from '@/components/PageSkeleton';
import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';
import { useDbaState } from './useDbaState';
import OrdersTab from './OrdersTab';
import DataSourcesTab from './DataSourcesTab';
import AuditRulesTab from './AuditRulesTab';

const { Title, Text } = Typography;

// Extension sub-modules (Phase 2, 2026-09-06) linked from this page.
// Each opens a dedicated route with its own API + interaction model.
const extensionModules = [
  {
    path: '/dba/approval',
    title: '多级审批',
    desc: 'SQL 工单多阶段审批流',
    icon: <SafetyCertificateOutlined />,
    color: '#7C5CFC',
  },
  {
    path: '/dba/query',
    title: '分页查询',
    desc: '游标分页 + Excel 导出',
    icon: <TableOutlined />,
    color: colors.primary[500] as string,
  },
  {
    path: '/dba/aireview',
    title: 'AI SQL 评审',
    desc: '本地规则 + LLM 智能评审',
    icon: <RobotOutlined />,
    color: colors.purple[500] as string,
  },
  {
    path: '/dba/osc',
    title: '在线结构变更',
    desc: 'gh-ost 零停机 DDL',
    icon: <ToolOutlined />,
    color: '#13c2c2',
  },
  {
    path: '/dba/slowquery',
    title: '慢查询分析',
    desc: '采集 + 启发式优化',
    icon: <ClockCircleOutlined />,
    color: '#faad14',
  },
  {
    path: '/dba/explain',
    title: '执行计划分析',
    desc: 'EXPLAIN 抓取 + 树解析',
    icon: <ApartmentOutlined />,
    color: '#1677ff',
  },
  {
    path: '/dba/advisor',
    title: '索引建议 Agent',
    desc: 'CREATE INDEX 建议',
    icon: <BulbOutlined />,
    color: '#722ed1',
  },
];

const DbaPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('orders');
  const navigate = useNavigate();
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

      {/* Phase 2 extension modules */}
      {!isInitialLoading && (
        <div style={{ marginTop: spacing.lg }}>
          <Text strong style={{ display: 'block', marginBottom: spacing.sm }}>
            扩展模块 (Phase 2)
          </Text>
          <Space wrap size={12}>
            {extensionModules.map((m) => (
              <Card
                key={m.path}
                size="small"
                hoverable
                style={{ width: 200, borderLeft: `3px solid ${m.color}` }}
                styles={{ body: { padding: 12 } }}
                onClick={() => navigate(m.path)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ color: m.color, fontSize: 20, marginTop: 2 }}>{m.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>{m.title}</Text>
                      <RightOutlined style={{ color: colors.neutral[400] as string, fontSize: 12 }} />
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{m.desc}</Text>
                  </div>
                </div>
              </Card>
            ))}
          </Space>
        </div>
      )}
    </div>
  );
};

export default DbaPage;
