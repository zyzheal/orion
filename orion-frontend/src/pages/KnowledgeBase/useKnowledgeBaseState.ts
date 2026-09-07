/**
 * KnowledgeBase state hook
 * 抽取自 index.tsx (P2-9 Phase 169)
 */
import { useEffect, useState } from 'react';
import { Form, message } from 'antd';
import {
  createKnowledge as apiCreateKnowledge,
  updateKnowledge as apiUpdateKnowledge,
  deleteKnowledge as apiDeleteKnowledge,
} from '@/api/knowledge';
import { fetchKnowledgeList, fetchKnowledgeCategories, searchKnowledge } from './api';
import type { KnowledgeItem } from './types';

export function useKnowledgeBaseState() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<KnowledgeItem | null>(null);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const loadData = async () => {
    setLoading(true);
    try {
      const [listRes, catRes] = await Promise.all([
        fetchKnowledgeList(selectedCategory),
        fetchKnowledgeCategories(),
      ]);
      setItems(listRes.items);
      setCategories(catRes);
    } catch (error) {
      message.error(`加载失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadData();
      return;
    }
    setLoading(true);
    try {
      const res = await searchKnowledge(searchQuery);
      setItems(res.results.map((r) => r.item));
    } catch (error) {
      message.error(`搜索失败：${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      await apiCreateKnowledge({
        title: values.title,
        content: values.content,
        category: values.category,
        tags: values.tags || [],
      });
      message.success('创建成功');
      setCreateModalVisible(false);
      createForm.resetFields();
      loadData();
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`创建失败：${(error as Error).message}`);
      }
    }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    try {
      const values = await editForm.validateFields();
      await apiUpdateKnowledge(editItem.id, {
        title: values.title,
        content: values.content,
        category: values.category,
        tags: values.tags || [],
      });
      message.success('更新成功');
      setEditModalVisible(false);
      setEditItem(null);
      loadData();
    } catch (error) {
      if (!(error instanceof Error && error.name === 'ValidationError')) {
        message.error(`更新失败：${(error as Error).message}`);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiDeleteKnowledge(id);
      message.success('删除成功');
      loadData();
    } catch (error) {
      message.error(`删除失败：${(error as Error).message}`);
    }
  };

  const openEdit = (record: KnowledgeItem) => {
    setEditItem(record);
    editForm.setFieldsValue({
      title: record.title,
      content: record.content,
      category: record.category,
      tags: record.tags,
    });
    setEditModalVisible(true);
  };

  return {
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
    editItem,
    setEditItem,
    createForm,
    editForm,
    loadData,
    handleSearch,
    handleCreate,
    handleEdit,
    handleDelete,
    openEdit,
  };
}
