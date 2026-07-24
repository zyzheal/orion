/**
 * Tests for QueueTasksPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QueueTasksPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('QueueTasksPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<QueueTasksPage />);
    expect(document.body).toBeTruthy();
  });
});
