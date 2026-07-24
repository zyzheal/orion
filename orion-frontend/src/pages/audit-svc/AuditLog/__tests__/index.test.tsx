/**
 * Tests for AuditLogPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLogPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AuditLogPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AuditLogPage />);
    expect(document.body).toBeTruthy();
  });
});
