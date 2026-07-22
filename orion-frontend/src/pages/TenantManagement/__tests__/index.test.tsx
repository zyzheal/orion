/**
 * Tests for TenantManagementPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TenantManagementPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TenantManagementPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TenantManagementPage />);
    expect(document.body).toBeTruthy();
  });
});
