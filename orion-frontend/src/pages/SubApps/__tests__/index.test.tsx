/**
 * Tests for SubApps page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import SubApps from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('SubApps', () => {
  it('renders without crashing', () => {
    renderWithRouter(<SubApps />);
    expect(document.body).toBeTruthy();
  });
});
