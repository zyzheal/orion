/**
 * Tests for ManagerDashboard page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManagerDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ManagerDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ManagerDashboard />);
    expect(document.body).toBeTruthy();
  });
});
