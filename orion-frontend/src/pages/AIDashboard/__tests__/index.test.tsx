/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AIDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AIDashboard />);
    expect(document.body).toBeTruthy();
  });
});
