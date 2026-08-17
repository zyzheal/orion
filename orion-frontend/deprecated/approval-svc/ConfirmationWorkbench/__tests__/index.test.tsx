/**
 * Tests for ConfirmationLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConfirmationLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ConfirmationLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ConfirmationLayout />);
    expect(document.body).toBeTruthy();
  });
});
