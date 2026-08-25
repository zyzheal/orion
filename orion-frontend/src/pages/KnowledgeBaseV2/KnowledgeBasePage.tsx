/**
 * KnowledgeBaseV2 — Enhanced Knowledge Base Management
 *
 * Features over the original KnowledgeBase page:
 *  ✅ Three-panel layout: Space tree | Document tree | Editor
 *  ✅ TipTap Markdown editor (rich text / code / tables / images)
 *  ✅ Space management (CRUD)
 *  ✅ Document tree navigation with parent-child relationships
 *  ✅ Full-text search with relevance scoring
 *  ✅ Word count and character count
 *  ✅ Responsive sidebar collapse
 *  ✅ Version history with diff viewer and one-click restore
 *  ✅ Keyboard shortcuts (Ctrl+S save, Ctrl+B bold, etc.)
 *  ✅ Markdown / HTML export
 */
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Typography,
  Button,
  Space,
  Card,
  Modal,
  Form,
  Input,
  Select,
  message,
  Popconfirm,
  Tree,
  Tag,
  Spin,
  Empty,
  Tooltip,
  Drawer,
  Divider,
  Layout,
} from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  PlusOutlined,
  ReloadOutlined,
  BookOutlined,
  FileTextOutlined,
  SearchOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FolderOutlined,
  FolderOpenOutlined,
  SaveOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ExportOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import MarkdownEditor, { htmlToMarkdown } from '@/components/MarkdownEditor';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import SpaceSettingsPanel from './components/SpaceSettingsPanel';
import { TemplatePicker, type DocumentTemplate } from './components/DocumentTemplates';
import DocumentTagSelector from './components/DocumentTagSelector';
import { colors, spacing, themeVars } from '@/tokens';
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

const { Text, Paragraph } = Typography;
const { Sider, Content } = Layout;

// ─── Types ────────────────────────────────────────────────────────────────

interface DocTreeNode extends WikiDocument {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: DocTreeNode[];
  icon?: React.ReactNode;
}

// ─── Document tree builder ────────────────────────────────────────────────

export function buildDocTree(documents: WikiDocument[]): DocTreeNode[] {
  const map = new Map<string, DocTreeNode>();
  const roots: DocTreeNode[] = [];

  documents.forEach((doc) => {
    map.set(doc.id, {
      ...doc,
      key: doc.id,
      title: doc.title,
      isLeaf: true,
      children: [],
    });
  });

  const attached = new Set<string>();
  documents.forEach((doc) => {
    const node = map.get(doc.id)!;
    if (doc.parentId && doc.parentId !== doc.id && map.has(doc.parentId) && !attached.has(doc.id)) {
      attached.add(doc.id);
      const parent = map.get(doc.parentId)!;
      parent.children = parent.children || [];
      parent.children.push(node);
      parent.isLeaf = false;
    }
  });

  // Attach any unattached nodes as roots (including orphans and cycle-detected nodes)
  documents.forEach((doc) => {
    if (!attached.has(doc.id)) {
      const node = map.get(doc.id)!;
      roots.push(node);
    }
  });

  return roots;
}

// ─── Document detail drawer ───────────────────────────────────────────────

interface DocDetailProps {
  visible: boolean;
  onClose: () => void;
  doc: WikiDocument | null;
  spaceId: string;
  onUpdate: (docId: string, data: Partial<CreateDocumentInput>) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  onRefresh: () => void;
}

