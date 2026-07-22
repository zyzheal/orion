/**
 * Tests for SbomDashboard page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SbomDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SbomDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SbomDashboard />);
    expect(document.body).toBeTruthy();
  });
});
