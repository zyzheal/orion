/**
 * Tests for ServiceCatalog page
 */
import { describe, it, expect } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '@/tests/render';
import ServiceCatalog from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return renderWithProviders(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ServiceCatalog', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ServiceCatalog />);
    expect(document.body).toBeTruthy();
  });
});
