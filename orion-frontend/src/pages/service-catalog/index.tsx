/**
 * ServiceCatalog — 服务目录
 * 对接后端 /api/v1/service-catalog 完整 CRUD
 * 含服务请求生命周期管理 + SLA 违规监控
 *
 * Split into components (P2-9 Phase 151):
 * - constants.ts / columns.tsx / useServiceCatalogState.ts
 * - Components/{ServiceCatalogHeader,CatalogTab,SLATab,CatalogFormModal,DetailModal}.tsx
 */
import React, { useMemo } from 'react';
import { Button, Card, Space, Tabs } from 'antd';
import {
  ClockCircleOutlined,
  CloudServerOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useServiceCatalogState } from './useServiceCatalogState';
import { buildCatalogColumns, buildSlaColumns } from './columns';
import { ServiceCatalogHeader } from './Components/ServiceCatalogHeader';
import { CatalogTab } from './Components/CatalogTab';
import { SLATab } from './Components/SLATab';
import { CatalogFormModal } from './Components/CatalogFormModal';
import { DetailModal } from './Components/DetailModal';

const ServiceCatalogPage: React.FC = () => {
  const state = useServiceCatalogState();

  const catalogColumns = useMemo(
    () =>
      buildCatalogColumns({
        handleViewDetail: state.handleViewDetail,
        handleEdit: state.handleEdit,
        handleDelete: state.handleDelete,
      }),
    [state.handleViewDetail, state.handleEdit, state.handleDelete],
  );
  const slaColumns = useMemo(() => buildSlaColumns(), []);

  return (
    <div style={{ padding: 24 }}>
      <ServiceCatalogHeader />

      <Card style={{ borderRadius: 12 }} styles={{ body: { padding: 0 } }}>
        <Tabs
          activeKey={state.activeTab}
          onChange={state.setActiveTab}
          style={{ padding: '16px 16px 0' }}
          tabBarExtraContent={
            state.activeTab === 'catalog' ? (
              <Space>
                <Button icon={<ReloadOutlined />} onClick={() => state.refetchItems()} loading={state.loading}>
                  刷新
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={state.handleCreate}>
                  新建
                </Button>
              </Space>
            ) : (
              <Button icon={<ReloadOutlined />} onClick={() => state.refetchSLA()} loading={state.slaLoading}>
                刷新
              </Button>
            )
          }
          items={[
            {
              key: 'catalog',
              label: (
                <span>
                  <CloudServerOutlined /> 服务目录
                </span>
              ),
              children: (
                <CatalogTab columns={catalogColumns} dataSource={state.items} loading={state.loading} />
              ),
            },
            {
              key: 'sla',
              label: (
                <span>
                  <ClockCircleOutlined /> SLA 违规监控
                </span>
              ),
              children: (
                <SLATab columns={slaColumns} dataSource={state.slaBreaches} loading={state.slaLoading} />
              ),
            },
          ]}
        />
      </Card>

      <CatalogFormModal
        open={state.modalOpen}
        form={state.form}
        editingItem={state.editingItem}
        submitting={state.submitting}
        onCancel={() => state.setModalOpen(false)}
        onSubmit={state.handleSubmit}
      />

      <DetailModal
        open={state.detailOpen}
        item={state.selectedItem}
        timeline={state.timeline}
        onCancel={() => state.setDetailOpen(false)}
      />
    </div>
  );
};

export default ServiceCatalogPage;
