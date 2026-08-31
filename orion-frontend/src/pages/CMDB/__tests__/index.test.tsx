/**
 * Tests for CMDBPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ChartProvider } from '@/components/charts';
import CMDBPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(
    <MemoryRouter>
      <ChartProvider>{ui}</ChartProvider>
    </MemoryRouter>,
  );
};

describe('CMDBPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CMDBPage />);
    expect(document.body).toBeTruthy();
  });
});
