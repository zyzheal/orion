/**
 * Tests for PolicyManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PolicyManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PolicyManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PolicyManagement />);
    expect(document.body).toBeTruthy();
  });
});
