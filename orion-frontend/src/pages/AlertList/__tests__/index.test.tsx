/**
 * Tests for AlertList page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AlertList from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AlertList', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AlertList />);
    expect(document.body).toBeTruthy();
  });
});
