import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import ComponentRegistry from '@/pages/lowcode-svc/ComponentRegistry/index';
import * as lowcodeApi from '@/api/lowcode';

vi.mock('@/api/lowcode', () => ({
  lowcodeApi: {
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listComponents: vi.fn(),
    getComponent: vi.fn(),
    createComponent: vi.fn(),
  },
  ComponentRegistry: {},
}));

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    Form: {
      Item: ({ children }: any) => <div>{children}</div>,
      useForm: () => [{}],
    },
    message: { success: vi.fn(), error: vi.fn() },
    Modal: ({ open, children }: any) => (open ? <div data-testid="modal">{children}</div> : null),
    Empty: ({ description }: any) => <div data-testid="empty">{description}</div>,
  };
});

describe('ComponentRegistry', () => {
  beforeEach(() => (vi as { clearAllMocks: () => void }).clearAllMocks());

  it('renders without crashing', () => {
    vi.mocked(
      lowcodeApi.lowcodeApi as unknown as { listComponents: () => Promise<unknown> }
    ).listComponents.mockResolvedValue([]);
    render(<ComponentRegistry />);
    const doc = document.body;
    expect(doc).toBeDefined();
  });
});
