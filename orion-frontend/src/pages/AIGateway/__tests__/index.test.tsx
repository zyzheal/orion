/**
 * Tests for AIGatewayPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AIGatewayPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AIGatewayPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AIGatewayPage />);
    expect(document.body).toBeTruthy();
  });
});
