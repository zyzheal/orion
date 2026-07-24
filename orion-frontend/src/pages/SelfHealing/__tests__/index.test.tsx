/**
 * Tests for SelfHealingLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SelfHealingLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SelfHealingLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SelfHealingLayout />);
    expect(document.body).toBeTruthy();
  });
});
