/**
 * Tests for WorkflowTriggers page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowTriggers from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('WorkflowTriggers', () => {
  it('renders without crashing', () => {
    renderWithRouter(<WorkflowTriggers />);
    expect(document.body).toBeTruthy();
  });
});
