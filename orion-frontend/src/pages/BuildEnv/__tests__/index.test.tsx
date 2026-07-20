/**
 * Tests for BuildEnvLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BuildEnvLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('BuildEnvLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<BuildEnvLayout />);
    expect(document.body).toBeTruthy();
  });
});
