/**
 * Tests for EnvProfilesPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import EnvProfilesPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('EnvProfilesPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<EnvProfilesPage />);
    expect(document.body).toBeTruthy();
  });
});
