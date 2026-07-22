/**
 * Tests for WorkflowDesigner page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import WorkflowDesigner from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('WorkflowDesigner', () => {
  it('renders without crashing', () => {
    renderWithRouter(<WorkflowDesigner />);
    expect(document.body).toBeTruthy();
  });
});
