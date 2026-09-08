/**
 * CMDB - Configuration Management Database
 * CI management, topology view, integration status, web terminal, batch execution, audit
 *
 * 2026-05-19: 扩展为 6 Tab — 新增 Web 终端、批量执行、审计日志
 * 原有组件拆分为独立文件
 * 2026-07-27: 新增 4 个统计卡片 (CI总数/主机/K8s/CICD)，调用后端 API
 * P2-9 Phase 284: 172->60 行 (-65%), 新增 Components/{StatsCards,TabItems}.tsx
 */
import React from 'react';
import { Tabs, Spin, Empty } from 'antd';
import { useQuery } from '@/providers/QueryProvider';
import { getCIs, getHosts, getK8sResources, getCICDResources } from '@/api/cmdb';
import { CMDBStatsCards } from './Components/StatsCards';
import { buildCMDBTabItems } from './Components/TabItems';

interface CMDBStats {
  ciTotal: number;
  hostCount: number;
  k8sCount: number;
  cicdCount: number;
}

const defaultStats: CMDBStats = { ciTotal: 0, hostCount: 0, k8sCount: 0, cicdCount: 0 };

const CMDBPage: React.FC = () => {
  const { data: stats = defaultStats, isLoading: loading } = useQuery<CMDBStats>({
    queryKey: ['cmdb-dashboard-stats'],
    queryFn: async () => {
      const [cisRes, hostsRes, k8sRes, cicdRes] = await Promise.all([
        getCIs().catch(() => ({ data: [] })),
        getHosts().catch(() => ({ data: [] })),
        getK8sResources().catch(() => ({ data: [] })),
        getCICDResources().catch(() => ({ data: [] })),
      ]);
      return {
        ciTotal: (cisRes.data || []).length,
        hostCount: (hostsRes.data || []).length,
        k8sCount: (k8sRes.data || []).length,
        cicdCount: (cicdRes.data || []).length,
      };
    },
    staleTime: 30_000,
  });

  const tabItems = buildCMDBTabItems()!;

  return (
    <Spin spinning={loading}>
      <CMDBStatsCards stats={stats} />
      {tabItems.length > 0 ? (
        <Tabs defaultActiveKey="cis" items={tabItems} size="large" />
      ) : (
        <Empty description="暂无数据" />
      )}
    </Spin>
  );
};

export default CMDBPage;
