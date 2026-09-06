/**
 * DocDetail - 文档详情抽屉（编辑/预览/导出/版本历史）
 * 抽取自 KnowledgeBasePage.tsx (P2-9 Phase 39)
 */
import React, { useState, useEffect } from 'react';
import { Drawer, Input, Space, Button, Tooltip, Popconfirm, Divider, Typography, message, Empty } from 'antd';
import {
  FileTextOutlined,
  EditOutlined,
  EyeOutlined,
  SaveOutlined,
  DeleteOutlined,
  ExportOutlined,
} from '@ant-design/icons';
import MarkdownEditor, { htmlToMarkdown } from '@/components/MarkdownEditor';
import VersionHistoryPanel from './components/VersionHistoryPanel';
import { colors, spacing } from '@/tokens';
import type { WikiDocument, CreateDocumentInput } from '@/api/pandawiki';

const { Text } = Typography;

export interface DocDetailProps {
  visible: boolean;
  onClose: () => void;
  doc: WikiDocument | null;
  spaceId: string;
  onUpdate: (docId: string, data: Partial<CreateDocumentInput>) => Promise<void>;
  onDelete: (docId: string) => Promise<void>;
  onRefresh: () => void;
}

export const DocDetail: React.FC<DocDetailProps> = ({
  visible, onClose, doc, spaceId, onUpdate, onDelete, onRefresh,
}) => {
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
