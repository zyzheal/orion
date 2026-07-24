/**
 * Tests for DiagnosticLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DiagnosticLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DiagnosticLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DiagnosticLayout />);
    expect(document.body).toBeTruthy();
  });
});
