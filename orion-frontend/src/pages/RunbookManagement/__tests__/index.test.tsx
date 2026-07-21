/**
 * Tests for function page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RunbookManagementPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('RunbookManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<RunbookManagementPage />);
    expect(document.body).toBeTruthy();
  });
});
