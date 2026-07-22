/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SprintBoardPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SprintBoard', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SprintBoardPage />);
    expect(document.body).toBeTruthy();
  });
});
