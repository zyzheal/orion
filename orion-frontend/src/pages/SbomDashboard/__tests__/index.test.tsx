/**
 * Tests for SbomDashboard page
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '@/tests/render';
import SbomDashboard from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SbomDashboard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SbomDashboard />);
    expect(document.body).toBeTruthy();
  });
});
