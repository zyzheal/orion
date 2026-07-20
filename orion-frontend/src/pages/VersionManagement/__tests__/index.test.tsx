/**
 * Tests for VersionManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VersionManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('VersionManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<VersionManagement />);
    expect(document.body).toBeTruthy();
  });
});
