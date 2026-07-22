/**
 * Tests for AuditLogsPage page
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuditLogsPage from '../index';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('AuditLogsPage', () => {
  it('renders without crashing', () => {
    renderWithRouter(<AuditLogsPage />);
    expect(document.body).toBeTruthy();
  });
});
