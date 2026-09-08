/**
 * Developer Portal / Backstage Page
 * Service catalog, tech docs, owned-by, component health overview (Backstage-style)
 *
 * P2-9 Phase 241 拆分:
 * - useDevPortalState.ts: state + useQuery + fallback + filtered + stats + handlers
 * - Components/StatsRow.tsx: 4 张统计卡片
 * - Components/SearchBar.tsx: 搜索栏
 * - Components/ComponentsTable.tsx: 组件表格 + 列定义
 * - Components/RecentUpdatesCard.tsx: 最近更新列表
 * - Components/DetailModal.tsx: 组件详情弹窗
 */
import { Typography } from 'antd';
import { AppstoreOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useDevPortalState } from './useDevPortalState';
import { StatsRow } from './Components/StatsRow';
import { SearchBar } from './Components/SearchBar';
import { ComponentsTable } from './Components/ComponentsTable';
import { RecentUpdatesCard } from './Components/RecentUpdatesCard';
import { DetailModal } from './Components/DetailModal';

const { Title, Text } = Typography;

const DevPortalPage: React.FC = () => {
  const {
    search, setSearch,
    selected,
    detailOpen, setDetailOpen,
    loading,
    safeComponents,
    filtered,
    stats,
    avgHealth,
    handleView,
    handleOpenRepo,
  } = useDevPortalState();

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <AppstoreOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        开发者门户
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        Backstage 风格组件目录 · 技术文档 · 拥有者 · 组件健康总览
      </Text>

      {loading ? (
        <PageSkeleton rows={8} />
      ) : (
        <>
          <StatsRow stats={stats} avgHealth={avgHealth} />
          <SearchBar search={search} setSearch={setSearch} />
          <ComponentsTable components={filtered} onView={handleView} onOpenRepo={handleOpenRepo} />
          <RecentUpdatesCard components={safeComponents} />
        </>
      )}

      <DetailModal
        selected={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onOpenRepo={handleOpenRepo}
      />
    </div>
  );
};

export default DevPortalPage;
