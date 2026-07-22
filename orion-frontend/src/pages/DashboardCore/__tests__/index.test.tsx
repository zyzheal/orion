/**
 * Tests for DashboardCore page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardCore from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DashboardCore', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DashboardCore />);
    expect(document.body).toBeTruthy();
  });
});
