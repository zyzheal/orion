/**
 * MarkdownEditor — TipTap-based rich text / Markdown editor
 *
 * Features:
 *  - Full rich text editing (heading, bold, italic, underline, strikethrough)
 *  - Code blocks with syntax highlighting
 *  - Tables (insert / resize)
 *  - Task lists (checkable items)
 *  - Images (paste / drag-drop / URL)
 *  - Links (inline + auto-link)
 *  - Bullet / ordered lists
 *  - Blockquote, horizontal rule
 *  - Undo / Redo
 *  - Placeholder text when empty
 *  - Read-only mode for document viewing
 *  - HTML content sync via onChange
 *  - Markdown <-> HTML conversion
 *
 * Usage:
 *   <MarkdownEditor
 *     content={htmlContent}
 *     onChange={setHtmlContent}
 *     placeholder="输入文档内容..."
 *     height="400px"
 *   />
 */

import React, { useMemo, useEffect, useRef } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { all, createLowlight } from 'lowlight';
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  StrikethroughOutlined,
  CodeOutlined,
  LinkOutlined,
  PictureOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  CheckSquareOutlined,
  VerticalAlignMiddleOutlined,
  UndoOutlined,
  RedoOutlined,
  TableOutlined,
  FormatPainterOutlined,
} from '@ant-design/icons';
import { Button, Tooltip, Space, Divider, Select, theme } from 'antd';
import type { SizeType } from 'antd/es/config-provider/SizeContext';

// ─── Lowlight setup for code highlighting ──────────────────────────

const lowlight = createLowlight(all);

// ─── HTML ↔ Markdown conversion helpers ────────────────────────────

/**
 * Convert HTML to Markdown (basic conversion for import/export)
 */
export function htmlToMarkdown(html: string): string {
  if (!html || html === '<p></p>') return '';

  let md = html
    // Code blocks
    .replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, '```$1\n$2\n```')
    .replace(/<pre><code>([\s\S]*?)<\/code><\/pre>/g, '```\n$1\n```')
    // Headings
    .replace(/<h1>([\s\S]*?)<\/h1>/g, '# $1\n')
    .replace(/<h2>([\s\S]*?)<\/h2>/g, '## $1\n')
    .replace(/<h3>([\s\S]*?)<\/h3>/g, '### $1\n')
    .replace(/<h4>([\s\S]*?)<\/h4>/g, '#### $1\n')
    // Bold / Italic
    .replace(/<strong>([\s\S]*?)<\/strong>/g, '**$1**')
    .replace(/<b>([\s\S]*?)<\/b>/g, '**$1**')
    .replace(/<em>([\s\S]*?)<\/em>/g, '*$1*')
    .replace(/<i>([\s\S]*?)<\/i>/g, '*$1*')
    // Strikethrough
    .replace(/<s>([\s\S]*?)<\/s>/g, '~~$1~~')
    // Links
    .replace(
      /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g,
      '[$2]($1)'
    )
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]\/?>/g, '![$2]($1)')
    // Bullet list
    .replace(/<ul>([\s\S]*?)<\/ul>/g, '$1\n')
    .replace(/<li>([\s\S]*?)<\/li>/g, '- $1\n')
    // Ordered list
    .replace(/<ol>([\s\S]*?)<\/ol>/g, '$1\n')
    .replace(/<li>([\s\S]*?)<\/li>/g, '1. $1\n')
    // Blockquote
    .replace(/<blockquote>([\s\S]*?)<\/blockquote>/g, '> $1\n')
    // Horizontal rule
    .replace(/<hr\/?>/g, '---\n')
    // Paragraph
    .replace(/<p>([\s\S]*?)<\/p>/g, '$1\n\n')
    // Line break
    .replace(/<br\/?>/g, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '');

  return md.trim();
}

/**
 * Convert Markdown to HTML (basic conversion for import)
 */
