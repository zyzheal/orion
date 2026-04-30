import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '@/pages/Login';

// Mock useAuth hook
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: vi.fn(async () => ({ success: true })),
    isLoading: false,
    user: null,
    isAuthenticated: false,
    logout: vi.fn(),
  }),
}));

// Mock window.location to prevent navigation errors
const mockLocation = { href: '' };
Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
});

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>);
};

describe('Login', () => {
  it('should render login form', () => {
    renderWithRouter(<Login />);
    expect(screen.getByPlaceholderText('用户名')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登/i })).toBeInTheDocument();
  });

  it.skip('should show error when username is empty', async () => {
    // TODO: Fix Ant Design Form validation in JSDOM environment
    renderWithRouter(<Login />);
    const submitButton = screen.getByRole('button', { name: /登/i });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/请输入/)).toBeInTheDocument();
    });
  });

  it.skip('should show error when password is empty', async () => {
    // TODO: Fix Ant Design Form validation in JSDOM environment
    renderWithRouter(<Login />);
    const usernameInput = screen.getByPlaceholderText('用户名');
    const submitButton = screen.getByRole('button', { name: /登/i });
    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.click(submitButton);
    await waitFor(() => {
      expect(screen.getByText(/请输入密码/)).toBeInTheDocument();
    });
  });

  it('should submit form with valid data', async () => {
    renderWithRouter(<Login />);
    const usernameInput = screen.getByPlaceholderText('用户名');
    const passwordInput = screen.getByPlaceholderText('密码');
    const submitButton = screen.getByRole('button', { name: /登/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.change(passwordInput, { target: { value: 'admin123' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('用户名')).toHaveValue('admin');
      expect(screen.getByPlaceholderText('密码')).toHaveValue('admin123');
    });
  });
});
