/**
 * Pipeline Template Marketplace Page (GitLab Pipeline include pattern)
 * Browse, search, fork and apply reusable pipeline templates
 *
 * P2-9 Phase 240 拆分:
 * - useTemplateMarketState.ts: state + useQuery + stats + handlers
 * - Components/StatsRow.tsx: 4 张统计卡片
 * - Components/SearchFilterBar.tsx: 搜索 + 分类筛选
 * - Components/TemplatesTable.tsx: 模板表格
 * - Components/TemplateDetailModal.tsx: 模板详情弹窗
 */
import { Typography } from 'antd';
import { FolderOutlined } from '@ant-design/icons';
import { colors, spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useTemplateMarketState } from './useTemplateMarketState';
import { StatsRow } from './Components/StatsRow';
import { SearchFilterBar } from './Components/SearchFilterBar';
import { TemplatesTable } from './Components/TemplatesTable';
import { TemplateDetailModal } from './Components/TemplateDetailModal';

const { Title, Text } = Typography;

const TemplateMarketPage: React.FC = () => {
  const {
    category, setCategory,
    search, setSearch,
    selected, setSelected,
    applyModal,
    loading,
    safeTemplates,
    stats,
    loadTemplates,
    handleApply,
    handleFork,
  } = useTemplateMarketState();

  return (
    <div style={{ padding: spacing.lg }}>
      <Title level={2} style={{ marginBottom: spacing.sm }}>
        <FolderOutlined style={{ marginRight: spacing.sm, color: colors.primary[500] }} />
        Pipeline 模板市场
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: spacing.md }}>
        可复用的 Pipeline 模板库 · GitLab include 模式 · 一键应用到项目
      </Text>

      {loading ? (
        <PageSkeleton rows={6} />
      ) : (
        <>
          <StatsRow stats={stats} />
          <SearchFilterBar
            search={search}
            setSearch={setSearch}
            category={category}
            setCategory={setCategory}
            onSearch={loadTemplates}
          />
          <TemplatesTable
            templates={safeTemplates}
            onSelect={setSelected}
            onApply={handleApply}
            onFork={handleFork}
          />
        </>
      )}

      <TemplateDetailModal
        selected={selected}
        open={!!selected && !applyModal}
        onClose={() => setSelected(null)}
        onApply={handleApply}
      />
    </div>
  );
};

export default TemplateMarketPage;
