import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ActionCard } from '../ActionCard';
import { useChatOpsStore } from '@/stores/chatOpsStore';

vi.mock('@/stores/chatOpsStore', () => ({
  useChatOpsStore: vi.fn(),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('ActionCard', () => {
  const mockExecuteAction = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useChatOpsStore as any).mockReturnValue({ executeAction: mockExecuteAction });
  });

  it('renders action buttons with labels', () => {
    const actions = [
      { label: 'Deploy', command: 'deploy', params: {} },
      { label: 'Rollback', command: 'rollback', params: {} },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('Deploy')).toBeInTheDocument();
    expect(screen.getByText('Rollback')).toBeInTheDocument();
  });

  it('executes command when action has no target', () => {
    const actions = [{ label: 'Deploy', command: 'deploy', params: { env: 'prod' } }];
    render(<ActionCard actions={actions} />, { wrapper });

    fireEvent.click(screen.getByText('Deploy'));
    expect(mockExecuteAction).toHaveBeenCalledWith('deploy', { env: 'prod' });
  });

  it('shows arrow icon for internal navigation actions', () => {
    const actions = [
      {
        label: 'View Details',
        command: 'status',
        params: {},
        target: { resourceType: 'deployment', resourceId: 'dep-123' },
      },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('View Details')).toBeInTheDocument();
  });

  it('shows export icon for external link actions', () => {
    const actions = [
      {
        label: 'View PR',
        command: 'status',
        params: {},
        target: { externalUrl: 'https://github.com/test/pull/1', openInNewTab: true },
      },
    ];
    render(<ActionCard actions={actions} />, { wrapper });

    expect(screen.getByText('View PR')).toBeInTheDocument();
  });

  it('renders status icon when provided', () => {
    const actions = [{ label: 'Done', command: 'noop', params: {} }];
    render(<ActionCard actions={actions} status="success" />, { wrapper });

    expect(screen.getByText('success')).toBeInTheDocument();
  });
});
