/**
 * useVectorStoreState.ts - 向量存储状态管理 Hook
 * 抽取自 VectorStorePage.tsx (P2-9 Phase 93)
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, message } from 'antd';
import type {
  VectorCollection,
  VectorDocument,
  SearchHit,
  VectorStats,
  CreateCollectionInput,
  AddDocumentInput,
  SearchInput,
} from '@/api/vector-store';
import {
  getCollections,
  createCollection,
  deleteCollection,
  getCollectionDocuments,
  addDocument,
  deleteDocument,
  searchVectors,
  getVectorStats,
} from '@/api/vector-store';

export interface CreateCollectionFormValues {
  name: string;
  displayName: string;
  description?: string;
  dimensions: number;
  indexType?: string;
  distanceMetric?: string;
}

export function useVectorStoreState() {
  const [loading, setLoading] = useState(false);
  const [collections, setCollections] = useState<VectorCollection[]>([]);
  const [searchQuery] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<VectorCollection | null>(null);
  const [collectionDocs, setCollectionDocs] = useState<VectorDocument[]>([]);
  const [stats, setStats] = useState<VectorStats | null>(null);

  // Search tab state
  const [searchText, setSearchText] = useState('');
  const [searchCollection, setSearchCollection] = useState<string | undefined>(undefined);
  const [searchTopK, setSearchTopK] = useState(5);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);

  // Upload tab state
  const [uploadContent, setUploadContent] = useState('');
  const [uploadCollection, setUploadCollection] = useState<string | undefined>(undefined);
  const [uploadMetadata, setUploadMetadata] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  const [form] = Form.useForm<CreateCollectionFormValues>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCollections();
      setCollections(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setCollections([]);
      message.error(`加载集合数据失败: ${(error as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await getVectorStats();
      setStats(res.data || null);
    } catch {
      setStats(null);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadStats();
  }, [loadData, loadStats]);

  const filteredCollections = useMemo(() => {
    if (!searchQuery) return collections;
    const q = searchQuery.toLowerCase();
    return collections.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.displayName.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [searchQuery, collections]);

  const handleCreate = useCallback(
    async (values: CreateCollectionFormValues) => {
      try {
        const data: CreateCollectionInput = {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          dimensions: values.dimensions,
          indexType: (values.indexType as CreateCollectionInput['indexType']) || 'hnsw',
          distanceMetric:
            (values.distanceMetric as CreateCollectionInput['distanceMetric']) || 'cosine',
        };
        await createCollection(data);
        message.success('集合创建成功');
        setCreateModalOpen(false);
        form.resetFields();
        loadData();
        loadStats();
      } catch (error: unknown) {
        message.error(`创建失败：${(error as Error).message}`);
      }
    },
    [form, loadData, loadStats]
  );

  const handleDeleteCollection = useCallback(
    async (name: string) => {
      try {
        await deleteCollection(name);
        message.success('集合已删除');
        loadData();
        loadStats();
      } catch (error: unknown) {
        message.error(`删除失败：${(error as Error).message}`);
      }
    },
    [loadData, loadStats]
  );

  const loadCollectionDocs = useCallback(async (name: string) => {
    try {
      const res = await getCollectionDocuments(name);
      setCollectionDocs(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setCollectionDocs([]);
      message.error(`加载文档列表失败: ${(error as Error).message}`);
    }
  }, []);

  const openDetail = useCallback(
    async (collection: VectorCollection) => {
      setSelectedCollection(collection);
      setDetailDrawerOpen(true);
      await loadCollectionDocs(collection.name);
    },
    [loadCollectionDocs]
  );

  const handleDeleteDoc = useCallback(
    async (id: string) => {
      try {
        await deleteDocument(id);
        message.success('文档已删除');
        if (selectedCollection) await loadCollectionDocs(selectedCollection.name);
      } catch (error: unknown) {
        message.error(`删除失败：${(error as Error).message}`);
      }
    },
    [selectedCollection, loadCollectionDocs]
  );

  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) {
      message.warning('请输入搜索内容');
      return;
    }
    setSearchLoading(true);
    try {
      const data: SearchInput = {
        query: searchText,
        collection: searchCollection,
        topK: searchTopK,
      };
      const res = await searchVectors(data);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch (error: unknown) {
      setSearchResults([]);
      message.error(`语义搜索失败: ${(error as Error).message}`);
    } finally {
      setSearchLoading(false);
    }
  }, [searchText, searchCollection, searchTopK]);

  const handleUpload = useCallback(async () => {
    if (!uploadContent.trim()) {
      message.warning('请输入文档内容');
      return;
    }
    setUploadLoading(true);
    try {
      let metadataObj: Record<string, unknown> | undefined;
      if (uploadMetadata.trim()) {
        try {
          metadataObj = JSON.parse(uploadMetadata);
        } catch {
          message.error('元数据 JSON 格式错误');
          setUploadLoading(false);
          return;
        }
      }
      const data: AddDocumentInput = {
        content: uploadContent,
        collection: uploadCollection,
        metadata: metadataObj,
      };
      await addDocument(data);
      message.success('文档上传成功');
      setUploadContent('');
      setUploadMetadata('');
      loadStats();
    } catch (error: unknown) {
      message.error(`上传失败：${(error as Error).message}`);
    } finally {
      setUploadLoading(false);
    }
  }, [uploadContent, uploadCollection, uploadMetadata, loadStats]);

  const handleFileUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setUploadContent(text.substring(0, 10000));
      setUploadMetadata(JSON.stringify({ source: file.name }, null, 2));
      message.success(`文件 ${file.name} 已读取`);
    };
    reader.readAsText(file);
    return false;
  }, []);

  const handleCloseCreateModal = useCallback(() => {
    setCreateModalOpen(false);
    form.resetFields();
  }, [form]);

  const handleCloseDetailDrawer = useCallback(() => {
    setDetailDrawerOpen(false);
  }, []);

  return {
    // State
    loading,
    collections,
    filteredCollections,
    stats,
    createModalOpen,
    setCreateModalOpen,
    detailDrawerOpen,
    selectedCollection,
    collectionDocs,
    form,
    // Search
    searchText,
    setSearchText,
    searchCollection,
    setSearchCollection,
    searchTopK,
    setSearchTopK,
    searchLoading,
    searchResults,
    // Upload
    uploadContent,
    setUploadContent,
    uploadCollection,
    setUploadCollection,
    uploadMetadata,
    setUploadMetadata,
    uploadLoading,
    // Actions
    loadData,
    loadStats,
    handleCreate,
    handleDeleteCollection,
    openDetail,
    handleDeleteDoc,
    handleSearch,
    handleUpload,
    handleFileUpload,
    handleCloseCreateModal,
    handleCloseDetailDrawer,
  };
}
