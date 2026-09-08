/**
 * UEBA - User Behavior Analytics Page
 * 用户行为分析页面
 *
 * P2-9 Phase 242 拆分:
 * - useUEBAState.ts: state + fetchData + useEffect
 * - Columns.tsx: riskColumns + alertColumns + 色映射
 * - Components/StatsRow.tsx: 3 张统计卡片
 * - Components/AlertsCard.tsx: 异常告警卡片 + 时间筛选
 * - Components/RisksCard.tsx: 高风险用户卡片
 */
import { spacing } from '@/tokens';
import { useUEBAState } from './useUEBAState';
import { StatsRow } from './Components/StatsRow';
import { AlertsCard } from './Components/AlertsCard';
import { RisksCard } from './Components/RisksCard';

const UEBAPage: React.FC = () => {
  const { loading, risks, alerts, hours, setHours, fetchData } = useUEBAState();

  return (
    <div style={{ padding: spacing.lg }}>
      <StatsRow risksCount={risks.length} alertsCount={alerts.length} hours={hours} />
      <AlertsCard
        alerts={alerts}
        loading={loading}
        hours={hours}
        setHours={setHours}
        onRefresh={() => void fetchData()}
      />
      <RisksCard risks={risks} loading={loading} onRefresh={() => void fetchData()} />
    </div>
  );
};

export default UEBAPage;
