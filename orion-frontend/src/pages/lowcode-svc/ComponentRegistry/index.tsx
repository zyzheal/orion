/**
 * 组件注册中心 (Component Registry)
 * 低代码平台自定义组件管理：注册 → 分类 → Props Schema → 默认配置
 *
 * 拆分自 index.tsx (P2-9 Phase 194)
 */
import { useMemo } from 'react';
import { spacing } from '@/tokens';
import { useComponentRegistryState } from './useComponentRegistryState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { ComponentTable } from './Components/ComponentTable';
import { CreateComponentModal } from './Components/CreateComponentModal';
import { DetailModal } from './Components/DetailModal';

const ComponentRegistryPage = () => {
  const {
    category,
    modalOpen,
    submitting,
    detailOpen,
    selectedComponent,
    components,
    loading,
    form,
    loadComponents,
    handleCreate,
    handleViewDetail,
    openCreate,
    closeCreate,
    closeDetail,
    setCategory,
  } = useComponentRegistryState();

  const columns = useMemo(() => buildColumns({ onViewDetail: handleViewDetail }), [handleViewDetail]);

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />
      <StatsRow components={components} />
      <ComponentTable
        columns={columns}
        components={components}
        loading={loading}
        category={category}
        onCategoryChange={setCategory}
        onRefresh={loadComponents}
        onCreate={openCreate}
      />
      <CreateComponentModal
        form={form}
        open={modalOpen}
        submitting={submitting}
        onSubmit={handleCreate}
        onClose={closeCreate}
      />
      <DetailModal open={detailOpen} component={selectedComponent} onClose={closeDetail} />
    </div>
  );
};

export default ComponentRegistryPage;
