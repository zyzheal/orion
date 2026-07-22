/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangeRequestManagementPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ChangeRequestManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ChangeRequestManagementPage />);
    expect(document.body).toBeTruthy();
  });
});
