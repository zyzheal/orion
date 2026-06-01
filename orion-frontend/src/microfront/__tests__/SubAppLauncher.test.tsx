/**
 * SubAppLauncher 组件测试
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock react-router-dom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock antd - use Drawer instead of Popover
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Drawer: ({ children, open, ...props }: any) =>
      React.createElement('div', { 'data-testid': 'drawer', 'data-open': open, ...props }, children),
    Badge: ({ count, status }: any) =>
      React.createElement('span', {
        'data-testid': 'badge',
        'data-count': count,
        'data-status': status,
      }),
  };
});

// Mock the SubAppTrigger component
vi.mock('@/components/SubAppLauncher', async () => {
  const actual = await vi.importActual('@/components/SubAppLauncher');
  return {
    ...actual,
  };
});

describe('SubAppLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the launcher component', async () => {
    const SubAppLauncher = (await import('@/components/SubAppLauncher')).default;
    const { container } = render(React.createElement(SubAppLauncher));
    expect(container.firstChild).toBeTruthy();
  });

  it('should render without errors', async () => {
    const SubAppLauncher = (await import('@/components/SubAppLauncher')).default;
    const { container } = render(React.createElement(SubAppLauncher));
    expect(container).toBeDefined();
  });

  it('should not navigate on initial render', async () => {
    const SubAppLauncher = (await import('@/components/SubAppLauncher')).default;
    render(React.createElement(SubAppLauncher));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('should render the drawer component', async () => {
    const SubAppLauncher = (await import('@/components/SubAppLauncher')).default;
    render(React.createElement(SubAppLauncher));
    const drawer = screen.getByTestId('drawer');
    expect(drawer).toBeTruthy();
  });
});
