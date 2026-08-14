/**
 * Assistant Action Panel Vitest Tests
 *
 * Validates the TR-09/10/11 action panel renders correctly with all three
 * action buttons and handles the async action execution flow.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    },
  };
});

// Mock API — use vi.fn so we can track calls
const mockAssistantAction = vi.fn().mockResolvedValue({
  data: {
    kind: 'trigger_pipeline',
    status: 'executed',
    summary: '已创建研发流程 Run: run-dev-agent',
    entity_id: 'run-1',
    steps: ['识别意图：触发研发流程 Agent'],
    executed_at: '2026-08-14T01:00:00.000Z',
  },
});
const mockAssistantAsk = vi.fn().mockResolvedValue({
  data: {
    question: 'test',
    intent: 'pipeline',
    answer: 'AI generated answer',
    sources: [],
    generated: true,
    createdAt: '2026-08-14T01:00:00.000Z',
  },
});
const mockIngestSource = vi.fn().mockResolvedValue({
  data: { source: 'alert', indexed: 2, space_id: 'space-1', destination: 'kb' },
});

vi.doMock('@/api/assistant', () => ({
  assistantAsk: mockAssistantAsk,
  assistantAction: mockAssistantAction,
  ingestSource: mockIngestSource,
}));

// Import tokens mock
vi.mock('@/tokens', () => ({
  colors: {
    primary: { 500: '#3370E6' },
    neutral: { 200: '#EDEDED', 300: '#D9D9D9', 400: '#BFBFBF', 500: '#8C8C8C', 900: '#1F1F1F' },
    purple: { 500: '#722ED1' },
    info: { 500: '#1677FF' },
    magenta: { 500: '#EB2F96' },
    light: { bg: { primary: '#FFFFFF', secondary: '#F5F5F7', tertiary: '#FAFAFA' }, border: { light: '#F0F0F0' } },
    success: { 500: '#52C41A' },
    error: { 600: '#CF1322' },
    warning: { 500: '#FAAD14' },
  },
  spacing: { sm: 8, md: 12, lg: 16, xl: 24, 3: 12, 6: 24 },
}));

// Re-import after mocks
const AssistantPage = (await vi.importActual('../../pages/Assistant/index.tsx')).default;

describe('Assistant Action Panel (TR-09/10/11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssistantAction.mockReset();
    mockAssistantAsk.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the action panel header', () => {
    render(<AssistantPage />);
    expect(screen.getByText(/智能操作/)).toBeInTheDocument();
  });

  it('shows all three TR action buttons when panel is expanded', async () => {
    render(<AssistantPage />);
    const panel = screen.getByText(/智能操作/);
    fireEvent.click(panel);

    // The Collapse component renders children but may hide via CSS animation.
    // Use container.innerHTML to verify button text is in DOM regardless of visibility.
    await waitFor(() => {
      const container = document.body;
      const html = container.innerHTML;
      expect(html).toContain('触发研发流程 Agent');
      expect(html).toContain('AI 生成流程');
      expect(html).toContain('Ops 问答助手');
    }, { timeout: 10000 });
  });

  it('shows action prompt textarea when panel is expanded', async () => {
    render(<AssistantPage />);
    const panel = screen.getByText(/智能操作/);
    fireEvent.click(panel);

    await waitFor(() => {
      const container = document.body;
      const html = container.innerHTML;
      expect(html).toContain('帮我触发');
    }, { timeout: 10000 });
  });

  it('calls assistantAsk when user submits a question via Enter', async () => {
    render(<AssistantPage />);
    const input = screen.getByPlaceholderText(/输入问题/);
    fireEvent.change(input, { target: { value: '测试问题' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false, preventDefault: vi.fn() });

    await waitFor(() => {
      expect(mockAssistantAsk).toHaveBeenCalledWith(
        expect.objectContaining({ question: '测试问题' })
      );
    });
  });

  it('shows AI generated tag for assistant responses', async () => {
    render(<AssistantPage />);
    const input = screen.getByPlaceholderText(/输入问题/);
    fireEvent.change(input, { target: { value: '测试问题' } });
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false, preventDefault: vi.fn() });

    await waitFor(() => {
      expect(screen.getByText(/AI 生成/)).toBeInTheDocument();
    });
  });

  it('shows empty state with suggestion buttons when no messages', () => {
    render(<AssistantPage />);
    expect(screen.getByText(/从下面的示例问题开始/)).toBeInTheDocument();
    expect(screen.getByText(/为什么服务一直告警 cpu 高/)).toBeInTheDocument();
  });

  it('renders data source ingestion panel', () => {
    render(<AssistantPage />);
    expect(screen.getByText(/数据源接通演示/)).toBeInTheDocument();
  });
});
