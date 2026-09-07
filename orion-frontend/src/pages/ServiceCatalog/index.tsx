/**
 * 服务目录 (Service Catalog)
 * 后端: /api/v1/service-catalog — 服务注册、请求生命周期、SLA 违约
 *
 * 拆分自 index.tsx (P2-9 Phase 189)
 */
import { useMemo } from 'react';
import { Tabs } from 'antd';
import { spacing } from '@/tokens';
import PageSkeleton from '@/components/PageSkeleton';
import { useServiceCatalogState } from './useServiceCatalogState';
import { buildServiceColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { StatsRow } from './Components/StatsRow';
import { CatalogTab } from './Components/CatalogTab';
import { BreachTab } from './Components/BreachTab';
import { ServiceModal } from './Components/ServiceModal';
import { DetailModal } from './Components/DetailModal';

const ServiceCatalogPage = () => {
  const {
    activeTab,
    modalOpen,
    submitting,
    detailOpen,
    selectedItem,
    form,
    items,
    breaches,
    totalBreaches,
    loading,
    enabledCount,
    setActiveTab,
    refetchItems,
    refetchBreaches,
    handleCreate,
    handleEdit,
    handleViewDetail,
    handleSubmit,
    handleDelete,
    closeCreate,
    closeDetail,
  } = useServiceCatalogState();

  const columns = useMemo(
    () =>
      buildServiceColumns({
        onViewDetail: handleViewDetail,
        onEdit: handleEdit,
        onDelete: handleDelete,
      }),
    [handleViewDetail, handleEdit, handleDelete]
  );

  if (loading) {
    return <PageSkeleton rows={8} />;
  }

  return (
    <div style={{ padding: spacing.lg }}>
      <PageHeader />

      <StatsRow
        itemsCount={items.length}
        enabledCount={enabledCount}
        totalBreaches={totalBreaches}
        activeBreaches={breaches.length}
      />

      <Tabs
        activeKey={activeTab}
        onChange={(k) => setActiveTab(k as 'catalog' | 'sla')}
        items={[
          { key: 'catalog', label: `服务目录 (${items.length})` },
          { key: 'sla', label: `SLA 违约 (${totalBreaches})` },
        ]}
      />

      {activeTab === 'catalog' && (
        <CatalogTab
          columns={columns}
          items={items}
          loading={loading}
          onCreate={handleCreate}
          onRefresh={refetchItems}
        />
      )}

      {activeTab === 'sla' && <BreachTab breaches={breaches} onRefresh={refetchBreaches} />}

      <ServiceModal
        form={form}
        open={modalOpen}
        submitting={submitting}
        isEdit={!!selectedItem}
        onSubmit={handleSubmit}
        onClose={closeCreate}
      />

      <DetailModal open={detailOpen} item={selectedItem} onClose={closeDetail} />
    </div>
  );
};

export default ServiceCatalogPage;
