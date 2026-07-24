/**
 * Tests for TaskTimeoutsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import TaskTimeoutsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('TaskTimeoutsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<TaskTimeoutsPage />);
    expect(document.body).toBeTruthy();
  });
});
