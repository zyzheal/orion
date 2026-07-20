/**
 * Tests for ConfigManagementPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConfigManagementPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ConfigManagementPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ConfigManagementPage />);
    expect(document.body).toBeTruthy();
  });
});
