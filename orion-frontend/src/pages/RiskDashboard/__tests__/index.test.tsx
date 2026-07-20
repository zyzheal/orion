/**
 * Tests for RiskDashboardPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RiskDashboardPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('RiskDashboardPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<RiskDashboardPage />);
    expect(document.body).toBeTruthy();
  });
});
