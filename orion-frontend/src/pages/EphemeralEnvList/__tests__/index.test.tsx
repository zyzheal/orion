/**
 * Tests for EphemeralEnvList page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EphemeralEnvList from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('EphemeralEnvList', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EphemeralEnvList />);
    expect(document.body).toBeTruthy();
  });
});
