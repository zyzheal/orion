/**
 * Tests for EphemeralEnvDetail page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EphemeralEnvDetail from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('EphemeralEnvDetail', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EphemeralEnvDetail />);
    expect(document.body).toBeTruthy();
  });
});
