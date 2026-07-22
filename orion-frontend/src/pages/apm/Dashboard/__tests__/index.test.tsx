/**
 * Tests for ApmDashboardPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApmDashboardPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ApmDashboardPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ApmDashboardPage />);
    expect(document.body).toBeTruthy();
  });
});
