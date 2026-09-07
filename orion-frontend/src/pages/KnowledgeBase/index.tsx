/**
 * AI 知识库管理页面 (Phase 4)
 * 组件化重构 (P2-9 Phase 169): 445→52 行
 */
import { useMemo } from 'react';
import { PageHeader } from './Components/PageHeader';
import { SearchFilterCard } from './Components/SearchFilterCard';
import { KnowledgeTable } from './Components/KnowledgeTable';
import { KnowledgeModal } from './Components/KnowledgeModal';
import { buildColumns } from './columns';
import { useKnowledgeBaseState } from './useKnowledgeBaseState';

export default function KnowledgeBase() {
  const {
    loading,
    items,
    categories,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    createModalVisible,
    setCreateModalVisible,
    editModalVisible,
    setEditModalVisible,
    setEditItem,
    createForm,
    editForm,
    loadData,
    handleSearch,
    handleCreate,
    handleEdit,
    handleDelete,
    openEdit,
  } = useKnowledgeBaseState();

  const columns = useMemo(
    () => buildColumns({ openEdit, handleDelete }),
    [openEdit, handleDelete]
  );

  return (
    <div style={{ padding: 0 }}>
      <PageHeader loading={loading} onRefresh={loadData} onCreate={() => setCreateModalVisible(true)} />

      <SearchFilterCard
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearch={handleSearch}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        categories={categories}
      />

      <KnowledgeTable columns={columns} dataSource={items} loading={loading} />

      <KnowledgeModal
        open={createModalVisible}
        isEdit={false}
        form={createForm}
        categories={categories}
        onOk={handleCreate}
        onCancel={() => setCreateModalVisible(false)}
      />

      <KnowledgeModal
        open={editModalVisible}
        isEdit
        form={editForm}
        categories={categories}
        onOk={handleEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditItem(null);
        }}
      />
    </div>
  );
}
