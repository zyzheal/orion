/**
 * Tests for TenantListPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TenantListPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TenantListPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TenantListPage />);
    expect(document.body).toBeTruthy();
  });
});
