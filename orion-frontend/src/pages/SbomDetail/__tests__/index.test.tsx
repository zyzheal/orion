/**
 * Tests for SbomDetail page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SbomDetail from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SbomDetail', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SbomDetail />);
    expect(document.body).toBeTruthy();
  });
});
