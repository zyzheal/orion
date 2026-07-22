/**
 * Tests for DatabaseDevOpsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DatabaseDevOpsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('DatabaseDevOpsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<DatabaseDevOpsPage />);
    expect(document.body).toBeTruthy();
  });
});
