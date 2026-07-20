/**
 * Tests for ChangeManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ChangeManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ChangeManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ChangeManagement />);
    expect(document.body).toBeTruthy();
  });
});
