/**
 * Global Param Management Page
 * Cross-pipeline shared parameters with tenant/global scope
 *
 * 拆分自 index.tsx (P2-9 Phase 201)
 * - useGlobalParamsState.ts: state + forms + handlers
 * - columns.tsx: 表格列定义
 * - constants.ts: scope colors + options
 * - Components/PageHeader.tsx: 页面标题 + 操作按钮
 * - Components/ParamModal.tsx: 创建/编辑参数弹窗
 * - Components/ResolveModal.tsx: 批量解析弹窗
 */
import { useMemo } from 'react';
import { Table } from 'antd';
import { useGlobalParamsState } from './useGlobalParamsState';
import { buildColumns } from './columns';
import { PageHeader } from './Components/PageHeader';
import { ParamModal } from './Components/ParamModal';
import { ResolveModal } from './Components/ResolveModal';

const GlobalParamsPage = () => {
  const {
    loading,
    data,
    modalVisible,
    setModalVisible,
    editingItem,
    resolveVisible,
    setResolveVisible,
    resolveResult,
    submitting,
    resolving,
    form,
    resolveForm,
    loadData,
    handleCreate,
    handleEdit,
    handleDelete,
    handleSubmit,
    handleResolve,
    openResolve,
  } = useGlobalParamsState();

  const columns = useMemo(
    () => buildColumns({ onEdit: handleEdit, onDelete: handleDelete }),
    [handleEdit, handleDelete]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader
        loading={loading}
        onCreate={handleCreate}
        onRefresh={loadData}
        onResolve={openResolve}
      />

      <Table
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey="id"
        size="middle"
        pagination={{ pageSize: 20 }}
      />

      <ParamModal
        open={modalVisible}
        editingItem={editingItem}
        form={form}
        submitting={submitting}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      />

      <ResolveModal
        open={resolveVisible}
        form={resolveForm}
        resolving={resolving}
        result={resolveResult}
        onCancel={() => setResolveVisible(false)}
        onOk={handleResolve}
      />
    </div>
  );
};

export default GlobalParamsPage;
