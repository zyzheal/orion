/**
 * Tests for UserProfile page
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfile from '@/pages/UserProfile';

// Mock user API
vi.mock('@/api/user', () => ({
  userApi: {
    getProfile: vi.fn().mockResolvedValue({
      username: 'testuser',
      email: 'test@example.com',
      role: 'developer',
      status: 'active',
      createdAt: '2026-01-01',
    }),
    getTeams: vi.fn().mockResolvedValue([]),
    getActivities: vi.fn().mockResolvedValue([]),
    updateProfile: vi.fn().mockResolvedValue({}),
  },
}));

// Mock message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd') as any;
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
    },
  };
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('UserProfile', () => {
  it('renders without crashing', async () => {
    renderWithRouter(<UserProfile />);
    await waitFor(() => {
      expect(screen.getByText('个人中心')).toBeInTheDocument();
    });
  });
});
