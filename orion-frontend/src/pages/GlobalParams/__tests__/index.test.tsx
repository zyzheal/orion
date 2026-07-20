/**
 * Tests for GlobalParamsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GlobalParamsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('GlobalParamsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<GlobalParamsPage />);
    expect(document.body).toBeTruthy();
  });
});
