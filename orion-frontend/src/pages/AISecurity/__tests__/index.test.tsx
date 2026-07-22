/**
 * Tests for AISecurityPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AISecurityPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AISecurityPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AISecurityPage />);
    expect(document.body).toBeTruthy();
  });
});
