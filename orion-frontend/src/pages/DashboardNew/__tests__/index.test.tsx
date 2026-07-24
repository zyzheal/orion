/**
 * Tests for DashboardNew page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardNew from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DashboardNew', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DashboardNew />);
    expect(document.body).toBeTruthy();
  });
});
