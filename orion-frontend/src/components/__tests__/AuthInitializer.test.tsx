import { render, screen, waitFor } from '@testing-library/react';
import { AuthInitializer } from '../AuthInitializer';
import { useAuthStore } from '@/stores/authStore';

describe('AuthInitializer', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.getState().logout();
  });

  it('renders children after successful token validation', async () => {
    localStorage.setItem('access_token', 'valid-token');

    // Mock fetch for /me
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        data: { id: '1', username: 'test', email: 'test@test.com', role: 'admin' },
      }),
    });

    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  it('clears localStorage and logs out when token is invalid', async () => {
    localStorage.setItem('access_token', 'invalid-token');

    global.fetch = vi.fn().mockRejectedValue(new Error('Invalid token'));

    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  it('renders children immediately when no token exists', async () => {
    render(
      <AuthInitializer>
        <div data-testid="child">App Content</div>
      </AuthInitializer>
    );

    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
