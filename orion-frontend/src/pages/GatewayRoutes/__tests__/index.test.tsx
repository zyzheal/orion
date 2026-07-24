/**
 * Tests for GatewayRoutesPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import GatewayRoutesPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('GatewayRoutesPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<GatewayRoutesPage />);
    expect(document.body).toBeTruthy();
  });
});
