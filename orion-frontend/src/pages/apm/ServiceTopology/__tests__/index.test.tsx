/**
 * Tests for ServiceTopologyPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceTopologyPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ServiceTopologyPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ServiceTopologyPage />);
    expect(document.body).toBeTruthy();
  });
});
