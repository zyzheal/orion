import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { describe, it, expect, vi } from 'vitest';
import NotificationCenter from '../index';

vi.mock('antd', async (importOriginal) => {
  const actual = await importOriginal<typeof import('antd')>();
  return {
    ...actual,
    message: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
  };
});

describe('NotificationCenter', () => {
  it('renders page header and stats row', () => {
    render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>,
    );
    expect(screen.getByText('通知中心')).toBeInTheDocument();
    expect(screen.getByText('共 0 条通知')).toBeInTheDocument();
  });

  it('renders tab navigation', () => {
    render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>,
    );
    expect(screen.getByText('全部')).toBeInTheDocument();
    expect(screen.getAllByText('未读').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('已读')).toBeInTheDocument();
  });

  it('renders notification settings and mark all buttons', () => {
    render(
      <BrowserRouter>
        <NotificationCenter />
      </BrowserRouter>,
    );
    expect(screen.getByText('通知设置')).toBeInTheDocument();
    expect(screen.getByText('全部已读')).toBeInTheDocument();
    expect(screen.getByText('清除已读')).toBeInTheDocument();
  });
});
