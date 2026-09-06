/**
 * useKnowledgeBaseState - 全部 state + 2 loader + 8 handler + 3 memo
 * 从 KnowledgeBasePage.tsx 抽离 (P2-9 Phase 39)
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { message } from 'antd';
import {
  listSpaces,
  createSpace,
  deleteSpace,
  listDocuments,
  getDocument,
  createDocument,
  deleteDocument,
  updateDocument,
  searchDocuments,
  unwrapArray,
  unwrapSearchResults,
  type WikiSpace,
  type WikiDocument,
  type CreateDocumentInput,
} from '@/api/pandawiki';

export interface SearchHit {
  id: string;
  spaceId: string;
  title: string;
  content: string;
  score: number;
}

export function useKnowledgeBaseState() {
  // ── Sidebar ──
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // ── Spaces ──
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [spaceModalVisible, setSpaceModalVisible] = useState(false);
  const [spaceSubmitting, setSpaceSubmitting] = useState(false);

  // ── Documents ──
  const [documents, setDocuments] = useState<WikiDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [newDocParentId, setNewDocParentId] = useState<string>('');
  const [newDocTags, setNewDocTags] = useState<string[]>([]);

  // ── Document detail ──
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);

  // ── Search ──
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  // ── Space settings ──
  const [settingsVisible, setSettingsVisible] = useState(false);

  // ── Doc tree expanded keys ──
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // ── Editor content buffer (for new-doc modal, kept outside form) ──
  const [editorContent, setEditorContent] = useState('');

  // Auto-expand all parent nodes on first load
  const hasAutoExpanded = useRef(false);
  useEffect(() => {
    if (hasAutoExpanded.current || documents.length === 0) return;
    hasAutoExpanded.current = true;
    const parentIds = new Set<string>();
    documents.forEach((d) => {
      if (d.parentId) parentIds.add(d.parentId);
    });
    setExpandedKeys([...parentIds]);
  }, [documents]);

  // ── Data loading ──
  const loadSpaces = useCallback(async () => {
    setSpacesLoading(true);
    try {
      const res = await listSpaces();
      setSpaces(unwrapArray<WikiSpace>(res));
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to load spaces:', error);
      setSpaces([]);
    } finally {
      setSpacesLoading(false);
    }
  }, []);

  const loadDocuments = useCallback(async (spaceId: string) => {
    if (!spaceId) return;
    setDocsLoading(true);
    try {
      const res = await listDocuments(spaceId);
      setDocuments(unwrapArray<WikiDocument>(res));
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);
  useEffect(() => {
    if (selectedSpaceId) loadDocuments(selectedSpaceId);
  }, [selectedSpaceId, loadDocuments]);

  // ── Space handlers ──
  const handleCreateSpace = useCallback(
    async (values: { name: string; description?: string }) => {
      setSpaceSubmitting(true);
      try {
        await createSpace({ name: values.name, description: values.description || '' });
        message.success('知识库空间创建成功');
        setSpaceModalVisible(false);
        await loadSpaces();
      } catch (error: unknown) {
        message.error(`创建失败: ${(error as Error).message}`);
      } finally {
        setSpaceSubmitting(false);
      }
    },
    [loadSpaces],
  );

  const handleDeleteSpace = useCallback(
    async (id: string) => {
      try {
        await deleteSpace(id);
        message.success('知识库空间已删除');
        if (selectedSpaceId === id) {
          setSelectedSpaceId('');
          setDocuments([]);
        }
        await loadSpaces();
      } catch (error: unknown) {
        message.error(`删除失败: ${(error as Error).message}`);
      }
    },
    [selectedSpaceId, loadSpaces],
  );

  // ── Document handlers ──
  const handleCreateDocument = useCallback(
    async (values: { title: string }) => {
      setDocSubmitting(true);
      try {
        const payload: CreateDocumentInput = {
          title: values.title,
          content: editorContent || '<p></p>',
          tags: newDocTags,
        };
        if (newDocParentId) payload.parentId = newDocParentId;
        await createDocument(selectedSpaceId, payload);
        message.success('文档创建成功');
        setDocModalVisible(false);
        setNewDocParentId('');
        setNewDocTags([]);
        setEditorContent('');
        await loadDocuments(selectedSpaceId);
      } catch (error: unknown) {
        message.error(`创建失败: ${(error as Error).message}`);
      } finally {
        setDocSubmitting(false);
      }
    },
    [selectedSpaceId, editorContent, newDocTags, newDocParentId, loadDocuments],
  );

  const handleUpdateDocument = useCallback(
    async (docId: string, data: Partial<CreateDocumentInput>) => {
      if (!selectedDoc || !selectedSpaceId) return;
      const payload: CreateDocumentInput = {
        title: data.title ?? selectedDoc.title,
        content: data.content ?? selectedDoc.content,
        tags: data.tags ?? selectedDoc.tags,
      };
      if (data.parentId) payload.parentId = data.parentId;
      await updateDocument(selectedSpaceId, docId, payload);
      try {
        const res = await getDocument(selectedSpaceId, docId);
        const latest = Array.isArray(res.data) ? res.data[0] : (res.data as WikiDocument);
        setSelectedDoc(latest);
      } catch {
        // Fall back to local state — server might return a wrapper we don't recognize
      }
    },
    [selectedDoc, selectedSpaceId],
  );

  const handleDeleteDocument = useCallback(
    async (docId: string) => {
      try {
        await deleteDocument(selectedSpaceId, docId);
        message.success('文档已删除');
        await loadDocuments(selectedSpaceId);
      } catch (error: unknown) {
        message.error(`删除失败: ${(error as Error).message}`);
        // Do not rethrow — DocDetail calls `.then(onClose)`. A rejection would leak.
      }
    },
    [selectedSpaceId, loadDocuments],
  );

  const handleOpenDoc = useCallback(
    (doc: { id: string }) => {
      const latestDoc = documents.find((d) => d.id === doc.id);
      if (latestDoc) {
        setSelectedDoc(latestDoc);
        setDetailVisible(true);
      }
    },
    [documents],
  );

  const handleRefreshDoc = useCallback(async () => {
    if (!selectedDoc || !selectedSpaceId) return;
    try {
      const res = await getDocument(selectedSpaceId, selectedDoc.id);
      const latest = Array.isArray(res.data) ? res.data[0] : (res.data as WikiDocument);
      setSelectedDoc(latest);
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to refresh document:', error);
    }
  }, [selectedDoc, selectedSpaceId]);

  // ── Search handler ──
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }
    setSearching(true);
    try {
      const res = await searchDocuments(searchQuery, selectedSpaceId || undefined);
      setSearchResults(unwrapSearchResults(res));
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to search:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery, selectedSpaceId]);

  // ── Stats memo ──
  const stats = useMemo(
    () => ({
      totalSpaces: spaces.length,
      totalDocs: spaces.reduce((sum, s) => sum + (s.documentCount || 0), 0),
    }),
    [spaces],
  );

  // ── Derived: current space name ──
  const currentSpaceName = useMemo(
    () => spaces.find((s) => s.id === selectedSpaceId)?.name || '知识库',
    [spaces, selectedSpaceId],
  );

  return {
    // State
    sidebarCollapsed, setSidebarCollapsed,
    spaces, spacesLoading, selectedSpaceId, setSelectedSpaceId,
    spaceModalVisible, setSpaceModalVisible, spaceSubmitting,
    documents, docsLoading, docModalVisible, setDocModalVisible,
    docSubmitting, newDocParentId, setNewDocParentId,
    newDocTags, setNewDocTags,
    detailVisible, setDetailVisible, selectedDoc, setSelectedDoc,
    searchQuery, setSearchQuery, searchResults, searching,
    settingsVisible, setSettingsVisible,
    expandedKeys, setExpandedKeys,
    editorContent, setEditorContent,
    // Loaders
    loadSpaces, loadDocuments,
    // Handlers
    handleCreateSpace, handleDeleteSpace,
    handleCreateDocument, handleUpdateDocument, handleDeleteDocument,
    handleOpenDoc, handleRefreshDoc, handleSearch,
    // Derived
    stats, currentSpaceName,
  };
}
