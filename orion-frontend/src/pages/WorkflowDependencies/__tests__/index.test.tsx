/**
 * Tests for WorkflowDependenciesPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowDependenciesPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('WorkflowDependenciesPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<WorkflowDependenciesPage />);
    expect(document.body).toBeTruthy();
  });
});