export function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '';

  let html = md
    // Code blocks
    .replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_m, lang, code) => {
        const cls = lang ? ` class="language-${lang}"` : '';
        return `<pre><code${cls}>${escapeHtml(code.trim())}</code></pre>`;
      }
    )
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold / Italic / Strikethrough
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img alt="$1" src="$2" />')
    // Horizontal rule
    .replace(/^---$/gm, '<hr />')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Bullet list
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    // Line breaks → paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />');

  return `<p>${html}</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Toolbar component ─────────────────────────────────────────────

interface EditorToolbarProps {
  editor: Editor | null;
  size?: SizeType;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ editor, size = 'middle' }) => {
  if (!editor) return null;

  const { token } = theme.useToken();

  const toolbarButton = (
    icon: React.ReactNode,
    title: string,
    action: () => void,
    active?: boolean
  ): React.ReactNode => (
    <Tooltip title={title} key={title}>
      <Button
        type={active ? 'primary' : 'text'}
        size={size}
        icon={icon}
        onClick={action}
        style={{
          minWidth: '32px',
          height: '32px',
          padding: 0,
        }}
      />
    </Tooltip>
  );

  const headingDropdown = (
    <Tooltip title="标题级别" key="heading">
      <Select
        size={size}
        style={{ width: 90 }}
        value={
          editor.isActive('heading', { level: 1 }) ? 'h1'
            : editor.isActive('heading', { level: 2 }) ? 'h2'
            : editor.isActive('heading', { level: 3 }) ? 'h3'
            : editor.isActive('heading', { level: 4 }) ? 'h4'
            : 'p'
        }
        onChange={(val) => {
          if (val === 'p') {
            editor.chain().focus().clearNodes().run();
          } else {
            const level = parseInt(val[1]) as 1 | 2 | 3 | 4;
            editor.chain().focus().toggleHeading({ level }).run();
          }
        }}
        options={[
          { label: '正文', value: 'p' },
          { label: '标题 1', value: 'h1' },
          { label: '标题 2', value: 'h2' },
          { label: '标题 3', value: 'h3' },
          { label: '标题 4', value: 'h4' },
        ]}
      />
    </Tooltip>
  );

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 2,
        padding: `4px 8px`,
        borderBottom: `1px solid ${token.colorBorder}`,
        backgroundColor: token.colorBgContainer,
      }}
    >
      {/* Undo / Redo */}
      {toolbarButton(<UndoOutlined />, '撤销 (Ctrl+Z)', () => editor.chain().focus().undo().run())}
      {toolbarButton(<RedoOutlined />, '重做 (Ctrl+Y)', () => editor.chain().focus().redo().run())}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Heading */}
      {headingDropdown}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Text formatting */}
      {toolbarButton(
        <BoldOutlined />,
        '加粗 (Ctrl+B)',
        () => editor.chain().focus().toggleBold().run(),
        editor.isActive('bold')
      )}
      {toolbarButton(
        <ItalicOutlined />,
        '斜体 (Ctrl+I)',
        () => editor.chain().focus().toggleItalic().run(),
        editor.isActive('italic')
      )}
      {toolbarButton(
        <UnderlineOutlined />,
        '下划线 (Ctrl+U)',
        () => editor.chain().focus().toggleUnderline().run(),
        editor.isActive('underline')
      )}
      {toolbarButton(
        <StrikethroughOutlined />,
        '删除线',
        () => editor.chain().focus().toggleStrike().run(),
        editor.isActive('strike')
      )}
      {toolbarButton(
        <FormatPainterOutlined />,
        '清除格式',
        () => editor.chain().focus().unsetBold().unsetItalic().unsetUnderline().unsetStrike().run()
      )}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Lists */}
      {toolbarButton(
        <UnorderedListOutlined />,
        '无序列表',
        () => editor.chain().focus().toggleBulletList().run(),
        editor.isActive('bulletList')
      )}
      {toolbarButton(
        <OrderedListOutlined />,
        '有序列表',
        () => editor.chain().focus().toggleOrderedList().run(),
        editor.isActive('orderedList')
      )}
      {toolbarButton(
        <CheckSquareOutlined />,
        '任务列表',
        () => editor.chain().focus().toggleTaskList().run(),
        editor.isActive('taskList')
      )}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Code */}
      {toolbarButton(
        <CodeOutlined />,
        '代码块',
        () => editor.chain().focus().toggleCodeBlock().run(),
        editor.isActive('codeBlock')
      )}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Block */}
      {toolbarButton(
        <VerticalAlignMiddleOutlined />,
        '引用',
        () => editor.commands.toggleBlockquote(),
        editor.isActive('blockquote')
      )}
      {toolbarButton(
        <TableOutlined />,
        '插入表格',
        () =>
          editor
            .chain()
            .focus()
            .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
            .run()
      )}
      {toolbarButton('---', '分割线', () => editor.chain().focus().setHorizontalRule().run())}

      <Divider type="vertical" style={{ margin: '0 4px' }} />

      {/* Link */}
      {toolbarButton(
        <LinkOutlined />,
        '插入链接',
        () => {
          const url = window.prompt('输入链接地址:');
          if (url) {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }
        },
        editor.isActive('link')
      )}

      {/* Image */}
      {toolbarButton(
        <PictureOutlined />,
        '插入图片',
        () => {
          const url = window.prompt('输入图片地址:');
          if (url) {
            editor.chain().focus().setImage({ src: url }).run();
          }
        }
      )}

      <Space style={{ marginLeft: 'auto' }} />
    </div>
  );
};

// ─── Main MarkdownEditor component ─────────────────────────────────

export interface MarkdownEditorProps {
  /** HTML content (TipTap stores HTML internally) */
  content?: string;
  /** Called when content changes (receives HTML) */
  onChange?: (html: string) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Editor height (CSS value) */
  height?: string;
  /** Disable editing (read-only mode) */
  disabled?: boolean;
  /** Hide toolbar (useful in read-only mode) */
  hideToolbar?: boolean;
  /** Show word count */
  showWordCount?: boolean;
  /** Initial focus on mount */
  autoFocus?: boolean;
  /** Toolbar button size */
  size?: SizeType;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  content = '',
  onChange,
  placeholder = '输入文档内容，支持 Markdown 语法...',
  height = '400px',
  disabled = false,
  hideToolbar = false,
  showWordCount = true,
  autoFocus = false,
  size = 'middle',
}) => {
  const editorRef = useRef<Editor | null>(null);
  const externalContentRef = useRef<string | null>(null);
  const isUserEditRef = useRef(false);

  const editor = useEditor(
    {
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editable: !disabled,
      content: content || '',
      extensions: [
        StarterKit.configure({
          heading: { levels: [1, 2, 3, 4] },
          bulletList: { keepMarks: true, keepAttributes: false },
          orderedList: { keepMarks: true, keepAttributes: false },
          codeBlock: false, // We use CodeBlockLowlight instead
        }),
        Placeholder.configure({
          placeholder,
        }),
        Underline,
        Link.configure({
          openOnClick: !disabled,
          HTMLAttributes: {
            target: '_blank',
            rel: 'noopener noreferrer nofollow',
          },
        }),
        Image.configure({
          inline: true,
          allowBase64: true,
        }),
        Table.configure({
          resizable: true,
        }),
        TableRow,
        TableCell,
        TableHeader,
        CodeBlockLowlight.configure({
          lowlight,
          defaultLanguage: null,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
      ],
      editorProps: {
        attributes: {
          class: 'orion-markdown-editor',
        },
      },
      onUpdate: ({ editor }) => {
        const html = editor.getHTML();
        // Mark as user edit to prevent external sync from overwriting
        isUserEditRef.current = true;
        onChange?.(html);
      },
    },
    [content, disabled]
  );

  // Sync external content changes into the editor
  // Only sync when content prop changes from outside the editor
  // (not on every user keystroke, which would overwrite input)
  useEffect(() => {
    if (!editor || content === undefined) return;

    // If content hasn't changed externally, skip
    if (externalContentRef.current === content) return;

    // If this is a user edit (onChange triggered content update), skip
    if (isUserEditRef.current) {
      isUserEditRef.current = false;
      externalContentRef.current = content;
      return;
    }

    // External content change — sync into editor
    externalContentRef.current = content;
    editor.commands.setContent(content || '');
  }, [content, editor]);

  // Expose editor instance
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
    }
  }, [editor]);

  // Auto-focus
  useEffect(() => {
    if (autoFocus && editor && !disabled) {
      editor.commands.focus('end');
    }
  }, [autoFocus, editor, disabled]);

  const wordCount = useMemo(() => {
    if (!editor) return { words: 0, chars: 0 };
    const text = editor.state.doc.textContent;
    return {
      words: text.trim().split(/\s+/).filter(Boolean).length,
      chars: text.length,
    };
  }, [editor?.state.doc]);

  if (!editor) return null;

  return (
    <div
      className="orion-editor-wrapper"
      style={{
        border: `1px solid ${editorRef.current ? 'var(--ant-border-color)' : '#d9d9d9'}`,
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      {!hideToolbar && <EditorToolbar editor={editor} size={size} />}

      {/* Editor content area */}
      <div style={{ height, overflow: 'auto' }}>
        <EditorContent editor={editor} />
      </div>

      {/* Word count footer */}
      {showWordCount && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 12px',
            fontSize: 12,
            color: 'var(--ant-color-text-secondary)',
            borderTop: `1px solid var(--ant-border-color)`,
            backgroundColor: 'var(--ant-color-bg-container)',
          }}
        >
          <span>{wordCount.words} 字 · {wordCount.chars} 字符</span>
          <span>TipTap Markdown Editor</span>
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
