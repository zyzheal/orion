/**
 * Tests for ExecutiveDashboard page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ExecutiveDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ExecutiveDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ExecutiveDashboard />);
    expect(document.body).toBeTruthy();
  });
});
