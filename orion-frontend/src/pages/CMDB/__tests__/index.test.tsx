/**
 * Tests for CMDBPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { getQueryClient } from '@/providers/QueryProvider';
import { ChartProvider } from '@/components/charts';
import CMDBPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={getQueryClient()}>
      <MemoryRouter>
        <ChartProvider>{ui}</ChartProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
};

describe('CMDBPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CMDBPage />);
    expect(document.body).toBeTruthy();
  });
});
