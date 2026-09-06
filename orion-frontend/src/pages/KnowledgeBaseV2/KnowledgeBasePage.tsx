/**
 * KnowledgeBaseV2 — Enhanced Knowledge Base Management
 *
 * 拆分结构（P2-9 Phase 39）:
 * - tree.ts: DocTreeNode 类型 + buildDocTree 函数
 * - useKnowledgeBaseState.ts: 全部 state + 2 loader + 8 handler + 3 memo
 * - DocDetail.tsx: 800px 文档详情抽屉（编辑/预览/导出/版本历史）
 * - ContentHeader.tsx: 顶部空间标题 + 搜索 + 操作按钮
 * - DocStructureCard.tsx: 文档结构树卡片 (Tree + Empty)
 * - SearchResultsList.tsx: 搜索结果卡片 (跨空间导航)
 * - SpaceCreateModal.tsx: 新建知识库空间 Modal
 * - DocCreateModal.tsx: 新建文档 Modal (含 MarkdownEditor + 模板 + 标签)
 * - KnowledgeBasePage.tsx: Sider + Content + 布局 + 表单校验 wrapper
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Typography, Space, Tree, Button, Tooltip, Spin, Layout, Popconfirm, Card, Form } from 'antd';
import type { DataNode } from 'antd/es/tree';
import {
  PlusOutlined,
  BookOutlined,
  DeleteOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { colors, spacing, themeVars } from '@/tokens';
import { useKnowledgeBaseState, type SearchHit } from './useKnowledgeBaseState';
import { DocDetail } from './DocDetail';
import { ContentHeader } from './ContentHeader';
import { DocStructureCard } from './DocStructureCard';
import { SearchResultsList } from './SearchResultsList';
import { SpaceCreateModal } from './SpaceCreateModal';
import { DocCreateModal } from './DocCreateModal';
import SpaceSettingsPanel from './components/SpaceSettingsPanel';

const { Text } = Typography;
const { Sider, Content } = Layout;

const KnowledgeBasePage: React.FC = () => {
  const s = useKnowledgeBaseState();

  // Forms owned here since Modal components need them; state hook handlers take values
  const [spaceForm] = Form.useForm();
  const [docForm] = Form.useForm();

  // Ref for cross-space search navigation (avoids setTimeout race condition)
  const docToOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (docToOpenRef.current) {
      const doc = s.documents.find((d) => d.id === docToOpenRef.current);
      if (doc) {
        s.handleOpenDoc(doc);
        docToOpenRef.current = null;
      }
    }
  }, [s.documents, s.handleOpenDoc]);

  // ── Wrapper handlers that call form.validateFields() then state hook handler ──
  const handleCreateSpace = async () => {
    try {
      const values = await spaceForm.validateFields();
      await s.handleCreateSpace(values);
      spaceForm.resetFields();
    } catch {}
  };

  const handleCreateDocument = async () => {
    try {
      const values = await docForm.validateFields();
      await s.handleCreateDocument(values);
      docForm.resetFields();
    } catch {}
  };

  const handleNavigateDoc = (item: SearchHit) => {
    if (item.spaceId && item.spaceId !== s.selectedSpaceId) {
      docToOpenRef.current = item.id;
      s.setSelectedSpaceId(item.spaceId);
    } else {
      s.handleOpenDoc(item);
    }
  };

  const spaceTreeData: DataNode[] = useMemo(
    () =>
      s.spaces.map((sp) => ({
        key: sp.id,
        title: (
          <Space style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text>{sp.name}</Text>
            <Popconfirm
              title="删除此空间？"
              onConfirm={() => s.handleDeleteSpace(sp.id)}
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
    [s.spaces, s.handleDeleteSpace],
  );

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: themeVars.bgPrimary }}>
      {/* Left Sider: Space Tree */}
      <Sider
        width={240}
        collapsed={s.sidebarCollapsed}
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
          <Tooltip title={s.sidebarCollapsed ? '展开' : '收起'}>
            <Button
              type="text"
              size="small"
              icon={s.sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => s.setSidebarCollapsed(!s.sidebarCollapsed)}
            />
          </Tooltip>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: spacing.sm }}>
          <Space style={{ width: '100%', marginBottom: spacing.sm, justifyContent: 'space-between' }}>
            <Text strong style={{ fontSize: 12 }}>空间 ({s.stats.totalSpaces})</Text>
            <Tooltip title="新建空间">
              <Button type="text" size="small" icon={<PlusOutlined />} onClick={() => s.setSpaceModalVisible(true)} />
            </Tooltip>
          </Space>

          <Spin spinning={s.spacesLoading}>
            <Tree
              treeData={spaceTreeData}
              selectedKeys={[s.selectedSpaceId]}
              onSelect={(keys) => { if (keys.length > 0) s.setSelectedSpaceId(keys[0] as string); }}
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
            <Space><Text>空间:</Text><Text strong>{s.stats.totalSpaces}</Text></Space>
            <Space><Text>文档:</Text><Text strong>{s.stats.totalDocs}</Text></Space>
          </Space>
        </div>
      </Sider>

      {/* Main Content */}
      <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ContentHeader
          spaceName={s.currentSpaceName}
          docCount={s.documents.length}
          hasSpace={!!s.selectedSpaceId}
          searchQuery={s.searchQuery}
          onSearchQueryChange={s.setSearchQuery}
          onSearch={s.handleSearch}
          searching={s.searching}
          onRefresh={() => s.selectedSpaceId && s.loadDocuments(s.selectedSpaceId)}
          onCreateDoc={() => s.setDocModalVisible(true)}
          onOpenSettings={() => s.setSettingsVisible(true)}
        />

        <div style={{ flex: 1, padding: `${spacing.sm} ${spacing.lg}`, overflow: 'auto' }}>
          {s.selectedSpaceId ? (
            <>
              <SearchResultsList
                searchResults={s.searchResults}
                selectedSpaceId={s.selectedSpaceId}
                onNavigateDoc={handleNavigateDoc}
              />

              <DocStructureCard
                documents={s.documents}
                docsLoading={s.docsLoading}
                expandedKeys={s.expandedKeys}
                onExpand={s.setExpandedKeys}
                onOpenDoc={s.handleOpenDoc}
              />
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
      <SpaceCreateModal
        visible={s.spaceModalVisible}
        form={spaceForm}
        submitting={s.spaceSubmitting}
        onOk={handleCreateSpace}
        onCancel={() => { s.setSpaceModalVisible(false); spaceForm.resetFields(); }}
      />

      {/* Create Document Modal */}
      <DocCreateModal
        visible={s.docModalVisible}
        form={docForm}
        submitting={s.docSubmitting}
        spaceId={s.selectedSpaceId}
        documents={s.documents}
        newDocParentId={s.newDocParentId}
        setNewDocParentId={s.setNewDocParentId}
        newDocTags={s.newDocTags}
        setNewDocTags={s.setNewDocTags}
        editorContent={s.editorContent}
        setEditorContent={s.setEditorContent}
        onOk={handleCreateDocument}
        onCancel={() => s.setDocModalVisible(false)}
      />

      {/* Document Detail Drawer */}
      <DocDetail
        visible={s.detailVisible}
        onClose={() => s.setDetailVisible(false)}
        doc={s.selectedDoc}
        spaceId={s.selectedSpaceId}
        onUpdate={s.handleUpdateDocument}
        onDelete={s.handleDeleteDocument}
        onRefresh={s.handleRefreshDoc}
      />

      {/* Space Settings Modal */}
      <SpaceSettingsPanel
        open={s.settingsVisible}
        onCancel={() => s.setSettingsVisible(false)}
        spaceId={s.selectedSpaceId}
        spaceName={s.currentSpaceName}
      />
    </div>
  );
};

export { buildDocTree } from './tree';
export default KnowledgeBasePage;
