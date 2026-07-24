/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CostAllocationPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CostAllocation', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CostAllocationPage />);
    expect(document.body).toBeTruthy();
  });
});
