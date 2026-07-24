/**
 * Tests for ServiceCatalog page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceCatalog from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ServiceCatalog', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ServiceCatalog />);
    expect(document.body).toBeTruthy();
  });
});
