/**
 * Tests for CodeMgmtLayout page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import CodeMgmtLayout from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('CodeMgmtLayout', () => {
  it('renders without crashing', () => {
    renderWithRouter(<CodeMgmtLayout />);
    expect(document.body).toBeTruthy();
  });
});
