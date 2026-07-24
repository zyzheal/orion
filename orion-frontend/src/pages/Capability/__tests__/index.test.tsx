/**
 * Tests for CapabilityManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CapabilityManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CapabilityManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CapabilityManagement />);
    expect(document.body).toBeTruthy();
  });
});
