import { colors } from '@/tokens/colors';
import { spacing } from '@/tokens';

/**
 * Visor (Ops Visualization) Page
 * 主入口 - 抽取自 842 行 monolith (P2-9 Phase 94)
 * 拆分为:
 * - constants.tsx (状态/颜色 map + 选项)
 * - useVisorState.ts (22 useState + 8 handlers)
 * - columns.tsx (hostColumns + scriptColumns)
 * - Tabs/HostsTab.tsx (统计+表格+添加弹窗)
 * - Tabs/ScriptsTab.tsx (执行+历史+结果弹窗)
 * - Tabs/ResourcesTab.tsx (过滤+资源卡)
 */
import React from 'react';
import { Typography, Tabs } from 'antd';
import {
  CloudServerOutlined,
  CodeOutlined,
  DashboardOutlined,
  MonitorOutlined,
} from '@ant-design/icons';
import PageSkeleton from '@/components/PageSkeleton';
import { useVisorState } from './useVisorState';
import { HostsTab } from './Tabs/HostsTab';
import { ScriptsTab } from './Tabs/ScriptsTab';
import { ResourcesTab } from './Tabs/ResourcesTab';

const { Title, Text } = Typography;

const VisorPage: React.FC = () => {
  const s = useVisorState();

  const tabItems = [
    {
      key: 'hosts',
      label: (
        <span>
          <CloudServerOutlined /> 主机管理
        </span>
      ),
      children: (
        <HostsTab
          hosts={s.hosts}
          hostLoading={s.hostLoading}
          hostModalVisible={s.hostModalVisible}
          setHostModalVisible={s.setHostModalVisible}
          hostForm={s.hostForm}
          hostSubmitting={s.hostSubmitting}
          hostStats={s.hostStats}
          loadHosts={s.loadHosts}
          handleAddHost={s.handleAddHost}
          handleRemoveHost={s.handleRemoveHost}
          handleViewHostStatus={s.handleViewHostStatus}
        />
      ),
    },
    {
      key: 'scripts',
      label: (
        <span>
          <CodeOutlined /> 脚本执行
        </span>
      ),
      children: (
        <ScriptsTab
          hosts={s.hosts}
          scripts={s.scripts}
          scriptLoading={s.scriptLoading}
          scriptForm={s.scriptForm}
          scriptExecuting={s.scriptExecuting}
          scriptResult={s.scriptResult}
          viewingResult={s.viewingResult}
          loadScripts={s.loadScripts}
          handleExecuteScript={s.handleExecuteScript}
          handleViewScriptResult={s.handleViewScriptResult}
          closeScriptResult={s.closeScriptResult}
        />
      ),
    },
    {
      key: 'resources',
      label: (
        <span>
          <DashboardOutlined /> 资源监控
        </span>
      ),
      children: (
        <ResourcesTab
          hosts={s.hosts}
          resources={s.resources}
          filteredResources={s.filteredResources}
          resourceLoading={s.resourceLoading}
          resourceTypeFilter={s.resourceTypeFilter}
          loadResources={s.loadResources}
          handleFilterByType={s.handleFilterByType}
        />
      ),
    },
  ];

  const isInitialLoading = s.loading && s.hosts.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading ? (
        <PageSkeleton cards={4} rows={8} />
      ) : (
        <>
          {/* Header */}
          <div style={{ marginBottom: spacing.lg }}>
            <Title level={2} style={{ marginBottom: spacing.sm }}>
              <MonitorOutlined style={{ marginRight: spacing[3], color: colors.primary[500] }} />
              <CloudServerOutlined
                style={{ marginRight: spacing.sm, color: colors.primary[500] }}
              />
              运维可视化
            </Title>
            <Text type="secondary">主机管理、脚本执行与资源监控</Text>
          </div>

          {/* Tabs */}
          <Tabs activeKey={s.activeTab} onChange={s.setActiveTab} items={tabItems} size="large" />
        </>
      )}
    </div>
  );
};

export default VisorPage;
