/**
 * Tests for SLAManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SLAManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SLAManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SLAManagement />);
    expect(document.body).toBeTruthy();
  });
});