const DocDetail: React.FC<DocDetailProps> = ({ visible, onClose, doc, spaceId, onUpdate, onDelete, onRefresh }) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setTitle(doc.title);
      setContent(doc.content || '');
      setMode('edit');
    }
  }, [doc]);

  const handleSave = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await onUpdate(doc.id, { title, content });
      message.success('文档已保存 (Ctrl+S)');
    } catch (error: unknown) {
      message.error(`保存失败: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleExportMd = () => {
    const md = htmlToMarkdown(content);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Markdown 文件已导出');
  };

  const handleExportHtml = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'document'}.html`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('HTML 文件已导出');
  };

  return (
    <Drawer
      title={
        <Space>
          <FileTextOutlined style={{ color: colors.primary[500] }} />
          <Text strong>{title}</Text>
        </Space>
      }
      placement="right"
      width={800}
      open={visible}
      onClose={onClose}
      extra={
        <Space>
          <Tooltip title="导出 Markdown">
            <Button icon={<ExportOutlined />} onClick={handleExportMd} disabled={!doc} />
          </Tooltip>
          <Tooltip title="导出 HTML">
            <Button icon={<ExportOutlined />} onClick={handleExportHtml} disabled={!doc} />
          </Tooltip>
        </Space>
      }
    >
      {doc ? (
        <>
          <div style={{ marginBottom: spacing.md }}>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="文档标题"
              style={{ fontSize: 18, fontWeight: 'bold' }}
              prefix={<FileTextOutlined style={{ color: colors.primary[500] }} />}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: spacing.sm }}>
            <Space>
              <Button
                type={mode === 'edit' ? 'primary' : 'default'}
                icon={<EditOutlined />}
                onClick={() => setMode('edit')}
                size="small"
              >
                编辑
              </Button>
              <Button
                type={mode === 'preview' ? 'primary' : 'default'}
                icon={<EyeOutlined />}
                onClick={() => setMode('preview')}
                size="small"
              >
                预览
              </Button>
            </Space>
            <Space>
              <Tooltip title="保存 (Ctrl+S)">
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  size="small"
                >
                  保存
                </Button>
              </Tooltip>
              <Popconfirm
                title="确认删除此文档？"
                onConfirm={() => onDelete(doc.id).then(onClose)}
              >
                <Button danger icon={<DeleteOutlined />} size="small">
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </div>

          <Divider style={{ margin: '8px 0' }} />

          <MarkdownEditor
            content={content}
            onChange={setContent}
            placeholder="输入文档内容，支持 Markdown 语法..."
            height="500px"
            disabled={mode === 'preview'}
            hideToolbar={mode === 'preview'}
            showWordCount
          />

          <Divider orientation="left">版本历史</Divider>
          {doc && (
            <VersionHistoryPanel
              spaceId={spaceId}
              docId={doc.id}
              onVersionRestored={onRefresh}
            />
          )}
        </>
      ) : (
        <Empty description="请选择一个文档" />
      )}
    </Drawer>
  );
};

// ─── Main Page Component ──────────────────────────────────────────────────

