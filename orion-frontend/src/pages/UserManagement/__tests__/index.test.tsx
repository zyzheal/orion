/**
 * Tests for UserManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('UserManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<UserManagement />);
    expect(document.body).toBeTruthy();
  });
});
