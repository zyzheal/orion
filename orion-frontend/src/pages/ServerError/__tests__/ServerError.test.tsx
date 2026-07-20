/**
 * Tests for ServerError page (500)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServerError from '@/pages/ServerError';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ServerError', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ServerError />);
    expect(document.body).toBeTruthy();
  });

  it('displays 500 title', () => {
    renderWithRouter(<ServerError />);
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('displays error ID', () => {
    renderWithRouter(<ServerError />);
    expect(screen.getByText('错误 ID')).toBeInTheDocument();
  });

  it('displays reload button', () => {
    renderWithRouter(<ServerError />);
    expect(screen.getByText('重新加载')).toBeInTheDocument();
  });

  it('displays quick navigation links', () => {
    renderWithRouter(<ServerError />);
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
    expect(screen.getByText('告警中心')).toBeInTheDocument();
  });
});
