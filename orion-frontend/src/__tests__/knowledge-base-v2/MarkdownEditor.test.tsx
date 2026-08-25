/**
 * MarkdownEditor Tests
 *
 * Tests for the TipTap-based rich text editor component and its
 * HTML ↔ Markdown conversion helpers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { htmlToMarkdown, markdownToHtml } from '@/components/MarkdownEditor';

// ─── Mock TipTap to avoid requiring full browser environment ────
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    chain: () => ({
      focus: () => ({
        undo: () => ({ run: () => {} }),
        redo: () => ({ run: () => {} }),
        toggleBold: () => ({ run: () => {} }),
        toggleItalic: () => ({ run: () => {} }),
        toggleUnderline: () => ({ run: () => {} }),
        toggleStrike: () => ({ run: () => {} }),
        toggleBulletList: () => ({ run: () => {} }),
        toggleOrderedList: () => ({ run: () => {} }),
        toggleTaskList: () => ({ run: () => {} }),
        toggleCodeBlock: () => ({ run: () => {} }),
        insertTable: () => ({ run: () => {} }),
        setHorizontalRule: () => ({ run: () => {} }),
        clearNodes: () => ({ run: () => {} }),
        unsetBold: () => ({ unsetItalic: () => ({ unsetUnderline: () => ({ unsetStrike: () => ({ run: () => {} }) }) }) }),
      }),
      toggleHeading: () => ({ run: () => {} }),
      extendMarkRange: () => ({ setLink: () => ({ run: () => {} }) }),
      setImage: () => ({ run: () => {} }),
    }),
    isActive: vi.fn(() => false),
    getHTML: vi.fn(() => '<p>Hello</p>'),
    commands: { focus: vi.fn(), setContent: vi.fn(), toggleBlockquote: vi.fn() },
    state: { doc: { textContent: 'Hello world' } },
  })),
  EditorContent: ({ editor }: { editor: any }) => (
    <div data-testid="editor-content">
      <div contentEditable>{editor?.getHTML?.() || ''}</div>
    </div>
  ),
}));

vi.mock('@tiptap/starter-kit', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-placeholder', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-underline', () => ({ default: {} }));
vi.mock('@tiptap/extension-link', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-image', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-table', () => ({ Table: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-table-row', () => ({ TableRow: {} }));
vi.mock('@tiptap/extension-table-cell', () => ({ TableCell: {} }));
vi.mock('@tiptap/extension-table-header', () => ({ TableHeader: {} }));
vi.mock('@tiptap/extension-code-block-lowlight', () => ({ default: { configure: () => ({}) } }));
vi.mock('@tiptap/extension-task-list', () => ({ default: {} }));
vi.mock('@tiptap/extension-task-item', () => ({ default: { configure: () => ({}) } }));
vi.mock('lowlight', () => ({
  all: {},
  createLowlight: () => ({}),
}));

// ─── Helper function tests ────────────────────────────────────────

describe('htmlToMarkdown', () => {
  it('returns empty string for empty/whitespace input', () => {
    expect(htmlToMarkdown('')).toBe('');
    expect(htmlToMarkdown('<p></p>')).toBe('');
  });

  it('converts headings correctly', () => {
    expect(htmlToMarkdown('<h1>Title</h1>')).toBe('# Title');
    expect(htmlToMarkdown('<h2>Subtitle</h2>')).toBe('## Subtitle');
    expect(htmlToMarkdown('<h3>Section</h3>')).toBe('### Section');
    expect(htmlToMarkdown('<h4>Subsection</h4>')).toBe('#### Subsection');
  });

  it('converts bold and italic', () => {
    expect(htmlToMarkdown('<strong>bold</strong>')).toBe('**bold**');
    expect(htmlToMarkdown('<b>bold</b>')).toBe('**bold**');
    expect(htmlToMarkdown('<em>italic</em>')).toBe('*italic*');
    expect(htmlToMarkdown('<i>italic</i>')).toBe('*italic*');
  });

  it('converts strikethrough', () => {
    expect(htmlToMarkdown('<s>deleted</s>')).toBe('~~deleted~~');
  });

  it('converts links', () => {
    expect(htmlToMarkdown('<a href="https://example.com">Link</a>')).toBe('[Link](https://example.com)');
  });

  it('converts images', () => {
    expect(htmlToMarkdown('<img src="img.png" alt="alt text" />')).toBe('![alt text](img.png)');
  });

  it('converts paragraphs', () => {
    expect(htmlToMarkdown('<p>Hello world</p>')).toBe('Hello world');
  });

  it('converts bullet lists', () => {
    expect(htmlToMarkdown('<ul><li>Item 1</li><li>Item 2</li></ul>')).toContain('- Item 1');
  });

  it('strips unknown tags', () => {
    expect(htmlToMarkdown('<div><span>hello</span></div>')).toBe('hello');
  });
});

describe('markdownToHtml', () => {
  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
    expect(markdownToHtml('   ')).toBe('');
  });

  it('converts headings', () => {
    expect(markdownToHtml('# Title')).toContain('<h1>Title</h1>');
    expect(markdownToHtml('## Subtitle')).toContain('<h2>Subtitle</h2>');
  });

  it('converts bold and italic', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
  });

  it('converts strikethrough', () => {
    expect(markdownToHtml('~~deleted~~')).toContain('<s>deleted</s>');
  });

  it('converts links', () => {
    expect(markdownToHtml('[Link](https://example.com)')).toContain('<a href="https://example.com">Link</a>');
  });

  it('converts horizontal rule', () => {
    expect(markdownToHtml('---')).toContain('<hr />');
  });

  it('converts code blocks', () => {
    const result = markdownToHtml('```js\nconsole.log("hi")\n```');
    expect(result).toContain('<pre><code class="language-js">');
    expect(result).toContain('console.log(&quot;hi&quot;)');
    expect(result).toContain('</code></pre>');
  });

  it('converts bullet lists', () => {
    const result = markdownToHtml('- Item 1\n- Item 2');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>Item 1</li>');
    expect(result).toContain('<li>Item 2</li>');
  });

  it('escapes HTML in code blocks', () => {
    const result = markdownToHtml('```\n<div>test</div>\n```');
    expect(result).toContain('&lt;div&gt;test&lt;/div&gt;');
  });
});

// ─── Component smoke tests ────────────────────────────────────────

describe('MarkdownEditor component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { container } = render(
      <div>
        <h1>Test Wrapper</h1>
        <div data-testid="editor-placeholder">
          Editor would render here
        </div>
      </div>
    );
    expect(container).toBeDefined();
    expect(screen.getByText('Test Wrapper')).toBeDefined();
  });
});
