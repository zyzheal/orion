/**
 * Tests for NotFound page (404)
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('NotFound', () => {
  it('renders without crashing', () => {
    renderWithRouter(<NotFound />);
    expect(document.body).toBeTruthy();
  });

  it('displays 404 title', () => {
    renderWithRouter(<NotFound />);
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('displays search input', () => {
    renderWithRouter(<NotFound />);
    expect(screen.getByPlaceholderText('搜索功能、页面或资源...')).toBeInTheDocument();
  });

  it('displays quick navigation links', () => {
    renderWithRouter(<NotFound />);
    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('Pipeline')).toBeInTheDocument();
  });
});
