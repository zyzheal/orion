/**
 * 控制台首页 - 管理员专用
 * 功能：系统概览统计卡片 + 快速导航到管理页面
 *
 * 拆分自 index.tsx (P2-9 Phase 196)
 */
import { Spin, Alert } from 'antd';
import { spacing } from '@/tokens';
import { useConsoleState } from './useConsoleState';
import { PageHeader } from './Components/PageHeader';
import { StatsCards } from './Components/StatsCards';
import { QuickNav } from './Components/QuickNav';
import { GovernanceCards } from './Components/GovernanceCards';

const Console = () => {
  const { stats, loading, initialLoading, error, handleRefresh } = useConsoleState();

  if (initialLoading) {
    return (
      <div
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}
      >
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div style={{ padding: 0 }} >
      <PageHeader loading={loading} onRefresh={handleRefresh} />

      {error && (
        <Alert
          message="数据加载提示"
          description={error}
          type="warning"
          showIcon
          style={{ marginBottom: spacing.md }}
        />
      )}

      <StatsCards stats={stats} />
      <QuickNav />
      <GovernanceCards />
    </div>
  );
};

export default Console;
