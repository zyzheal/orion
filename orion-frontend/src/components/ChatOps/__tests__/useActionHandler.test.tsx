import { renderHook, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { useActionHandler } from '../useActionHandler';
import { useChatOpsStore } from '@/stores/chatOpsStore';
import * as security from '../actionSecurity';

// Mock the store
vi.mock('@/stores/chatOpsStore', () => ({
  useChatOpsStore: vi.fn(),
}));

// Mock security module
vi.mock('../actionSecurity', () => ({
  isSafeExternalUrl: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('useActionHandler', () => {
  const mockExecuteAction = vi.fn();
  const mockWindowOpen = vi.fn();
  const originalOpen = window.open;

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatOpsStore as any).mockReturnValue({ executeAction: mockExecuteAction });
    global.window.open = mockWindowOpen;
  });

  afterEach(() => {
    global.window.open = originalOpen;
  });

  it('executes command when action has no target', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = { label: 'Run', command: 'deploy', params: { env: 'prod' } };

    act(() => {
      result.current(action);
    });

    expect(mockExecuteAction).toHaveBeenCalledWith('deploy', { env: 'prod' });
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  it('navigates internally when action has resourceType and resourceId', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { resourceType: 'deployment', resourceId: 'dep-123' },
    };

    act(() => {
      result.current(action);
    });

    expect(window.location.pathname).toBe('/deployments/dep-123');
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('opens external URL in new tab when safe', () => {
    (security.isSafeExternalUrl as any).mockReturnValue(true);
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'Open PR',
      command: 'status',
      params: {},
      target: { externalUrl: 'https://github.com/repo/pull/1', openInNewTab: true },
    };

    act(() => {
      result.current(action);
    });

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://github.com/repo/pull/1',
      '_blank',
      'noopener,noreferrer'
    );
    expect(mockExecuteAction).not.toHaveBeenCalled();
  });

  it('blocks unsafe external URLs and executes command instead', () => {
    (security.isSafeExternalUrl as any).mockReturnValue(false);
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { externalUrl: 'javascript:alert(1)', openInNewTab: true },
    };

    act(() => {
      result.current(action);
    });

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockExecuteAction).toHaveBeenCalledWith('status', {});
  });

  it('ignores actions with unknown resourceType', () => {
    const { result } = renderHook(() => useActionHandler(), { wrapper });
    const action = {
      label: 'View',
      command: 'status',
      params: {},
      target: { resourceType: 'unknown_type', resourceId: '123' },
    };

    act(() => {
      result.current(action);
    });

    expect(mockExecuteAction).toHaveBeenCalledWith('status', {});
  });
});
