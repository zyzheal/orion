/**
 * Tests for WorkflowTasksPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowTasksPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('WorkflowTasksPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<WorkflowTasksPage />);
    expect(document.body).toBeTruthy();
  });
});
