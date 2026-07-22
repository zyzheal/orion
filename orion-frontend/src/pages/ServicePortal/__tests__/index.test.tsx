/**
 * Tests for ServicePortal page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServicePortal from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ServicePortal', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ServicePortal />);
    expect(document.body).toBeTruthy();
  });
});
