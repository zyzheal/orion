/**
 * Tests for ApmSlowRequestsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApmSlowRequestsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ApmSlowRequestsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ApmSlowRequestsPage />);
    expect(document.body).toBeTruthy();
  });
});
