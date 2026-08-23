import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import FormInstancePipeline from '@/pages/lowcode-svc/FormInstancePipeline/index';
import * as lowcodeApi from '@/api/lowcode';

vi.mock('@/api/lowcode', () => ({
  lowcodeApi: {
    listTemplates: vi.fn(),
    getTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listInstances: vi.fn(),
    submitInstance: vi.fn(),
    getInstance: vi.fn(),
    approveInstance: vi.fn(),
  },
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

describe('FormInstancePipeline', () => {
  beforeEach(() => (vi as { clearAllMocks: () => void }).clearAllMocks());

  it('renders without crashing', () => {
    vi.mocked(
      lowcodeApi.lowcodeApi as unknown as { listInstances: () => Promise<unknown> }
    ).listInstances.mockResolvedValue([]);
    render(<FormInstancePipeline />);
    expect(document.body).toBeDefined();
  });
});
