/**
 * Tests for PipelineBudget page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PipelineBudget from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('PipelineBudget', () => {
  it('renders without crashing', () => {
    renderWithRouter(<PipelineBudget />);
    expect(document.body).toBeTruthy();
  });
});