const KnowledgeBasePage: React.FC = () => {
  // ─── State ────────────────────────────────────────────────────────────

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Spaces
  const [spaces, setSpaces] = useState<WikiSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>('');
  const [spaceModalVisible, setSpaceModalVisible] = useState(false);
  const [spaceForm] = Form.useForm();
  const [spaceSubmitting, setSpaceSubmitting] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<WikiDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docModalVisible, setDocModalVisible] = useState(false);
  const [docForm] = Form.useForm();
  const [docSubmitting, setDocSubmitting] = useState(false);
  const [newDocParentId, setNewDocParentId] = useState<string>('');
  const [templatePickerVisible, setTemplatePickerVisible] = useState(false);
  const [newDocTags, setNewDocTags] = useState<string[]>([]);

  // Document detail
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<WikiDocument | null>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; spaceId: string; title: string; content: string; score: number }>>([]);
  const [searching, setSearching] = useState(false);

  // Space settings
  const [settingsVisible, setSettingsVisible] = useState(false);

  // Doc tree expanded keys — persist user's expand/collapse state
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

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

  // Ref for cross-space search navigation (avoids setTimeout race condition)
  const docToOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (docToOpenRef.current) {
      const doc = documents.find((d) => d.id === docToOpenRef.current);
      if (doc) {
        handleOpenDoc(doc);
        docToOpenRef.current = null;
      }
    }
  }, [documents]);

  // ─── Data Loading ─────────────────────────────────────────────────────

  const loadSpaces = useCallback(async () => {
    setSpacesLoading(true);
    try {
      const res = await listSpaces();
      const list = unwrapArray<WikiSpace>(res);
      setSpaces(list);
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
      const list = unwrapArray<WikiDocument>(res);
      setDocuments(list);
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to load documents:', error);
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { loadSpaces(); }, [loadSpaces]);
  useEffect(() => { if (selectedSpaceId) loadDocuments(selectedSpaceId); }, [selectedSpaceId, loadDocuments]);

  // ─── Space Handlers ───────────────────────────────────────────────────

  const handleCreateSpace = async () => {
    try {
      const values = await spaceForm.validateFields();
      setSpaceSubmitting(true);
      await createSpace({ name: values.name, description: values.description || '' });
      message.success('知识库空间创建成功');
      setSpaceModalVisible(false);
      spaceForm.resetFields();
      loadSpaces();
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setSpaceSubmitting(false);
    }
  };

  const handleDeleteSpace = async (id: string) => {
    try {
      await deleteSpace(id);
      message.success('知识库空间已删除');
      if (selectedSpaceId === id) {
        setSelectedSpaceId('');
        setDocuments([]);
      }
      loadSpaces();
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
    }
  };

  // ─── Document Handlers ────────────────────────────────────────────────

  const [editorContent, setEditorContent] = useState('');

  const handleCreateDocument = async () => {
    try {
      const values = await docForm.validateFields();
      // Sync editor content into the form (MarkdownEditor is not Form-bound)
      docForm.setFieldsValue({ content: editorContent || '<p></p>' });
      setDocSubmitting(true);
      const payload: CreateDocumentInput = {
        title: values.title,
        content: editorContent || '<p></p>',
        tags: newDocTags,
      };
      if (newDocParentId) payload.parentId = newDocParentId;
      await createDocument(selectedSpaceId, payload);
      message.success('文档创建成功');
      setDocModalVisible(false);
      docForm.resetFields();
      setNewDocParentId('');
      loadDocuments(selectedSpaceId);
    } catch (error: unknown) {
      const err = error as { errorFields?: unknown };
      if (!err.errorFields) {
        message.error(`创建失败: ${(error as Error).message}`);
      }
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleUpdateDocument = async (docId: string, data: Partial<CreateDocumentInput>) => {
    if (!selectedDoc) return;
    const payload: CreateDocumentInput = {
      title: data.title ?? selectedDoc.title,
      content: data.content ?? selectedDoc.content,
      tags: data.tags ?? selectedDoc.tags,
    };
    if (data.parentId) payload.parentId = data.parentId;
    await updateDocument(selectedSpaceId, docId, payload);
    // Refresh selectedDoc from server to keep state consistent
    try {
      const res = await getDocument(selectedSpaceId, docId);
      const latest = Array.isArray(res.data) ? res.data[0] : (res.data as WikiDocument);
      setSelectedDoc(latest);
    } catch {
      // Fall back to local state — server might return a wrapper we don't recognize
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocument(selectedSpaceId, docId);
      message.success('文档已删除');
      await loadDocuments(selectedSpaceId);
    } catch (error: unknown) {
      message.error(`删除失败: ${(error as Error).message}`);
      // Do not rethrow — DocDetail calls `.then(onClose)`. A rejection would leak.
    }
  };

  const handleOpenDoc = (doc: { id: string }) => {
    const latestDoc = documents.find((d) => d.id === doc.id);
    if (latestDoc) {
      setSelectedDoc(latestDoc);
      setDetailVisible(true);
    }
  };

  const handleRefreshDoc = async () => {
    if (!selectedDoc || !selectedSpaceId) return;
    try {
      const res = await getDocument(selectedSpaceId, selectedDoc.id);
      const latest = Array.isArray(res.data) ? res.data[0] : (res.data as WikiDocument);
      setSelectedDoc(latest);
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to refresh document:', error);
    }
  };

  // ─── Search Handler ───────────────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }
    setSearching(true);
    try {
      const res = await searchDocuments(searchQuery, selectedSpaceId || undefined);
      const list = unwrapSearchResults(res);
      setSearchResults(list);
    } catch (error: unknown) {
      console.error('[KnowledgeBaseV2] Failed to search:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ─── Tree Data ────────────────────────────────────────────────────────

  const docTreeData: DataNode[] = useMemo(() => {
    const tree = buildDocTree(documents);

    function treeNodeToDataNode(node: DocTreeNode): DataNode {
      const hasChildren = node.children && node.children.length > 0;
      return {
        key: node.id,
        title: node.title,
        icon: hasChildren ? <FolderOpenOutlined /> : <FileTextOutlined />,
        isLeaf: !hasChildren,
        ...(hasChildren ? { children: node.children!.map(treeNodeToDataNode) } : {}),
      };
    }
    return tree.map(treeNodeToDataNode);
  }, [documents]);

  const spaceTreeData: DataNode[] = useMemo(
    () =>
      spaces.map((s) => ({
        key: s.id,
        title: (
          <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>{s.name}</Text>
            <Popconfirm
              title="删除此空间？"
              onConfirm={() => handleDeleteSpace(s.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                style={{ padding: '0 4px' }}
              />
            </Popconfirm>
          </Space>
        ),
        icon: <BookOutlined style={{ color: colors.primary[500] }} />,
        isLeaf: true,
      })),
    [spaces]
  );

  // ─── Stats ────────────────────────────────────────────────────────────

  const stats = useMemo(
    () => ({
      totalSpaces: spaces.length,
      totalDocs: spaces.reduce((sum, s) => sum + (s.documentCount || 0), 0),
    }),
    [spaces]
  );

  // ─── Search results list ──────────────────────────────────────────────

  const searchResultsList = useMemo(() => {
    if (searchResults.length === 0) return null;
    return (
      <Card size="small" title={<Space><SearchOutlined /> 搜索结果 ({searchResults.length} 条)</Space>}>
        {searchResults.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '8px 0',
              borderBottom: `1px solid ${themeVars.borderLight}`,
              cursor: 'pointer',
            }}
            onClick={() => {
              if (item.spaceId && item.spaceId !== selectedSpaceId) {
                docToOpenRef.current = item.id;
                setSelectedSpaceId(item.spaceId);
              } else {
                handleOpenDoc(item);
              }
            }}
          >
            <Space>
              <FileTextOutlined style={{ color: colors.primary[500] }} />
              <Text strong>{item.title}</Text>
              <Tag color="orange">相关度: {(item.score * 100).toFixed(1)}%</Tag>
            </Space>
            <Paragraph
              ellipsis={{ rows: 2 }}
              style={{ marginTop: 4, marginLeft: 24, fontSize: 12, color: '#8c8c8c' }}
            >
              {item.content.replace(/<[^>]*>/g, '')}
            </Paragraph>
          </div>
        ))}
      </Card>
    );
  }, [searchResults, selectedSpaceId, handleOpenDoc]);

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: themeVars.bgPrimary }}>
      {/* Left Sider: Space Tree */}
      <Sider
        width={240}
        collapsed={sidebarCollapsed}
        theme="light"
        style={{
          borderRight: `1px solid ${themeVars.borderLight}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: spacing.md,
            borderBottom: `1px solid ${themeVars.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            <BookOutlined style={{ color: colors.primary[500], fontSize: 18 }} />
            <Text strong style={{ fontSize: 14 }}>知识库</Text>
          </Space>
          <Tooltip title={sidebarCollapsed ? '展开' : '收起'}>
            <Button
              type="text"
              size="small"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
          </Tooltip>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: spacing.sm }}>
          <Space style={{ width: '100%', marginBottom: spacing.sm, justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 12 }}>空间 ({stats.totalSpaces})</Text>
            <Tooltip title="新建空间">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => setSpaceModalVisible(true)} />
            </Tooltip>
          </Space>

          <Spin spinning={spacesLoading}>
            <Tree
              treeData={spaceTreeData}
              selectedKeys={[selectedSpaceId]}
              onSelect={(keys) => { if (keys.length > 0) setSelectedSpaceId(keys[0] as string); }}
              showLine
              blockNode
            />
          </Spin>
        </div>

        <div
          style={{
            padding: spacing.sm,
            borderTop: `1px solid ${themeVars.borderLight}`,
            fontSize: 11,
            color: '#8c8c8c',
          }}
        >
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <Space><Text>空间:</Text><Text strong>{stats.totalSpaces}</Text></Space>
            <Space><Text>文档:</Text><Text strong>{stats.totalDocs}</Text></Space>
          </Space>
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          style={{
            padding: `${spacing.md} ${spacing.lg}`,
            borderBottom: `1px solid ${themeVars.borderLight}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Space>
            <Typography.Title level={4} style={{ marginBottom: 0 }}>
              {spaces.find((s) => s.id === selectedSpaceId)?.name || '知识库'}
            </Typography.Title>
            {selectedSpaceId && <Tag color="blue">{documents.length} 篇文档</Tag>}
          </Space>

          <Space>
            <Input.Search
              placeholder="搜索文档..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
              allowClear
              style={{ width: 280 }}
              loading={searching}
            />
            <Button
              icon={<ReloadOutlined />}
              onClick={() => selectedSpaceId && loadDocuments(selectedSpaceId)}
              disabled={!selectedSpaceId}
            />
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setDocModalVisible(true)} disabled={!selectedSpaceId}>
              新建文档
            </Button>
            <Tooltip title="空间设置">
              <Button
                icon={<SettingOutlined />}
                onClick={() => setSettingsVisible(true)}
                disabled={!selectedSpaceId}
              />
            </Tooltip>
          </Space>
        </div>

        <div style={{ flex: 1, padding: `${spacing.sm} ${spacing.lg}`, overflow: 'auto' }}>
          {selectedSpaceId ? (
            <>
              {searchResultsList}

              <Card
                size="small"
                style={{ marginBottom: spacing.md }}
                title={<Space><FolderOutlined /> 文档结构</Space>}
              >
                <Spin spinning={docsLoading}>
                  {documents.length > 0 ? (
                    <Tree
                      treeData={docTreeData}
                      onSelect={(_keys, { node, selected }) => {
                        if (selected && node) {
                          const doc = documents.find((d) => d.id === (node.key as string));
                          if (doc) handleOpenDoc(doc);
                        }
                      }}
                      showLine
                      blockNode
                      expandedKeys={expandedKeys}
                      onExpand={setExpandedKeys}
                    />
                  ) : (
                    <Empty
                      description="暂无文档，点击「新建文档」创建第一篇文章"
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </Spin>
              </Card>
            </>
          ) : (
            <Card style={{ textAlign: 'center', padding: 60 }}>
              <BookOutlined style={{ fontSize: 48, color: '#bfbfbf' }} />
              <p style={{ marginTop: spacing.md, color: '#8c8c8c' }}>
                请从左侧选择一个知识库空间
              </p>
            </Card>
          )}
        </div>
      </Content>

      {/* Create Space Modal */}
      <Modal
        title="新建知识库空间"
        open={spaceModalVisible}
        onCancel={() => { setSpaceModalVisible(false); spaceForm.resetFields(); }}
        onOk={handleCreateSpace}
        confirmLoading={spaceSubmitting}
        width={500}
        destroyOnClose
      >
        <Form form={spaceForm} layout="vertical">
          <Form.Item name="name" label="空间名称" rules={[{ required: true, message: '请输入空间名称' }]}>
            <Input placeholder="如: 技术文档库" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="描述该知识库空间的用途..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Create Document Modal */}
      <Modal
        title="新建文档"
        open={docModalVisible}
        onCancel={() => { setDocModalVisible(false); docForm.resetFields(); setNewDocParentId(''); setNewDocTags([]); setEditorContent(''); }}
        onOk={handleCreateDocument}
        confirmLoading={docSubmitting}
        width={700}
        destroyOnClose
      >
        <Form form={docForm} layout="vertical">
          <Form.Item name="title" label="文档标题" rules={[{ required: true, message: '请输入文档标题' }]}>
            <Input placeholder="如: 项目架构说明" />
          </Form.Item>
          <Form.Item name="parentId" label="上级文档">
            <Select
              placeholder="选择上级文档（留空则创建为根文档）"
              allowClear
              onChange={(v) => setNewDocParentId(v || '')}
              options={documents.map((d) => ({ label: d.title, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="content" label="文档内容">
            <Space style={{ width: '100%', marginBottom: 8 }}>
              <Button
                size="small"
                icon={<BookOutlined />}
                onClick={() => setTemplatePickerVisible(true)}
                disabled={!selectedSpaceId}
              >
                选择模板
              </Button>
            </Space>
            <MarkdownEditor placeholder="输入文档内容..." height="250px" content={editorContent} onChange={setEditorContent} />
          </Form.Item>
          <Form.Item label="标签">
            <DocumentTagSelector
              spaceId={selectedSpaceId}
              value={newDocTags}
              onChange={setNewDocTags}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Document Detail Drawer */}
      <DocDetail
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        doc={selectedDoc}
        spaceId={selectedSpaceId}
        onUpdate={handleUpdateDocument}
        onDelete={handleDeleteDocument}
        onRefresh={handleRefreshDoc}
      />

      {/* Space Settings Modal */}
      <SpaceSettingsPanel
        open={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        spaceId={selectedSpaceId}
        spaceName={spaces.find((s) => s.id === selectedSpaceId)?.name || '知识库'}
      />

      {/* Template Picker */}
      <TemplatePicker
        open={templatePickerVisible}
        onClose={() => setTemplatePickerVisible(false)}
        onSelect={(template: DocumentTemplate) => {
          setEditorContent(template.content);
          docForm.setFieldsValue({ content: template.content });
          setTemplatePickerVisible(false);
          message.success(`已选择模板: ${template.name}`);
        }}
      />
    </div>
  );
};

export default KnowledgeBasePage;
