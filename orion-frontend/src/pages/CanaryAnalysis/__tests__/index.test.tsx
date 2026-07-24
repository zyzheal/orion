/**
 * Tests for CanaryAnalysis page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CanaryAnalysis from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CanaryAnalysis', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CanaryAnalysis />);
    expect(document.body).toBeTruthy();
  });
});
