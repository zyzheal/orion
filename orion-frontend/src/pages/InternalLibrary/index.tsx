/**
 * Internal Library Management Page
 * M30 - 二方库管理：列表、创建、版本管理、依赖追踪
 * 抽取自 Phase 74 (P2-9): 状态 Hook + 4 Modal + 详情抽屉 + 表格
 *
 * P2-9 Phase 243 拆分:
 * - useInternalLibraryHandlers.ts: modal open wrappers + getLibraryTabItems memo
 * - Components/PageHeader.tsx: 标题栏 + 刷新/创建按钮
 * - index.tsx: 组合层
 *
 * P2-9 Phase 271 拆分:
 * - Components/ModalsAndDrawer.tsx: 6 Modals + 1 Drawer 汇总
 * - index.tsx: 进一步瘦身
 */
import { Card } from 'antd';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import SearchFilterBar from '@/components/SearchFilterBar';
import LibraryTable from './LibraryTable';
import { useInternalLibraryState } from './useInternalLibraryState';
import { useInternalLibraryHandlers } from './useInternalLibraryHandlers';
import { PageHeader } from './Components/PageHeader';
import { ModalsAndDrawer } from './Components/ModalsAndDrawer';

const InternalLibraryManagement: React.FC = () => {
  const state = useInternalLibraryState();
  const handlers = useInternalLibraryHandlers({ state });

  const isInitialLoading = state.loading && state.libraries.length === 0;

  return (
    <div style={{ padding: 0 }}>
      {isInitialLoading && <PageSkeleton rows={8} />}

      {isInitialLoading ? null : (
        <>
          <PageHeader
            loading={state.loading}
            onRefresh={state.loadData}
            onCreate={handlers.handleOpenCreate}
          />

          <Card>
            <div style={{ marginBottom: spacing.md }}>
              <SearchFilterBar
                onSearch={state.setSearchQuery}
                onFilter={state.setFilters}
                filters={state.filterDefs}
                searchPlaceholder="搜索二方库..."
              />
            </div>
            <LibraryTable
              dataSource={state.filteredData}
              loading={state.loading}
              onDetail={state.openDetail}
              onActivate={state.handleActivate}
              onDeprecate={handlers.handleTableDeprecate}
              onDelete={state.handleDelete}
            />
          </Card>

          <ModalsAndDrawer state={state} handlers={handlers} />
        </>
      )}
    </div>
  );
};

export default InternalLibraryManagement;
