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

  it('should show error when username is empty', async () => {
    renderWithRouter(<Login />);
    const submitButton = screen.getByRole('button', { name: /登/i });

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入用户名')).toBeInTheDocument();
    });
  });

  it('should show error when password is empty', async () => {
    renderWithRouter(<Login />);
    const usernameInput = screen.getByPlaceholderText('用户名');
    const submitButton = screen.getByRole('button', { name: /登/i });

    fireEvent.change(usernameInput, { target: { value: 'admin' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('请输入密码')).toBeInTheDocument();
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
