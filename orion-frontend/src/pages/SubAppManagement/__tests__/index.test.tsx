/**
 * Tests for SubAppManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubAppManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SubAppManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SubAppManagement />);
    expect(document.body).toBeTruthy();
  });
});
