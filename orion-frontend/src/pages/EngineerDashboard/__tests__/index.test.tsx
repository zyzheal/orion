/**
 * Tests for EngineerDashboard page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EngineerDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('EngineerDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EngineerDashboard />);
    expect(document.body).toBeTruthy();
  });
});
