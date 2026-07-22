/**
 * Tests for ApprovalManagement page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ApprovalManagement from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ApprovalManagement', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ApprovalManagement />);
    expect(document.body).toBeTruthy();
  });
});
