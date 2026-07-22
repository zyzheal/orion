/**
 * Tests for Login page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('Login', () => {
  it('renders without crashing', () => {
    renderWithRouter(<Login />);
    expect(document.body).toBeTruthy();
  });
});
