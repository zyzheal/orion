/**
 * Tests for UserSettingsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserSettingsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('UserSettingsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<UserSettingsPage />);
    expect(document.body).toBeTruthy();
  });
});
