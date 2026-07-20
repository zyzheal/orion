/**
 * Tests for IacManagementLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IacManagementLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('IacManagementLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<IacManagementLayout />);
    expect(document.body).toBeTruthy();
  });
});
