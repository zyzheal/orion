/**
 * PermissionAudit - 权限审计日志页面
 * 展示权限决策日志，供安全审计使用
 *
 * 拆分自 index.tsx (P2-9 Phase 192)
 */
import { useMemo } from 'react';
import { spacing } from '@/tokens';
import { usePermissionAuditState } from './usePermissionAuditState';
import { buildAuditLogColumns, buildStatColumns, buildRiskUserColumns } from './columns';
import { StatsRow } from './Components/StatsRow';
import { StatsTable } from './Components/StatsTable';
import { AnomalyPanel } from './Components/AnomalyPanel';
import { RiskUsersTable } from './Components/RiskUsersTable';
import { LogTable } from './Components/LogTable';

const PermissionAudit = () => {
  const {
    loading,
    logs,
    stats,
    total,
    limit,
    hours,
    anomalies,
    riskUsers,
    fetchLogs,
    setLimit,
    setHours,
    refreshAll,
  } = usePermissionAuditState();

  const columns = useMemo(() => buildAuditLogColumns(), []);
  const statColumns = useMemo(() => buildStatColumns(), []);
  const riskUserColumns = useMemo(() => buildRiskUserColumns(), []);

  return (
    <div style={{ padding: spacing.lg }}>
      <StatsRow total={total} hours={hours} activeUsers={stats.length} maxDeny={stats[0]?.count || 0} />

      <StatsTable
        stats={stats}
        columns={statColumns}
        hours={hours}
        onHoursChange={setHours}
        onRefresh={refreshAll}
      />

      <AnomalyPanel anomalies={anomalies} />

      <RiskUsersTable riskUsers={riskUsers} columns={riskUserColumns} />

      <LogTable
        logs={logs}
        loading={loading}
        columns={columns}
        limit={limit}
        onLimitChange={setLimit}
        onRefresh={fetchLogs}
      />
    </div>
  );
};

export default PermissionAudit;
