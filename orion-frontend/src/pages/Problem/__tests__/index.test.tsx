/**
 * Tests for ProblemPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProblemPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ProblemPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ProblemPage />);
    expect(document.body).toBeTruthy();
  });
});
